const puppeteer = require("puppeteer");
const config = require("./config");
const { saveJSON, loadJSON, launchPuppeteer } = require("./utils");
const { authenticator } = require("otplib");
require("dotenv").config();

/**
 * Login to vAuto
 */
async function loginToVAuto(page) {
  console.log("🔐 Logging into vAuto...");

  await page.goto(config.vautoUrl, { waitUntil: "networkidle2" });

  const pageContent = await page.evaluate(
    () => document.body?.textContent || ""
  );

  if (!pageContent.includes("Sign in to vAuto")) {
    console.log("✅ Already logged into vAuto");
    return;
  }

  const vautoUser = process.env.VAUTO_USERNAME;
  const vautoPassword = process.env.VAUTO_PASSWORD;

  if (!vautoUser || !vautoPassword) {
    throw new Error("Missing vAuto credentials in environment variables");
  }

  // Enter username
  await page.waitForSelector("#username", { visible: true });
  await page.type("#username", vautoUser, { delay: 100 });
  await page.click("#signIn");

  // Enter password
  await page.waitForSelector("#password", { visible: true });
  await page.type("#password", vautoPassword, { delay: 100 });

  await new Promise((resolve) => setTimeout(resolve, 2000));
  await page.click("#signIn");

  // Check for 2FA or successful login
  try {
    console.log("🔍 Checking for login completion or 2FA requirement...");

    // Wait for either successful login navigation, 2FA prompt, or auth app selection
    await Promise.race([
      page.waitForNavigation({ waitUntil: "networkidle0", timeout: 10000 }),
      page.waitForSelector(
        "input[type='text'][placeholder*='code'], input[name*='code'], input[id*='code'], input[class*='code']",
        { timeout: 10000 }
      ),
      page.waitForSelector("#button-verify-by-totp", { timeout: 10000 }), // Auth app selection
    ]);

    // Check if we're on the main vAuto page (successful login)
    const currentUrl = page.url();
    const pageContent = await page.evaluate(
      () => document.body?.textContent || ""
    );

    if (
      currentUrl.includes("platform") ||
      (pageContent.includes("vAuto") && !pageContent.includes("Sign in"))
    ) {
      console.log("✅ Successfully logged into vAuto");
      return;
    }

    // Check for 2FA requirement (including auth app selection page)
    const has2FA = await page.evaluate(() => {
      // Look for common 2FA indicators and vAuto specific elements
      const text = document.body?.textContent?.toLowerCase() || "";
      const codeInputs = document.querySelectorAll(
        "input[type='text'], input[type='number']"
      );
      const authAppButton = document.querySelector("#button-verify-by-totp");
      const authAppCard = document.querySelector(".factor-card-totp");

      return (
        text.includes("verification") ||
        text.includes("authenticator") ||
        text.includes("code") ||
        text.includes("2fa") ||
        text.includes("two-factor") ||
        text.includes("authentication app") ||
        codeInputs.length > 0 ||
        authAppButton ||
        authAppCard
      );
    });

    if (has2FA) {
      console.log("🔐 2FA detected! Attempting automatic authentication...");

      const mfaSecret =
        process.env.VAUTO_MFA_SECRET || process.env.VAUTO_SECRET_KEY_MFA;
      if (!mfaSecret) {
        console.log(
          "❌ No MFA secret found in environment variables (VAUTO_MFA_SECRET or VAUTO_SECRET_KEY_MFA)"
        );
        console.log("🔄 Falling back to manual 2FA...");
        console.log("📱 Steps:");
        console.log("   1. Check your authenticator app or SMS");
        console.log("   2. Enter the verification code in the browser");
        console.log("   3. Click submit/continue");
        console.log("   4. Wait for the script to continue automatically...");
        console.log("");
        console.log(
          "⏳ Waiting for manual 2FA completion (timeout: 2 minutes)..."
        );

        // Bring browser window to front for easier access
        await page.bringToFront();

        // Wait for navigation after 2FA completion (with longer timeout)
        await page.waitForNavigation({
          waitUntil: "networkidle0",
          timeout: 120000, // 2 minutes for manual input
        });
      } else {
        // Generate MFA code automatically
        try {
          const mfaCode = authenticator.generate(mfaSecret);
          console.log(`🔑 Generated MFA Code: ${mfaCode}`);

          // Step 1: Check if we need to select Authentication App first
          let needsToSelectAuthApp = false;
          try {
            // Look for the authentication app selection button or card
            const authAppSelectors = [
              "#button-verify-by-totp",
              ".factor-card-totp button",
              "button:contains('Select')",
              ".btn:contains('Select')",
            ];

            for (const selector of authAppSelectors) {
              try {
                await page.waitForSelector(selector, { timeout: 2000 });
                const element = await page.$(selector);
                if (element) {
                  needsToSelectAuthApp = true;
                  console.log(
                    `📱 Found Authentication App selection with selector: ${selector}`
                  );

                  // Click the authentication app selection
                  await page.click(selector);
                  console.log("✅ Selected Authentication App method");
                  break;
                }
              } catch (e) {
                // Continue to next selector
              }
            }
          } catch (e) {
            // No auth app selection needed, proceed to code input
          }

          if (needsToSelectAuthApp) {
            // Wait for the code input form to appear after selection
            await page.waitForSelector("#input-verification-code", {
              timeout: 10000,
            });
            console.log("📱 Code input form appeared");
          }

          // Step 2: Find the MFA input field (specific vAuto selectors first, then fallbacks)
          const mfaInputSelectors = [
            "#input-verification-code", // vAuto specific
            "input[name='input-verification-code']", // vAuto specific
            "input[placeholder*='one time code']", // vAuto specific
            "input[type='text'][placeholder*='code']",
            "input[name*='code']",
            "input[id*='code']",
            "input[class*='code']",
            "input[type='number']",
            "input[placeholder*='verification']",
            "input[placeholder*='authenticator']",
          ];

          let mfaInput = null;
          let foundSelector = null;
          for (const selector of mfaInputSelectors) {
            try {
              await page.waitForSelector(selector, { timeout: 3000 });
              mfaInput = await page.$(selector);
              if (mfaInput) {
                foundSelector = selector;
                console.log(
                  `📱 Found MFA input field with selector: ${selector}`
                );
                break;
              }
            } catch (e) {
              // Continue to next selector
            }
          }

          if (mfaInput) {
            // Clear and enter the MFA code
            await mfaInput.click({ clickCount: 3 }); // Select all
            await page.type(foundSelector, mfaCode, { delay: 100 });
            console.log("✅ MFA code entered successfully");

            // Step 3: Submit the code (vAuto specific selectors first, then fallbacks)
            const submitSelectors = [
              "#button-account-recovery-submit", // vAuto specific
              "button[type='submit']",
              "input[type='submit']",
              "button:contains('Verify')",
              "button:contains('Submit')",
              "button:contains('Continue')",
              "#submit-mfa",
              "#signIn",
            ];

            let submitted = false;
            for (const selector of submitSelectors) {
              try {
                const submitBtn = await page.$(selector);
                if (submitBtn) {
                  // Check if button is enabled (vAuto disables it until code is entered)
                  const isDisabled = await page.evaluate(
                    (btn) => btn.disabled,
                    submitBtn
                  );
                  if (!isDisabled) {
                    await submitBtn.click();
                    console.log(
                      `🚀 Clicked submit button with selector: ${selector}`
                    );
                    submitted = true;
                    break;
                  } else {
                    console.log(
                      `⏳ Submit button found but disabled, waiting...`
                    );
                    // Wait a moment for the button to become enabled
                    await page.waitForFunction(
                      (sel) => {
                        const btn = document.querySelector(sel);
                        return btn && !btn.disabled;
                      },
                      { timeout: 5000 },
                      selector
                    );
                    await submitBtn.click();
                    console.log(
                      `🚀 Clicked enabled submit button with selector: ${selector}`
                    );
                    submitted = true;
                    break;
                  }
                }
              } catch (e) {
                // Continue to next selector
              }
            }

            if (!submitted) {
              // Try pressing Enter as fallback
              await page.keyboard.press("Enter");
              console.log("🚀 Pressed Enter to submit MFA code");
            }

            // Wait for navigation after MFA submission
            await page.waitForNavigation({
              waitUntil: "networkidle0",
              timeout: 30000,
            });
          } else {
            console.log("❌ Could not find MFA input field");
            console.log("🔄 Falling back to manual 2FA...");

            // Bring browser window to front for manual input
            await page.bringToFront();

            // Wait for navigation after manual completion
            await page.waitForNavigation({
              waitUntil: "networkidle0",
              timeout: 120000,
            });
          }
        } catch (error) {
          console.log(`❌ Error during automatic MFA: ${error.message}`);
          console.log("🔄 Falling back to manual 2FA...");

          // Bring browser window to front for manual input
          await page.bringToFront();

          // Wait for navigation after manual completion
          await page.waitForNavigation({
            waitUntil: "networkidle0",
            timeout: 120000,
          });
        }
      }

      console.log("✅ 2FA completed successfully!");
    }

    console.log("✅ Successfully logged into vAuto");
  } catch (error) {
    // If we timeout waiting for navigation, check if we're already logged in
    const currentUrl = page.url();
    const pageContent = await page.evaluate(
      () => document.body?.textContent || ""
    );

    if (
      currentUrl.includes("platform") ||
      (pageContent.includes("vAuto") && !pageContent.includes("Sign in"))
    ) {
      console.log("✅ Already logged into vAuto (navigation timeout ignored)");
      return;
    }

    console.log("⚠️ Login process unclear, continuing anyway...");
    console.log(`Current URL: ${currentUrl}`);
  }
}

