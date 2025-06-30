const { scrapeMyList } = require("./src/carmaxScraper");

async function testMyListScraping() {
  console.log("🚀 Testing My List scraping...");

  try {
    const result = await scrapeMyList();

    console.log("✅ My List scraping completed successfully!");
    console.log("📊 Summary:", result.summary);

    if (result.filename) {
      console.log(`📁 Data saved to: ${result.filename}`);
    }

    if (result.annotatedFilename) {
      console.log(`📝 Annotated data saved to: ${result.annotatedFilename}`);
    }

    if (result.vehicles && result.vehicles.length > 0) {
      console.log("🚗 Sample vehicle data:");
      console.log(JSON.stringify(result.vehicles[0], null, 2));
    }
  } catch (error) {
    console.error("❌ Error testing My List scraping:", error.message);
  }
}

// Run the test
testMyListScraping();
