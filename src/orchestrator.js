const scrapeAuctions = require("./carmaxScraper");
const annotateUser = require("./vautoAnnotator");
const { exportData, getMostRecentFile } = require("./utils");

/**
 * Main orchestrator that handles the complete workflow:
 * 1. Scrape CarMax auctions (generates date-based JSON)
 * 2. Run vAuto annotation on the scraped data
 * 3. Export results in requested format
 */
class VehicleDataOrchestrator {
  constructor() {
    this.defaultExportFormat = "xlsx";
  }

  /**
   * Run complete workflow: scrape + annotate + export
   * @param {Object} options - Configuration options
   */
  async runCompleteWorkflow(options = {}) {
    const {
      user,
      skipScraping = false,
      exportFormat = this.defaultExportFormat,
      exportFilename = null,
    } = options;

    console.log("🚀 Starting complete vehicle data workflow...");
    console.log(`📊 Export format: ${exportFormat.toUpperCase()}`);

    let vehicleFile = null;
    let scrapingResults = null;

    try {
      // Step 1: Scrape CarMax auctions (unless skipped)
      if (!skipScraping) {
        console.log("\n📡 STEP 1: Scraping CarMax auctions...");
        scrapingResults = await scrapeAuctions();
        vehicleFile = scrapingResults.filename;
        console.log(
          `✅ Scraping completed. Found ${scrapingResults.vehicles.length} vehicles`
        );
      } else {
        console.log("\n⏭️ STEP 1: Skipping scraping, using existing data...");
        vehicleFile = getMostRecentFile("vehicles");
        if (!vehicleFile) {
          throw new Error(
            "No existing vehicle data found. Run scraping first or provide a vehicle file."
          );
        }
        console.log(`📂 Using existing file: ${vehicleFile}`);
      }

      // Step 2: vAuto annotation (if user provided)
      if (user && user.vins && user.vins.length > 0) {
        console.log("\n🔍 STEP 2: Running vAuto annotation...");
        const annotationResults = await annotateUser(user, {
          inputFile: vehicleFile,
          exportFormat,
          exportFilename,
        });

        console.log("✅ Complete workflow finished successfully!");
        console.log("\n📋 Final Summary:");
        console.log(`📁 JSON file: ${annotationResults.jsonFile}`);
        if (annotationResults.exportFile) {
          console.log(`📊 Export file: ${annotationResults.exportFile}`);
        }
        console.log(
          `📈 Vehicles processed: ${annotationResults.summary.total}`
        );
        console.log(`✅ Successful: ${annotationResults.summary.successful}`);
        console.log(`❌ Failed: ${annotationResults.summary.failed}`);

        return annotationResults;
      } else {
        console.log(
          "\n⏭️ STEP 2: No user VINs provided, skipping vAuto annotation..."
        );

        // Just export the scraped data in requested format
        if (exportFormat !== "json") {
          console.log(
            `\n📊 Exporting scraped data to ${exportFormat.toUpperCase()}...`
          );
          const vehicles = scrapingResults
            ? scrapingResults.vehicles
            : require("./utils").loadJSON(vehicleFile);
          const exportFile = exportData(
            vehicles,
            "vehicles_scraped",
            exportFormat
          );

          return {
            vehicles,
            jsonFile: vehicleFile,
            exportFile,
            summary: {
              total: vehicles.length,
              successful: vehicles.length,
              failed: 0,
            },
          };
        }

        return {
          vehicles: scrapingResults
            ? scrapingResults.vehicles
            : require("./utils").loadJSON(vehicleFile),
          jsonFile: vehicleFile,
          summary: {
            total: scrapingResults ? scrapingResults.vehicles.length : 0,
            successful: scrapingResults ? scrapingResults.vehicles.length : 0,
            failed: 0,
          },
        };
      }
    } catch (error) {
      console.error("❌ Workflow failed:", error.message);
      throw error;
    }
  }

  /**
   * Run only vAuto annotation on existing data
   * @param {Object} user - User object with VINs
   * @param {Object} options - Annotation options
   */
  async runAnnotationOnly(user, options = {}) {
    const {
      inputFile = null,
      exportFormat = this.defaultExportFormat,
      exportFilename = null,
    } = options;

    console.log("🔍 Running vAuto annotation only...");

    const results = await annotateUser(user, {
      inputFile,
      exportFormat,
      exportFilename,
    });

    console.log("✅ Annotation completed!");
    return results;
  }

