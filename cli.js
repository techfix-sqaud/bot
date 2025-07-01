#!/usr/bin/env node

/**
 * CLI interface for vAuto Vehicle Enrichment Bot
 * Supports multiple commands and modes as described in README
 */

const { program } = require("commander");
const { loadJSON } = require("./src/utils");
require("dotenv").config();

// Import scrapers
const enrichVehiclesWithVAuto = require("./src/carmaxVautoScraper");

program
  .name("vauto-bot")
  .description("vAuto Vehicle Enrichment Bot CLI")
  .version("1.0.0");

// CarMax scraping command
program
  .command("carmax")
  .description("Scrape vehicle data from CarMax")
  .option(
    "-m, --mode <mode>",
    'scraping mode: "auctions" or "mylist"',
    "auctions"
  )
  .action(async (options) => {
    console.log(`🚀 Starting CarMax scraping in ${options.mode} mode...`);

    try {
      if (options.mode === "mylist") {
        await scrapeMyList();
      } else if (options.mode === "auctions") {
        const carmaxScraper = require("./src/carmaxScraper");
        await carmaxScraper.scrapeAuctions();
      } else {
        console.error('❌ Invalid mode. Use "auctions" or "mylist"');
        process.exit(1);
      }

      console.log("✅ CarMax scraping completed!");
    } catch (error) {
      console.error("❌ CarMax scraping failed:", error.message);
      process.exit(1);
    }
  });

// vAuto enrichment command
program
  .command("vauto")
  .description("Enrich existing vehicles with vAuto evaluation data")
  .action(async () => {
    console.log("🚀 Starting vAuto enrichment...");

    try {
      // Check if vehicles exist
      const vehicles = loadJSON("./data/vehicles.json");
      if (vehicles.length === 0) {
        console.error(
          "❌ No vehicles found. Please run CarMax scraping first."
        );
        console.log("💡 Try: npm run scrape or node cli.js carmax");
        process.exit(1);
      }

      console.log(`📋 Found ${vehicles.length} vehicles to process`);
      await enrichVehiclesWithVAuto();
      console.log("✅ vAuto enrichment completed!");
    } catch (error) {
      console.error("❌ vAuto enrichment failed:", error.message);
      process.exit(1);
    }
  });

// Complete workflow command
program
  .command("complete")
  .description("Run complete workflow: CarMax scraping + vAuto enrichment")
  .option(
    "-m, --mode <mode>",
    'CarMax scraping mode: "auctions" or "mylist"',
    "auctions"
  )
  .action(async (options) => {
    console.log(`🚀 Starting complete workflow with ${options.mode} mode...`);

    try {
      // Step 1: CarMax scraping
      console.log("\n📦 Step 1: CarMax Scraping");
      if (options.mode === "mylist") {
        await scrapeMyList();
      } else {
        const carmaxScraper = require("./src/carmaxScraper");
        await carmaxScraper.scrapeAuctions();
      }

      // Step 2: vAuto enrichment
      console.log("\n💎 Step 2: vAuto Enrichment");
      await enrichVehiclesWithVAuto();

      console.log("\n✅ Complete workflow finished successfully!");

      // Show summary
      const vehicles = loadJSON("./data/vehicles.json");
      const enrichedCount = vehicles.filter((v) => v.vautoData).length;
      console.log(`\n📊 Summary:`);
      console.log(`   Total vehicles: ${vehicles.length}`);
      console.log(`   Enriched with vAuto: ${enrichedCount}`);
      console.log(`   Pending enrichment: ${vehicles.length - enrichedCount}`);
    } catch (error) {
      console.error("❌ Complete workflow failed:", error.message);
      process.exit(1);
    }
  });

// Web interface command
program
  .command("web")
  .description("Start web interface")
  .option("-p, --port <port>", "port number", "3000")
  .action((options) => {
    console.log("🌐 Starting web interface...");

    const WebServer = require("./src/webServer");
    const server = new WebServer();

    server.start(parseInt(options.port));
    console.log(`📱 Open your browser to: http://localhost:${options.port}`);
  });

// Status command
program
  .command("status")
  .description("Show current status and vehicle count")
  .action(() => {
    console.log("📊 Current Status:");

    try {
      const vehicles = loadJSON("./data/vehicles.json");
      const enrichedCount = vehicles.filter((v) => v.vautoData).length;
      const pendingCount = vehicles.length - enrichedCount;

      console.log(`\n📋 Vehicle Data:`);
      console.log(`   Total vehicles: ${vehicles.length}`);
      console.log(`   Enriched with vAuto: ${enrichedCount}`);
      console.log(`   Pending enrichment: ${pendingCount}`);

      if (vehicles.length > 0) {
        const latestScrape = vehicles.reduce((latest, v) => {
          const vehicleDate = new Date(v.scrapedAt || 0);
          return vehicleDate > latest ? vehicleDate : latest;
        }, new Date(0));

        console.log(`   Latest scrape: ${latestScrape.toLocaleString()}`);
      }

      // Check environment variables
      console.log(`\n🔐 Environment:`);
      console.log(
        `   vAuto credentials: ${process.env.VAUTO_USERNAME ? "✅" : "❌"}`
      );
      console.log(
        `   CarMax credentials: ${process.env.CARMAX_EMAIL ? "✅" : "❌"}`
      );
      console.log(
        `   Node environment: ${process.env.NODE_ENV || "development"}`
      );
    } catch (error) {
      console.log("   No vehicle data found");
      console.log(`   ${error.message}`);
    }
  });

// Export command
program
  .command("export")
  .description("Export vehicle data to JSON file")
  .option(
    "-o, --output <file>",
    "output filename",
    `vehicles_export_${new Date().toISOString().split("T")[0]}.json`
  )
  .action((options) => {
    console.log("📥 Exporting vehicle data...");

    try {
      const vehicles = loadJSON("./data/vehicles.json");
      const fs = require("fs");

      fs.writeFileSync(options.output, JSON.stringify(vehicles, null, 2));
      console.log(
        `✅ Exported ${vehicles.length} vehicles to: ${options.output}`
      );
    } catch (error) {
      console.error("❌ Export failed:", error.message);
      process.exit(1);
    }
  });

// Helper function for My List scraping
async function scrapeMyList() {
  console.log("🔍 Scraping CarMax My List...");

  const { scrapeMyList } = require("./src/carmaxScraper");
  return await scrapeMyList();
}

// Handle unknown commands
program.on("command:*", function (operands) {
  console.error(`❌ Unknown command: ${operands[0]}`);
  console.log("💡 Available commands:");
  console.log("   carmax --mode=auctions    # Scrape all auctions");
  console.log("   carmax --mode=mylist      # Scrape My List");
  console.log("   vauto                     # Enrich with vAuto");
  console.log("   complete --mode=auctions  # Full workflow");
  console.log("   web                       # Start web interface");
  console.log("   status                    # Show current status");
  console.log("   export                    # Export data");
  process.exit(1);
});

// Show help if no command provided
if (process.argv.length <= 2) {
  program.help();
}

program.parse();
