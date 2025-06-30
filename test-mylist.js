#!/usr/bin/env node

/**
 * Test script for the new My List scraping functionality
 */

const { scrapeMyList } = require("./src/carmaxScraper");

async function testMyListScraping() {
  console.log("🧪 Testing My List scraping functionality...");

  try {
    console.log("📋 Starting My List scrape test...");
    const result = await scrapeMyList();

    console.log("\n✅ Test completed successfully!");
    console.log("📊 Results:");
    console.log(`- Total vehicles: ${result.summary.total}`);
    console.log(`- Successful: ${result.summary.successful}`);
    console.log(`- Failed: ${result.summary.failed}`);

    if (result.filename) {
      console.log(`- File saved: ${result.filename}`);
    }

    if (result.vehicles && result.vehicles.length > 0) {
      console.log("\n📝 Sample vehicle data:");
      console.log(JSON.stringify(result.vehicles[0], null, 2));
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  testMyListScraping();
}

module.exports = { testMyListScraping };