  /**
   * Export existing data to different format
   * @param {string} inputFile - Path to JSON file
   * @param {string} exportFormat - Export format (xlsx, csv, xls)
   * @param {string} baseName - Base name for output file
   */
  async exportExistingData(
    inputFile = null,
    exportFormat = "xlsx",
    baseName = "vehicles_export"
  ) {
    console.log(`📊 Exporting data to ${exportFormat.toUpperCase()}...`);

    const dataFile = inputFile || getMostRecentFile("vehicles");
    if (!dataFile) {
      throw new Error("No data file found to export");
    }

    const data = require("./utils").loadJSON(dataFile);
    if (!data || data.length === 0) {
      throw new Error("No data found in the file");
    }

    const exportFile = exportData(data, baseName, exportFormat);

    console.log(`✅ Export completed: ${exportFile}`);
    console.log(`📈 Exported ${data.length} records`);

    return {
      sourceFile: dataFile,
      exportFile,
      recordCount: data.length,
    };
  }

  /**
   * List available data files
   */
  listAvailableFiles() {
    const fs = require("fs");
    const path = require("path");

    const dataDir = "./data";
    if (!fs.existsSync(dataDir)) {
      console.log("📁 No data directory found");
      return [];
    }

    const files = fs
      .readdirSync(dataDir)
      .filter((file) => file.endsWith(".json"))
      .map((file) => ({
        name: file,
        path: path.join(dataDir, file),
        size: fs.statSync(path.join(dataDir, file)).size,
        modified: fs.statSync(path.join(dataDir, file)).mtime,
      }))
      .sort((a, b) => b.modified - a.modified);

    console.log("📁 Available data files:");
    files.forEach((file, index) => {
      console.log(
        `${index + 1}. ${file.name} (${Math.round(
          file.size / 1024
        )}KB, ${file.modified.toLocaleDateString()})`
      );
    });

    return files;
  }

  /**
   * Run only CarMax scraping
   */
  async runCarmaxOnly() {
    console.log("🚗 Running CarMax scraping only...");

    const scrapeAuctions = require("./carmaxScraper");
    const results = await scrapeAuctions();

    console.log(
      `✅ CarMax scraping completed. Found ${results.vehicles.length} vehicles`
    );
    console.log(`📁 Saved to: ${results.filename}`);

    return {
      vehicles: results.vehicles,
      jsonFile: results.filename,
      summary: {
        total: results.vehicles.length,
        successful: results.vehicles.length,
        failed: 0,
      },
    };
  }

  /**
   * Run vAuto annotation on the latest vehicle file
   */
  async runVautoOnLatest() {
    console.log("🔍 Running vAuto annotation on latest file...");

    // Get the most recent file
    const latestFile = getMostRecentFile("vehicles");
    if (!latestFile) {
      throw new Error("No vehicle data files found for vAuto processing");
    }

    console.log(`📂 Using latest file: ${latestFile}`);

    // Load vehicles from the file
    const vehicles = require("./utils").loadJSON(latestFile);
    if (!vehicles || vehicles.length === 0) {
      console.error("❌ No vehicle data found in the latest file", vehicles);
      throw new Error("No vehicle data found in the latest file");
    }

    // Create a user object with all VINs from the file
    const vins = vehicles.map((v) => v.vin || v.VIN).filter((vin) => vin);
    if (vins.length === 0) {
      console.error("❌ Sample vehicle data:", vehicles[0]);
      throw new Error(
        "No VINs found in the vehicle data. Check VIN field naming."
      );
    }

    console.log(`🎯 Processing ${vins.length} VINs with vAuto...`);

    const user = {
      email: "system@automated.com",
      vins: vins,
    };

    const annotateUser = require("./vautoAnnotator");
    const results = await annotateUser(user, {
      inputFile: latestFile,
      exportFormat: "json",
    });

    console.log("✅ vAuto annotation completed!");
    return results;
  }
}

module.exports = VehicleDataOrchestrator;