/**
 * Get vAuto evaluation data
 */
async function getVAutoEvaluation(page, vin, mileage) {
  console.log(`🔍 Evaluating VIN: ${vin}`);

  try {
    // Clear and input VIN
    await page.waitForSelector("#sas_buyer_Evaluation_0_vin", {
      visible: true,
    });
    const vinInput = await page.$("#sas_buyer_Evaluation_0_vin");
    await vinInput.click({ clickCount: 3 });
    await page.type("#sas_buyer_Evaluation_0_vin", vin, { delay: 50 });

    // Clear and input mileage
    const mileageInput = await page.$("#sas_buyer_Evaluation_0_odometer");
    await mileageInput.click({ clickCount: 3 });
    await page.type("#sas_buyer_Evaluation_0_odometer", mileage, { delay: 50 });

    // Click evaluate
    await page.click("#btnEvaluate");

    // Wait for evaluation
    await new Promise((resolve) => setTimeout(resolve, 20000));

    // Get AutoCheck frame
    const frame = await page.waitForFunction(
      () => {
        const frames = Array.from(document.querySelectorAll("iframe"));
        return frames.find((f) => f.name === "sas_autocheck_AutoCheck_0_ifr");
      },
      { timeout: 30000 }
    );

    const autoCheckFrame = await frame.asElement().contentFrame();
    await autoCheckFrame.waitForSelector("#accident", { timeout: 30000 });
    await autoCheckFrame.waitForSelector("#at-glance", { timeout: 30000 });

    // Extract vehicle history data
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

      // Owner Date
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
          return columns.map((col) => col?.textContent?.trim() || "");
        });
      } else {
        data.accidentDamage = [];
      }

      return data;
    });

    // Extract KBB and MMR values
    await page.waitForSelector(".glanceKbbCell", { visible: true });
    const kbb = await page.evaluate(() => {
      const kbbElements = document.querySelectorAll(".glanceKbbCell");
      const kbbElement = kbbElements[1] || kbbElements[0];
      return kbbElement?.querySelector("span")?.textContent?.trim() || "";
    });

    await page.waitForSelector(".glanceMmrAvg", { visible: true });
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
 * Format evaluation data into a note
 */
