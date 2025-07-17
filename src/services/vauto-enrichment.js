/**
 * vAuto Enrichment Service
 * Main orchestrator for vAuto vehicle data enrichment
 */

const { launchPuppeteer, loadJSON, saveJSON } = require("../utils");
const { loginToVAuto } = require("./vauto-login");
const { getVAutoEvaluation } = require("./vauto-evaluation");
const config = require("../config");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Main function to enrich existing vehicles with vAuto data
 * @param {string} jobId - Optional job ID for cancellation tracking
 * @returns {Object} Enrichment results
 */
async function enrichVehiclesWithVAuto(jobId = null) {
  console.log("🚀 Starting vAuto vehicle enrichment...");

  const checkCancellation = () => {
    if (jobId && global.jobCancellation && global.jobCancellation[jobId]) {
      throw new Error("Job was cancelled by user request");
    }
  };

  const browser = await launchPuppeteer({
    headless: config.show2FA ? false : config.headless,
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
  let vehicles = [];

  try {
    checkCancellation();

    // Step 1: Login to vAuto
    await loginToVAuto(vautoPage);
    checkCancellation();

    // Step 2: Load existing vehicles data
    vehicles = loadJSON("./data/vehicles.json");
    console.log(`📋 Loaded ${vehicles.length} existing vehicles from JSON`);

    if (vehicles.length === 0) {
      console.log("⚠️ No vehicles found in vehicles.json");
      return {
        vehicles: [],
        summary: {
          total: 0,
          successful: 0,
          failed: 0,
        },
      };
    }

    // Step 3: Filter vehicles that need vAuto data
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

    // Step 4: Process each vehicle
    let successCount = 0;
    let failCount = 0;
    const startTime = Date.now();

    for (let i = 0; i < vehiclesToProcess.length; i++) {
      checkCancellation();

      const vehicle = vehiclesToProcess[i];
      const progressPercent = (
        ((i + 1) / vehiclesToProcess.length) *
        100
      ).toFixed(1);

      console.log(
        `🔄 Processing vehicle ${i + 1}/${
          vehiclesToProcess.length
        } (${progressPercent}%) - VIN: ${vehicle.vin}`
      );

      try {
        const vautoData = await getVAutoEvaluation(
          vautoPage,
          vehicle.vin,
          vehicle.mileage
        );

        if (vautoData) {
          // Find the vehicle in the main array and update it
          const vehicleIndex = vehicles.findIndex((v) => v.vin === vehicle.vin);
          if (vehicleIndex !== -1) {
            vehicles[vehicleIndex].vautoData = vautoData;
            vehicles[vehicleIndex].vautoEnriched = true;
            vehicles[vehicleIndex].vautoEnrichedAt = new Date().toISOString();
          }
          successCount++;
          console.log(`✅ Successfully enriched VIN: ${vehicle.vin}`);
        } else {
          failCount++;
          console.log(`❌ Failed to enrich VIN: ${vehicle.vin}`);
        }

        // Save progress every 5 vehicles
        if ((i + 1) % 5 === 0) {
          saveJSON("./data/vehicles.json", vehicles);
          console.log(
            `💾 Progress saved (${i + 1}/${vehiclesToProcess.length} processed)`
          );
        }

        // Add delay between requests to avoid rate limiting
        await sleep(2000);
      } catch (error) {
        failCount++;
        console.error(`❌ Error processing VIN ${vehicle.vin}:`, error.message);
      }
    }

    // Final save
    saveJSON("./data/vehicles.json", vehicles);

    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);

    console.log(`✅ vAuto enrichment completed in ${duration} seconds`);
    console.log(`📊 Results: ${successCount} successful, ${failCount} failed`);

    return {
      vehicles,
      summary: {
        total: successCount + failCount,
        successful: successCount,
        failed: failCount,
      },
    };
  } catch (error) {
    if (error.message && error.message.includes("cancelled")) {
      console.log("🛑 vAuto enrichment was cancelled");

      // Save whatever we got so far if we have any vehicles
      if (vehicles && vehicles.length > 0) {
        saveJSON("./data/vehicles_cancelled.json", vehicles);
        console.log(`💾 Partial data saved to: vehicles_cancelled.json`);

        const enrichedCount = vehicles.filter((v) => v.vautoData).length;
        return {
          vehicles,
          cancelled: true,
          summary: {
            total: vehicles.length,
            successful: enrichedCount,
            failed: vehicles.length - enrichedCount,
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

module.exports = {
  enrichVehiclesWithVAuto,
};
