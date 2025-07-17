const puppeteer = require("puppeteer");
const { vautoUrl, headless } = require("./config");
const { loadJSON, summarizeVehicle, fuzzyMatchVIN } = require("./utils");
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

    await page.goto(vautoUrl, { waitUntil: "networkidle2", timeout: 60000 });

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
    await new Promise(resolve => setTimeout(resolve, 2000));

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
    await new Promise(resolve => setTimeout(resolve, 20000));

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
 */
async function annotateUser(user) {
  console.log(`🚀 Starting vAuto annotation for user: ${user.email}`);

  const browser = await puppeteer.launch({
    headless,
    userDataDir: "./user_data", // Persistent browser profile for session management
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-infobars",
      "--ignore-certificate-errors",
      "--ignore-certificate-errors-spki-list",
      "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    ],
  });

  const page = await browser.newPage();

  try {
    // Load vehicle data
    const vehicles = loadJSON("./data/vehicles.json");
    const candidates = vehicles.filter(
      (v) => user.vins.includes(v.vin) || fuzzyMatchVIN(v.vin, user.vins)
    );

    console.log(`📋 Found ${candidates.length} vehicles to process`);

    if (candidates.length === 0) {
      console.log("⚠️ No matching vehicles found");
      return;
    }

    // Login to vAuto
    await loginToVAuto(page);

    const results = [];

    // Process each vehicle
    for (const vehicle of candidates) {
      console.log(`\n🔄 Processing: ${summarizeVehicle(vehicle)}`);

      try {
        const evaluationData = await getVehicleEvaluation(
          page,
          vehicle.vin,
          vehicle.mileage
        );
        const formattedNote = formatEvaluationNote(evaluationData);

        results.push({
          vin: vehicle.vin,
          title: vehicle.title,
          evaluationData,
          note: formattedNote,
          success: !!evaluationData,
        });

        console.log(`✅ Generated note for ${vehicle.vin}:\n${formattedNote}`);

        // Wait between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        console.error(`❌ Failed to process ${vehicle.vin}:`, error.message);
        results.push({
          vin: vehicle.vin,
          title: vehicle.title,
          success: false,
          error: error.message,
        });
      }
    }

    // Summary
    const successful = results.filter((r) => r.success).length;
    console.log(`\n📊 Annotation Summary:`);
    console.log(
      `✅ Successfully processed: ${successful}/${candidates.length} vehicles`
    );
    console.log(
      `❌ Failed: ${candidates.length - successful}/${
        candidates.length
      } vehicles`
    );

    return results;
  } catch (error) {
    console.error("❌ Fatal error during annotation:", error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

module.exports = annotateUser;