function formatEvaluationNote(evaluationData) {
  if (!evaluationData) return "❌ Evaluation failed";

  let note = "";

  // Odometer check (only if there's an issue)
  if (
    evaluationData.odometerCheck &&
    evaluationData.odometerCheck !== "No Issue"
  ) {
    note += `${evaluationData.odometerCheck}\n`;
  }

  // Owner information
  let ownerText = evaluationData.owner;
  if (ownerText && ownerText.includes("Owners")) {
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
 * Main function to enrich existing vehicles with vAuto data
 */
async function enrichVehiclesWithVAuto(jobId = null) {
  // Utility function to check for cancellation
  const checkCancellation = () => {
    if (jobId && global.jobCancellation && global.jobCancellation[jobId]) {
      throw new Error("Job was cancelled by user request");
    }
  };

  const browser = await launchPuppeteer({
    headless: config.show2FA ? false : config.headless, // Always show browser if 2FA handling is enabled
    userDataDir: "./user_data",
    args: [
      "--disable-infobars",
      "--window-position=0,0",
      "--ignore-certificate-errors",
      "--ignore-certificate-errors-spki-list",
      "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    ],
  });

  const vautoPage = await browser.newPage();
  let vehicles = []; // Initialize to ensure it's accessible in catch block

  try {
    checkCancellation(); // Check before starting
    // Login to vAuto only
    await loginToVAuto(vautoPage);

    checkCancellation(); // Check after login

    // Load existing vehicles data
    let vehicles = loadJSON("./data/vehicles.json");
    console.log(`📋 Loaded ${vehicles.length} existing vehicles from JSON`);

    if (vehicles.length === 0) {
      console.log("⚠️ No vehicles found in vehicles.json");
      return;
    }

    // Filter vehicles that need vAuto data (don't have vautoData or it's incomplete)
    const vehiclesToProcess = vehicles.filter((vehicle) => {
      return (
        vehicle.vin &&
        vehicle.mileage &&
        (!vehicle.vautoData || !vehicle.vautoData.kbb)
      );
    });

    console.log(
      `📋 Found ${vehiclesToProcess.length} vehicles that need vAuto evaluation`
    );

    if (vehiclesToProcess.length === 0) {
      console.log("✅ All vehicles already have vAuto data");
      return {
        vehicles,
        summary: {
          total: 0,
          successful: 0,
          failed: 0,
        },
      };
    }

    let successCount = 0;
    let failCount = 0;
    const startTime = Date.now();

    // Process each vehicle
    for (let i = 0; i < vehiclesToProcess.length; i++) {
      checkCancellation(); // Check before processing each vehicle

      const vehicle = vehiclesToProcess[i];
      const progressPercent = (
        ((i + 1) / vehiclesToProcess.length) *
        100
      ).toFixed(1);
      const remainingCount = vehiclesToProcess.length - (i + 1);

      // Calculate ETA
      const elapsedTime = Date.now() - startTime;
      const avgTimePerVehicle = elapsedTime / (i + 1);
      const estimatedTimeRemaining = Math.round(
        (avgTimePerVehicle * remainingCount) / 1000 / 60
      ); // in minutes
      const etaText = i > 0 ? ` - ETA: ${estimatedTimeRemaining}min` : "";

      try {
        console.log(
          `\n🔄 Processing ${i + 1}/${
            vehiclesToProcess.length
          } (${progressPercent}%) - ${remainingCount} remaining${etaText}: ${
            vehicle.ymmt || vehicle.title || "Unknown Vehicle"
          }`
        );
        console.log(`📍 VIN: ${vehicle.vin}`);

        // Clean mileage to get just numbers
        const cleanMileage =
          vehicle.mileage?.toString().replace(/[^\d]/g, "") || "";

        if (!cleanMileage) {
          console.log("⚠️ No valid mileage found, skipping...");
          failCount++;
          continue;
        }

        // Get vAuto evaluation
        const evaluationData = await getVAutoEvaluation(
          vautoPage,
          vehicle.vin,
          cleanMileage
        );

        if (evaluationData) {
          // Format note
          const formattedNote = formatEvaluationNote(evaluationData);
          console.log(`📝 Generated vAuto note:\n${formattedNote}`);

          // Update the vehicle in the array
          const vehicleIndex = vehicles.findIndex((v) => v.vin === vehicle.vin);
          if (vehicleIndex >= 0) {
            vehicles[vehicleIndex] = {
              ...vehicles[vehicleIndex],
              vautoData: evaluationData,
              note: formattedNote,
              enrichedAt: new Date().toISOString(),
            };
          }

          successCount++;
          console.log(`✅ Successfully enriched vehicle ${vehicle.vin}`);
          console.log(
            `📊 Progress: ${successCount + failCount}/${
              vehiclesToProcess.length
            } vehicles completed`
          );
        } else {
          console.log(`❌ Failed to get vAuto data for ${vehicle.vin}`);
          failCount++;
          console.log(
            `📊 Progress: ${successCount + failCount}/${
              vehiclesToProcess.length
            } vehicles completed`
          );
        }

        // Wait between requests to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } catch (error) {
        console.error(
          `❌ Error processing vehicle ${vehicle.vin}:`,
          error.message
        );
        failCount++;
        console.log(
          `📊 Progress: ${successCount + failCount}/${
            vehiclesToProcess.length
          } vehicles completed`
        );
      }
    }

    // Save updated vehicles data
    saveJSON("./data/vehicles.json", vehicles);

    console.log(`\n📊 vAuto Enrichment Summary:`);
    console.log(`✅ Successfully processed: ${successCount} vehicles`);
    console.log(`❌ Failed: ${failCount} vehicles`);
    console.log(`📁 Updated vehicles.json with vAuto data`);

    return {
      vehicles,
      summary: {
        total: vehiclesToProcess.length,
        successful: successCount,
        failed: failCount,
      },
    };
  } catch (error) {
    // Check if this was a cancellation
    if (error.message && error.message.includes("cancelled")) {
      console.log("🛑 vAuto enrichment was cancelled");

      // Save whatever we got so far if we have any vehicles
      if (vehicles && vehicles.length > 0) {
        saveJSON("./data/vehicles_cancelled.json", vehicles);
        console.log(`💾 Partial data saved to: vehicles_cancelled.json`);

        return {
          vehicles,
          cancelled: true,
          summary: {
            total: successCount + failCount,
            successful: successCount,
            failed: failCount,
          },
        };
      } else {
        console.log("🛑 No vehicles were processed before cancellation");
        return {
          vehicles: [],
          cancelled: true,
          summary: {
            total: 0,
            successful: 0,
            failed: 0,
          },
        };
      }
    }

    console.error("❌ Fatal error:", error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

module.exports = enrichVehiclesWithVAuto;
