/**
 * vAuto Evaluation Service
 * Handles vehicle evaluation data extraction from vAuto
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Get vAuto evaluation data for a vehicle
 * @param {Page} page - Puppeteer page instance
 * @param {string} vin - Vehicle VIN
 * @param {string} mileage - Vehicle mileage
 * @returns {Object|null} Evaluation data or null if failed
 */
async function getVAutoEvaluation(page, vin, mileage) {
  try {
    console.log(`🔍 Evaluating VIN: ${vin} with mileage: ${mileage}`);

    // Navigate to appraisal page
    await page.goto(
      `https://www.vauto.com/market/evaluation?vin=${vin}&miles=${mileage.replace(
        /[^\d]/g,
        ""
      )}`,
      { waitUntil: "networkidle2", timeout: 30000 }
    );

    // Wait for the page to load
    await sleep(3000);

    // Check if evaluation data is available
    const hasEvaluationData = await page.evaluate(() => {
      return (
        document.querySelector(".glanceKbbCell") &&
        document.querySelector(".glanceMmrAvg")
      );
    });

    if (!hasEvaluationData) {
      console.log(`❌ No evaluation data found for VIN: ${vin}`);
      return null;
    }

    // Extract history data
    const historyData = await page.evaluate(() => {
      const data = {};

      // Extract owner history
      const ownerHistoryRows = document.querySelectorAll(
        "#tab-vehicle-history-content .history-row"
      );
      if (ownerHistoryRows.length > 0) {
        data.ownerHistory = Array.from(ownerHistoryRows).map((row) => {
          const columns = Array.from(row.querySelectorAll("td"));
          return columns.map((col) => col?.textContent?.trim() || "");
        });
      } else {
        data.ownerHistory = [];
      }

      // Extract accident/damage history
      const accidentRows = document.querySelectorAll(
        "#tab-accident-damage-content .history-row"
      );
      if (accidentRows.length > 0) {
        data.accidentDamage = Array.from(accidentRows).map((row) => {
          const columns = Array.from(row.querySelectorAll("td"));
          return columns.map((col) => col?.textContent?.trim() || "");
        });
      } else {
        data.accidentDamage = [];
      }

      return data;
    });

    // Extract KBB value
    await page.waitForSelector(".glanceKbbCell", { visible: true });
    const kbb = await page.evaluate(() => {
      const kbbElements = document.querySelectorAll(".glanceKbbCell");
      const kbbElement = kbbElements[1] || kbbElements[0];
      return kbbElement?.querySelector("span")?.textContent?.trim() || "";
    });

    // Extract MMR value
    await page.waitForSelector(".glanceMmrAvg", { visible: true });
    const mmr = await page.evaluate(() => {
      const mmrElement = document.querySelector(".glanceMmrAvg");
      return mmrElement?.querySelector("span")?.textContent?.trim() || "";
    });

    const evaluationData = {
      ...historyData,
      kbb,
      mmr,
      evaluatedAt: new Date().toISOString(),
    };

    console.log(`✅ Successfully evaluated VIN: ${vin}`);
    return evaluationData;
  } catch (error) {
    console.error(`❌ Failed to evaluate VIN ${vin}:`, error.message);
    return null;
  }
}

module.exports = {
  getVAutoEvaluation,
};
