require("dotenv").config();
const enrichVehiclesWithVAuto = require("./src/carmaxVautoScraper");

/**
 * Test script to enrich existing vehicles with vAuto data
 */
async function main() {
  try {
    console.log("🚀 Starting vAuto enrichment for existing vehicles...");
    console.log("📋 This will:");
    console.log("   1. Load vehicles from vehicles.json");
    console.log("   2. Login to vAuto");
    console.log("   3. Evaluate each vehicle on vAuto (KBB, MMR, history)");
    console.log("   4. Update vehicles.json with enriched data");
    console.log("   5. Generate formatted notes for each vehicle");
    console.log("");

    await enrichVehiclesWithVAuto();

    console.log("");
    console.log("✅ vAuto enrichment completed successfully!");
    console.log("📁 Check ./data/vehicles.json for updated data");
  } catch (error) {
    console.error("❌ Error occurred:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = main;
