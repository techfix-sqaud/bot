require("dotenv").config();
const VehicleDataOrchestrator = require("./orchestrator");

// Example usage - you can modify this based on your needs
const sampleUser = {
  email: "user@example.com",
  vins: [
    // Add your VINs here, or leave empty to just scrape and export
    // "1HGBH41JXMN109186",
    // "2HGFA16506H000001"
  ],
};

(async () => {
  try {
    console.log("🚀 Starting Vehicle Data Processing...");

    const orchestrator = new VehicleDataOrchestrator();

    // Configuration options
    const options = {
      user: sampleUser.vins.length > 0 ? sampleUser : null,
      skipScraping: false, // Set to true to use existing data
      exportFormat: "xlsx", // 'xlsx', 'csv', 'xls', or 'json'
      exportFilename: null, // Leave null for auto-generated filename
    };

    console.log("\n📋 Configuration:");
    console.log(`📊 Export format: ${options.exportFormat.toUpperCase()}`);
    console.log(`🔄 Skip scraping: ${options.skipScraping ? "Yes" : "No"}`);
    console.log(`👤 Process vAuto: ${options.user ? "Yes" : "No"}`);

    // Run the complete workflow
    const results = await orchestrator.runCompleteWorkflow(options);

    console.log("\n✅ All processing completed successfully!");
    console.log("\n📄 Files created:");
    console.log(`📁 JSON: ${results.jsonFile}`);
    if (results.exportFile) {
      console.log(`📊 Export: ${results.exportFile}`);
    }
  } catch (error) {
    console.error("❌ Process failed:", error.message);
    process.exit(1);
  }
})();
