#!/usr/bin/env node

require("dotenv").config();
const VehicleDataOrchestrator = require("./src/orchestrator");

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  skipScraping: false,
  exportFormat: "xlsx",
  exportFilename: null,
  user: null,
  command: "workflow",
};

// Parse arguments
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case "--skip-scraping":
    case "-s":
      options.skipScraping = true;
      break;
    case "--format":
    case "-f":
      if (i + 1 < args.length) {
        options.exportFormat = args[++i].toLowerCase();
      }
      break;
    case "--output":
    case "-o":
      if (i + 1 < args.length) {
        options.exportFilename = args[++i];
      }
      break;
    case "--vins":
    case "-v":
      if (i + 1 < args.length) {
        const vins = args[++i].split(",").map((vin) => vin.trim());
        options.user = {
          email: "cli-user@example.com",
          vins: vins,
        };
      }
      break;
    case "list":
      options.command = "list";
      break;
    case "export":
      options.command = "export";
      break;
    case "annotate":
      options.command = "annotate";
      break;
    case "help":
    case "--help":
    case "-h":
      showHelp();
      process.exit(0);
      break;
  }
}

function showHelp() {
  console.log(`
🚗 Vehicle Data Processing CLI

USAGE:
  node cli.js [command] [options]

COMMANDS:
  (default)    Run complete workflow (scrape + annotate + export)
  list         List available data files
  export       Export existing data to different format
  annotate     Run vAuto annotation only

OPTIONS:
  -s, --skip-scraping     Skip CarMax scraping, use existing data
  -f, --format FORMAT     Export format: xlsx, csv, xls, json (default: xlsx)
  -o, --output FILE       Output filename (auto-generated if not specified)
  -v, --vins VINS         Comma-separated VINs for vAuto annotation
  -h, --help              Show this help message

EXAMPLES:
  # Complete workflow with Excel export
  node cli.js

  # Skip scraping, export existing data as CSV
  node cli.js --skip-scraping --format csv

  # Annotate specific VINs and export as Excel
  node cli.js --vins "1HGBH41JXMN109186,2HGFA16506H000001" --format xlsx

  # List available data files
  node cli.js list

  # Export latest data as CSV
  node cli.js export --format csv

  # Run annotation only
  node cli.js annotate --vins "1HGBH41JXMN109186"

SUPPORTED FORMATS:
  xlsx  - Excel 2007+ format (default)
  xls   - Excel 97-2003 format
  csv   - Comma-separated values
  json  - JSON format
`);
}

async function main() {
  try {
    const orchestrator = new VehicleDataOrchestrator();

    console.log("🚗 Vehicle Data Processing CLI");
    console.log("=".repeat(40));

    switch (options.command) {
      case "list":
        orchestrator.listAvailableFiles();
        break;

      case "export":
        if (!["xlsx", "csv", "xls", "json"].includes(options.exportFormat)) {
          console.error(`❌ Unsupported format: ${options.exportFormat}`);
          console.log("Supported formats: xlsx, csv, xls, json");
          process.exit(1);
        }
        const exportResults = await orchestrator.exportExistingData(
          null,
          options.exportFormat,
          "vehicles_export"
        );
        console.log(`✅ Export completed: ${exportResults.exportFile}`);
        break;

      case "annotate":
        if (!options.user || !options.user.vins.length) {
          console.error("❌ VINs required for annotation. Use --vins option.");
          process.exit(1);
        }
        const annotationResults = await orchestrator.runAnnotationOnly(
          options.user,
          {
            exportFormat: options.exportFormat,
            exportFilename: options.exportFilename,
          }
        );
        console.log("✅ Annotation completed!");
        console.log(`📁 JSON: ${annotationResults.jsonFile}`);
        if (annotationResults.exportFile) {
          console.log(`📊 Export: ${annotationResults.exportFile}`);
        }
        break;

      default: // workflow
        if (!["xlsx", "csv", "xls", "json"].includes(options.exportFormat)) {
          console.error(`❌ Unsupported format: ${options.exportFormat}`);
          console.log("Supported formats: xlsx, csv, xls, json");
          process.exit(1);
        }

        console.log("📋 Configuration:");
        console.log(`📊 Export format: ${options.exportFormat.toUpperCase()}`);
        console.log(`🔄 Skip scraping: ${options.skipScraping ? "Yes" : "No"}`);
        console.log(
          `👤 Process vAuto: ${
            options.user ? "Yes (" + options.user.vins.length + " VINs)" : "No"
          }`
        );

        const results = await orchestrator.runCompleteWorkflow(options);

        console.log("\n✅ Processing completed!");
        console.log("\n📄 Files created:");
        console.log(`📁 JSON: ${results.jsonFile}`);
        if (results.exportFile) {
          console.log(`📊 Export: ${results.exportFile}`);
        }

        if (results.summary) {
          console.log(
            `\n📊 Summary: ${results.summary.successful}/${results.summary.total} successful`
          );
        }
        break;
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = { main, showHelp };
