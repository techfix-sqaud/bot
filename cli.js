#!/usr/bin/env node

/**
 * CLI interface for CarMax-vAuto Vehicle Enrichment Bot
 * Production-ready automation tool
 */

const { program } = require("commander");
const { loadJSON } = require("./src/utils");
require("dotenv").config();

// Import clean services
const { scrapeMyList } = require("./src/scrapers/carmax-mylist-scraper");
const { enrichVehiclesWithVAuto } = require("./src/services/vauto-enrichment");
const { runCompleteWorkflow } = require("./src/services/workflow");

program
  .name("carmax-vauto-bot")
  .description("CarMax to vAuto Vehicle Enrichment Bot")
  .version("1.0.0");

// CarMax My List scraping command
program
  .command("carmax")
  .description("Scrape vehicle data from CarMax My List")
  .option("--testing-browser", "Show browser window for testing/debugging")
  .action(async (options) => {
    console.log("🚀 Starting CarMax My List scraping...");

    // Set environment variable for testing browser if flag is provided
    if (options.testingBrowser) {
      process.env.TESTING_BROWSER = "true";
      console.log("🔍 Testing browser mode enabled - browser will be visible");
    }

    try {
      await scrapeMyList();
      console.log("✅ CarMax My List scraping completed!");
    } catch (error) {
      console.error("❌ CarMax My List scraping failed:", error.message);
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
        console.log("💡 Try: npm run carmax");
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
  .description("Run complete workflow: CarMax My List + vAuto enrichment")
  .option("--testing-browser", "Show browser window for testing/debugging")
  .action(async (options) => {
    console.log("🚀 Starting complete workflow...");

    // Set environment variable for testing browser if flag is provided
    if (options.testingBrowser) {
      process.env.TESTING_BROWSER = "true";
      console.log("🔍 Testing browser mode enabled - browser will be visible");
    }

    try {
      await runCompleteWorkflow();
      console.log("✅ Complete workflow finished successfully!");
    } catch (error) {
      console.error("❌ Complete workflow failed:", error.message);
      process.exit(1);
    }
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
    } catch (error) {
      console.log("   No vehicle data found");
    }
  });

// Parse CLI arguments
program.parse();

// Show help if no command provided
if (process.argv.length <= 2) {
  console.log("🚀 CarMax-vAuto Vehicle Enrichment Bot");
  console.log("\nQuick Start:");
  console.log("  npm run mylist     # Scrape My List");
  console.log("  npm run auctions   # Scrape All Auctions");
  console.log("  npm run scrape     # Complete workflow");
  console.log("\nTesting/Debugging:");
  console.log(
    "  node cli.js carmax --testing-browser    # Show browser window"
  );
  console.log(
    "  node cli.js complete --testing-browser  # Show browser for complete workflow"
  );
  console.log("\nFor more options run: node cli.js --help");
}
