#!/usr/bin/env node

/**
 * Example script showing different ways to use the Vehicle Data Processing Bot
 */

require("dotenv").config();
const VehicleDataOrchestrator = require("./src/orchestrator");

async function runExamples() {
  const orchestrator = new VehicleDataOrchestrator();

  console.log("🚗 Vehicle Data Processing Examples");
  console.log("=".repeat(50));

  try {
    // Example 1: List available files
    console.log("\n📁 Example 1: List available data files");
    console.log("-".repeat(30));
    orchestrator.listAvailableFiles();

    // Example 2: Complete workflow without vAuto (just scraping and export)
    console.log("\n🔄 Example 2: Scrape and export to Excel (no vAuto)");
    console.log("-".repeat(30));
    const scrapeResults = await orchestrator.runCompleteWorkflow({
      user: null, // No vAuto processing
      skipScraping: false,
      exportFormat: "xlsx",
    });
    console.log(`✅ Created: ${scrapeResults.exportFile}`);

    // Example 3: Export existing data to different formats
    console.log("\n📊 Example 3: Export existing data to CSV");
    console.log("-".repeat(30));
    const csvExport = await orchestrator.exportExistingData(
      scrapeResults.jsonFile,
      "csv",
      "vehicles_csv_export"
    );
    console.log(`✅ CSV created: ${csvExport.exportFile}`);

    // Example 4: vAuto annotation with sample VINs
    console.log("\n🔍 Example 4: vAuto annotation (you'll need real VINs)");
    console.log("-".repeat(30));
    console.log(
      "To run vAuto annotation, update the VINs below with real ones from your scraped data:"
    );

    const sampleUser = {
      email: "example@example.com",
      vins: [
        // "1HGBH41JXMN109186",  // Uncomment and add real VINs
        // "2HGFA16506H000001"   // from your scraped data
      ],
    };

    if (sampleUser.vins.length > 0) {
      const annotationResults = await orchestrator.runAnnotationOnly(
        sampleUser,
        {
          inputFile: scrapeResults.jsonFile,
          exportFormat: "xlsx",
        }
      );
      console.log(`✅ Annotated data: ${annotationResults.exportFile}`);
    } else {
      console.log("⏭️ Skipping vAuto annotation - no VINs provided");
      console.log(
        "   To test this, add real VINs to the sampleUser.vins array above"
      );
    }
  } catch (error) {
    console.error("❌ Example failed:", error.message);
  }
}

// Command line usage
const command = process.argv[2];

switch (command) {
  case "quick":
    // Quick test - just scrape and export
    (async () => {
      try {
        const orchestrator = new VehicleDataOrchestrator();
        console.log("🚀 Quick test: Scrape and export to Excel...");

        const results = await orchestrator.runCompleteWorkflow({
          user: null,
          skipScraping: false,
          exportFormat: "xlsx",
        });

        console.log("✅ Quick test completed!");
        console.log(`📊 Excel file: ${results.exportFile}`);
      } catch (error) {
        console.error("❌ Quick test failed:", error.message);
      }
    })();
    break;

  case "export-only":
    // Export existing data only
    (async () => {
      try {
        const orchestrator = new VehicleDataOrchestrator();
        console.log("📊 Export test: Converting latest data to Excel...");

        const results = await orchestrator.exportExistingData(null, "xlsx");
        console.log("✅ Export completed!");
        console.log(`📊 Excel file: ${results.exportFile}`);
      } catch (error) {
        console.error("❌ Export test failed:", error.message);
      }
    })();
    break;

  case "list":
    // List files only
    (async () => {
      const orchestrator = new VehicleDataOrchestrator();
      orchestrator.listAvailableFiles();
    })();
    break;

  default:
    // Run all examples
    runExamples();
    break;
}

console.log(`
📝 Usage:
  node examples.js           # Run all examples
  node examples.js quick     # Quick scrape and export test
  node examples.js export-only # Export existing data only
  node examples.js list      # List available files
`);
