const puppeteer = require("puppeteer");
const config = require("./config");
const {
  loadJSON,
  summarizeVehicle,
  fuzzyMatchVIN,
  getMostRecentFile,
  saveJSON,
  generateDateFilename,
  exportData,
} = require("./utils");
require("dotenv").config();

/**
 * Login to vAuto platform
 * @param {Object} page - Puppeteer page instance
 */
async function loginToVAuto(page) {
  console.log("🔐 Attempting to login to vAuto...");

  try {
    // Validate credentials first
    const vautoUser = process.env.VAUTO_USERNAME;
    const vautoPassword = process.env.VAUTO_PASSWORD;

    if (!vautoUser || !vautoPassword) {
      throw new Error("Missing vAuto credentials in environment variables");
    }

    console.log(`📧 Using username: ${vautoUser.substring(0, 3)}***`);

    await page.goto(config.vautoUrl, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    // Check if already logged in
    const pageContent = await page.evaluate(() => document.body.textContent);

    if (!pageContent.includes("Sign in to vAuto")) {
      console.log("✅ Already logged in to vAuto");
      return true;
    }

    console.log("🔑 Performing vAuto login...");

    // Wait for username field and enter credentials
    await page.waitForSelector("#username", { visible: true, timeout: 30000 });
    await page.type("#username", vautoUser, { delay: 100 });

    // Click first sign in button
    await page.click("#signIn");

    // Wait for password field and enter password
    await page.waitForSelector("#password", { visible: true, timeout: 30000 });
    await page.type("#password", vautoPassword, { delay: 100 });

    // Wait for network to settle before clicking
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Click final sign in button
    await page.click("#signIn");

    // Wait for successful login
    await page.waitForNavigation({
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    console.log("✅ Successfully logged in to vAuto");
    return true;
  } catch (error) {
    console.error("❌ Failed to login to vAuto:", error.message);
    throw new Error(`vAuto login failed: ${error.message}`);
  }
}

/**
 * Extract vehicle evaluation data from vAuto
 * @param {Object} page - Puppeteer page instance
 * @param {string} vin - Vehicle VIN number
 * @param {string} mileage - Vehicle mileage
 */
async function getVehicleEvaluation(page, vin, mileage) {
  console.log(`🔍 Evaluating VIN: ${vin}`);

  try {
    // Clear and input VIN
    await page.waitForSelector("#sas_buyer_Evaluation_0_vin", {
      visible: true,
      timeout: 30000,
    });
    const vinInput = await page.$("#sas_buyer_Evaluation_0_vin");
    await vinInput.click({ clickCount: 3 }); // Select all text
    await page.type("#sas_buyer_Evaluation_0_vin", vin, { delay: 50 });

    // Clear and input mileage (extract numbers only)
    const mileageNumbers = mileage.replace(/[^\d]/g, "");
    await page.waitForSelector("#sas_buyer_Evaluation_0_odometer", {
      visible: true,
    });
    const mileageInput = await page.$("#sas_buyer_Evaluation_0_odometer");
    await mileageInput.click({ clickCount: 3 });
    await page.type("#sas_buyer_Evaluation_0_odometer", mileageNumbers, {
      delay: 50,
    });

    // Click evaluate button
    await page.click("#btnEvaluate");

    // Wait for evaluation to complete
    await new Promise((resolve) => setTimeout(resolve, 20000));

    // Wait for AutoCheck frame to load
    const frame = await page.waitForFunction(
      () => {
        const frames = Array.from(document.querySelectorAll("iframe"));
        return frames.find((f) => f.name === "sas_autocheck_AutoCheck_0_ifr");
      },
      { timeout: 30000 }
    );

    const autoCheckFrame = await frame.asElement().contentFrame();

    // Wait for required elements in frame
    await autoCheckFrame.waitForSelector("#accident", { timeout: 30000 });
    await autoCheckFrame.waitForSelector("#at-glance", { timeout: 30000 });

    // Extract vehicle history data from AutoCheck frame
    const historyData = await autoCheckFrame.evaluate(() => {
      const data = {};

      // Odometer Check
      const odometerCheck = document.querySelector(
        "#at-glance .section-data div:nth-child(6) .card-footer-text-adjustment span"
      );
      data.odometerCheck = odometerCheck?.textContent?.trim() || "";

      // Owner Information
      const owner = document.querySelector(
        "#three-box-summary div:nth-child(2) .box-title-owners"
      );
      data.owner = owner?.textContent?.trim() || "1 - Own";

      // Owner Date Text
      try {
        const parent = document.querySelector(".history-web-no-print");
        if (parent && parent.children.length >= 2) {
          const ownerDateElement = parent.children[
            parent.children.length - 2
          ].querySelector(".owner-card-header-blue div div:nth-child(2) span");
          data.ownerDateText = ownerDateElement?.textContent?.trim() || "";
        }
      } catch (e) {
        data.ownerDateText = "";
      }

      // Accident/Damage History
      const rows = Array.from(
        document.querySelectorAll(".table-striped tbody tr")
      );
      if (rows.length > 0) {
        data.accidentDamage = rows.map((row) => {
          const columns = Array.from(row.querySelectorAll("td"));
          return columns.map((col) => col.textContent.trim());
        });
      } else {
        data.accidentDamage = [];
      }

      return data;
    });

    // Extract KBB value
    await page.waitForSelector(".glanceKbbCell", {
      visible: true,
      timeout: 30000,
    });
    const kbb = await page.evaluate(() => {
      const kbbElements = document.querySelectorAll(".glanceKbbCell");
      const kbbElement = kbbElements[1] || kbbElements[0];
      return kbbElement?.querySelector("span")?.textContent?.trim() || "";
    });

    // Extract MMR value
    await page.waitForSelector(".glanceMmrAvg", {
      visible: true,
      timeout: 30000,
    });
    const mmr = await page.evaluate(() => {
      const mmrElement = document.querySelector(".glanceMmrAvg");
      return mmrElement?.querySelector("span")?.textContent?.trim() || "";
    });

    return {
      ...historyData,
      kbb,
      mmr,
    };
  } catch (error) {
    console.error(`❌ Failed to evaluate VIN ${vin}:`, error.message);
    return null;
  }
}

/**
 * Format evaluation data into a readable note
 * @param {Object} evaluationData - Raw evaluation data from vAuto
 */
function formatEvaluationNote(evaluationData) {
  if (!evaluationData) return "❌ Evaluation failed";

  let note = "";

  // Odometer check (only add if there's an issue)
  if (
    evaluationData.odometerCheck &&
    evaluationData.odometerCheck !== "No Issue"
  ) {
    note += `${evaluationData.odometerCheck}\n`;
  }

  // Owner information
  let ownerText = evaluationData.owner;
  if (ownerText && ownerText.includes("Owners")) {
    // Format "2 Owners" to "2 - Own"
    ownerText = ownerText
      .split(" ")
      .reverse()
      .join(" ")
      .replace("Owners", "Own");
  }
  note += `${ownerText}\n`;

  // Owner date (format MM/DD/YYYY to MM/YY)
  if (evaluationData.ownerDateText) {
    const [month, year] = evaluationData.ownerDateText.split("/");
    if (month && year) {
      note += `${month}/${year.slice(-2)}\n`;
    }
  }

  // Accident/damage history
  if (
    Array.isArray(evaluationData.accidentDamage) &&
    evaluationData.accidentDamage.length > 0
  ) {
    const damageText = evaluationData.accidentDamage
      .map(([date, type, severity]) => `${date} ${type} ${severity}`)
      .join(", ");
    note += `${damageText}\n`;
  }

  // KBB and MMR values
  if (evaluationData.kbb) {
    note += `k= ${evaluationData.kbb}\n`;
  }
  if (evaluationData.mmr) {
    note += `m= ${evaluationData.mmr}`;
  }

  return note.trim();
}

/**
 * Main function to annotate vehicles with vAuto data
 * @param {Object} user - User object containing VINs to process
 * @param {Object} options - Options for processing and export
 */
async function annotateUser(user, options = {}) {
  const {
    inputFile = null,
    exportFormat = "xlsx",
    exportFilename = null,
    jobId = null,
    userDataDir = "./user_data",
  } = options;

  console.log(`🚀 Starting vAuto annotation for user: ${user.email}`);

  // Utility function to check for cancellation
  const checkCancellation = () => {
    if (jobId && global.jobCancellation && global.jobCancellation[jobId]) {
      throw new Error("Job was cancelled by user request");
    }
  };

  // Clean up any existing browser lock files before launching
  cleanupBrowserLocks(userDataDir);

  const browser = await puppeteer.launch(
    config.getPuppeteerOptions({
      userDataDir: userDataDir, // Use configurable user data directory
      args: [
        "--disable-infobars",
        "--ignore-certificate-errors",
        "--ignore-certificate-errors-spki-list",
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor",
        "--no-first-run",
        "--no-default-browser-check",
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      ],
    })
  );

  const page = await browser.newPage();

  try {
    checkCancellation(); // Check before starting

    // Load vehicle data - use specified file or find the most recent one
    let dataFile = inputFile;
    if (!dataFile) {
      dataFile = getMostRecentFile("vehicles");
      if (!dataFile) {
        // Fallback to default location
        dataFile = "./data/vehicles.json";
      }
    }

    console.log(`📂 Loading vehicle data from: ${dataFile}`);
    const vehicles = loadJSON(dataFile);

    if (!vehicles || vehicles.length === 0) {
      console.log("⚠️ No vehicle data found in the file");
      return;
    }

    const candidates = vehicles.filter(
      (v) => user.vins.includes(v.vin) || fuzzyMatchVIN(v.vin, user.vins)
    );

    console.log(
      `📋 Found ${candidates.length} vehicles to process from ${vehicles.length} total vehicles`
    );

    if (candidates.length === 0) {
      console.log("⚠️ No matching vehicles found");
      return;
    }

    checkCancellation(); // Check before login

    // Login to vAuto
    await loginToVAuto(page);

    const results = [];
    let processedCount = 0;
    const startTime = Date.now();

    // Process each vehicle
    for (const vehicle of candidates) {
      checkCancellation(); // Check before processing each vehicle

      processedCount++;
      const progressPercent = (
        (processedCount / candidates.length) *
        100
      ).toFixed(1);
      const remainingCount = candidates.length - processedCount;

      // Calculate estimated time remaining
      const elapsedTime = Date.now() - startTime;
      const avgTimePerVehicle = elapsedTime / processedCount;
      const estimatedTimeRemaining = Math.round(
        (avgTimePerVehicle * remainingCount) / 1000 / 60
      ); // in minutes

      const etaText =
        processedCount > 1 ? ` - ETA: ${estimatedTimeRemaining}min` : "";

      console.log(
        `\n🔄 Processing ${processedCount}/${
          candidates.length
        } (${progressPercent}%) - ${remainingCount} remaining${etaText}: ${summarizeVehicle(
          vehicle
        )}`
      );

      try {
        const evaluationData = await getVehicleEvaluation(
          page,
          vehicle.vin,
          vehicle.mileage
        );
        const formattedNote = formatEvaluationNote(evaluationData);

        // Merge vAuto data with original vehicle data
        const enrichedVehicle = {
          ...vehicle,
          vautoEvaluation: evaluationData,
          vautoNote: formattedNote,
          evaluationSuccess: !!evaluationData,
          processedAt: new Date().toISOString(),
        };

        results.push(enrichedVehicle);

        console.log(`✅ Generated note for ${vehicle.vin}:\n${formattedNote}`);
        console.log(
          `📊 Progress: ${processedCount}/${
            candidates.length
          } vehicles completed (${(
            (processedCount / candidates.length) *
            100
          ).toFixed(1)}%)`
        );

        // Wait between requests to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 3000));
      } catch (error) {
        console.error(`❌ Failed to process ${vehicle.vin}:`, error.message);

        const failedVehicle = {
          ...vehicle,
          vautoEvaluation: null,
          vautoNote: "❌ Evaluation failed",
          evaluationSuccess: false,
          evaluationError: error.message,
          processedAt: new Date().toISOString(),
        };

        results.push(failedVehicle);
        console.log(
          `📊 Progress: ${processedCount}/${
            candidates.length
          } vehicles completed (${(
            (processedCount / candidates.length) *
            100
          ).toFixed(1)}%)`
        );
      }
    }

    // Summary
    const successful = results.filter((r) => r.evaluationSuccess).length;
    console.log(`\n📊 Annotation Summary:`);
    console.log(
      `✅ Successfully processed: ${successful}/${candidates.length} vehicles`
    );
    console.log(
      `❌ Failed: ${candidates.length - successful}/${
        candidates.length
      } vehicles`
    );

    // Save annotated data
    const annotatedFilename = generateDateFilename("vehicles_annotated");
    saveJSON(annotatedFilename, results);
    console.log(`💾 Annotated data saved to: ${annotatedFilename}`);

    // Export in requested format
    if (exportFormat && exportFormat !== "json") {
      try {
        const exportFilePath =
          exportFilename ||
          generateDateFilename("vehicles_annotated", exportFormat);

        const exportedFile = exportData(
          results,
          "vehicles_annotated",
          exportFormat
        );
        console.log(
          `📊 Data exported to ${exportFormat.toUpperCase()}: ${exportedFile}`
        );

        return {
          results,
          jsonFile: annotatedFilename,
          exportFile: exportedFile,
          summary: {
            total: candidates.length,
            successful,
            failed: candidates.length - successful,
          },
        };
      } catch (exportError) {
        console.error(`❌ Export failed: ${exportError.message}`);
        // Still return results even if export fails
        return {
          results,
          jsonFile: annotatedFilename,
          exportError: exportError.message,
          summary: {
            total: candidates.length,
            successful,
            failed: candidates.length - successful,
          },
        };
      }
    }

    return {
      results,
      jsonFile: annotatedFilename,
      summary: {
        total: candidates.length,
        successful,
        failed: candidates.length - successful,
      },
    };
  } catch (error) {
    // Check if this was a cancellation
    if (error.message && error.message.includes("cancelled")) {
      console.log("🛑 vAuto annotation was cancelled");

      // Save whatever results we got so far
      if (results && results.length > 0) {
        const annotatedFilename = generateDateFilename(
          "vehicles_annotated_cancelled"
        );
        saveJSON(annotatedFilename, results);
        console.log(
          `💾 Partial results saved to: ${annotatedFilename} (${results.length} vehicles processed)`
        );

        const successful = results.filter((r) => r.evaluationSuccess).length;
        return {
          results,
          jsonFile: annotatedFilename,
          cancelled: true,
          summary: {
            total: results.length,
            successful,
            failed: results.length - successful,
          },
        };
      } else {
        console.log("🛑 No vehicles were processed before cancellation");
        return {
          results: [],
          jsonFile: null,
          cancelled: true,
          summary: {
            total: 0,
            successful: 0,
            failed: 0,
          },
        };
      }
    }

    console.error("❌ Fatal error during annotation:", error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

/**
 * Wrapper function to annotate vehicles from a JSON file
 * @param {string} inputFile - Path to the JSON file containing vehicles
 * @param {string} jobId - Optional job ID for cancellation tracking
 * @returns {Object} - Results object with annotated vehicles and summary
 */
async function annotateVehiclesWithVAuto(inputFile, jobId = null) {
  try {
    console.log(`🔄 Starting vAuto annotation for vehicles in: ${inputFile}`);

    // Load vehicles from the file
    const vehicles = loadJSON(inputFile);

    if (!vehicles || vehicles.length === 0) {
      console.log("⚠️ No vehicles found in the file");
      return {
        vehicles: [],
        filename: null,
        summary: {
          total: 0,
          successful: 0,
          failed: 0,
        },
      };
    }

    console.log(`🎯 Processing ${vehicles.length} vehicles with vAuto...`);

    // Utility function to check for cancellation
    const checkCancellation = () => {
      if (jobId && global.jobCancellation && global.jobCancellation[jobId]) {
        throw new Error("Job was cancelled by user request");
      }
    };

    // Create unique user data directory to avoid conflicts
    const timestamp = Date.now();
    const uniqueUserDataDir = `./user_data_vauto_${timestamp}`;

    // Clean up any existing browser lock files
    cleanupBrowserLocks("./user_data");

    const browser = await puppeteer.launch(
      config.getPuppeteerOptions({
        userDataDir: uniqueUserDataDir,
        args: [
          "--disable-infobars",
          "--ignore-certificate-errors",
          "--ignore-certificate-errors-spki-list",
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor",
          "--no-first-run",
          "--no-default-browser-check",
          "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        ],
      })
    );

    const page = await browser.newPage();

    try {
      checkCancellation(); // Check before starting

      // Login to vAuto
      await loginToVAuto(page);

      const enrichedVehicles = [];
      let processedCount = 0;
      let successful = 0;
      const startTime = Date.now();

      // Process each vehicle in the file
      for (const vehicle of vehicles) {
        checkCancellation(); // Check before processing each vehicle

        processedCount++;
        const progressPercent = (
          (processedCount / vehicles.length) *
          100
        ).toFixed(1);
        const remainingCount = vehicles.length - processedCount;

        // Calculate estimated time remaining
        const elapsedTime = Date.now() - startTime;
        const avgTimePerVehicle = elapsedTime / processedCount;
        const estimatedTimeRemaining = Math.round(
          (avgTimePerVehicle * remainingCount) / 1000 / 60
        ); // in minutes

        const etaText =
          processedCount > 1 ? ` - ETA: ${estimatedTimeRemaining}min` : "";

        console.log(
          `🔍 Processing vehicle ${processedCount}/${vehicles.length} (${progressPercent}%)${etaText}`
        );
        console.log(`   VIN: ${vehicle.vin} | ${summarizeVehicle(vehicle)}`);

        try {
          // Search for and evaluate the vehicle
          // Extract mileage number from mileage string (e.g., "84,100 mi" -> "84100")
          const mileageNumbers = vehicle.mileage
            ? vehicle.mileage.replace(/[^\d]/g, "")
            : "";
          const evaluation = await getVehicleEvaluation(
            page,
            vehicle.vin,
            mileageNumbers
          );

          // Merge the evaluation data with the original vehicle data
          const enrichedVehicle = {
            ...vehicle, // Keep all original data
            ...evaluation, // Add vAuto data
            vautoProcessedAt: new Date().toISOString(),
            evaluationSuccess: true,
          };

          enrichedVehicles.push(enrichedVehicle);
          successful++;
          console.log(`✅ Successfully processed ${vehicle.vin}`);
        } catch (vehicleError) {
          console.log(
            `❌ Error processing ${vehicle.vin}: ${vehicleError.message}`
          );

          // Keep the original vehicle data even if vAuto processing fails
          const vehicleWithError = {
            ...vehicle,
            vautoError: vehicleError.message,
            vautoProcessedAt: new Date().toISOString(),
            evaluationSuccess: false,
          };

          enrichedVehicles.push(vehicleWithError);
        }

        // Add delay between vehicles to avoid overwhelming the server
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      console.log(`✅ Completed processing ${vehicles.length} vehicles`);

      // Update the original file with enriched data (same filename, same location)
      console.log(`💾 Updating original file with enriched data: ${inputFile}`);
      saveJSON(inputFile, enrichedVehicles);

      const summary = {
        total: vehicles.length,
        successful: successful,
        failed: vehicles.length - successful,
      };

      console.log(
        `📊 Summary: ${summary.successful} successful, ${summary.failed} failed out of ${summary.total} total`
      );

      return {
        vehicles: enrichedVehicles,
        filename: inputFile, // Return the same filename since we updated it in place
        summary: summary,
      };
    } finally {
      await browser.close();

      // Clean up the temporary user data directory
      try {
        const fs = require("fs");
        if (fs.existsSync(uniqueUserDataDir)) {
          fs.rmSync(uniqueUserDataDir, { recursive: true, force: true });
        }
      } catch (cleanupError) {
        console.log(
          `⚠️ Failed to cleanup temp directory: ${cleanupError.message}`
        );
      }
    }
  } catch (error) {
    console.error(`❌ annotateVehiclesWithVAuto failed: ${error.message}`);
    throw error;
  }
}

// Helper function to clean up browser lock files
function cleanupBrowserLocks(userDataDir) {
  try {
    const fs = require("fs");
    const path = require("path");

    const lockFiles = [
      path.join(userDataDir, "SingletonLock"),
      path.join(userDataDir, "SingletonSocket"),
      path.join(userDataDir, "SingletonCookie"),
    ];

    lockFiles.forEach((lockFile) => {
      if (fs.existsSync(lockFile)) {
        fs.unlinkSync(lockFile);
        console.log(`🧹 Cleaned up lock file: ${lockFile}`);
      }
    });
  } catch (error) {
    console.log(`⚠️ Failed to cleanup lock files: ${error.message}`);
  }
}

module.exports = { annotateUser, annotateVehiclesWithVAuto };
