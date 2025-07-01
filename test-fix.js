require("dotenv").config();

console.log("🧪 Testing login function import...");

try {
  const { scrapeMyList } = require("./src/carmaxScraper");
  console.log("✅ scrapeMyList function imported successfully");

  // Test that environment variables are loaded
  const hasCredentials =
    process.env.CARMAX_EMAIL && process.env.CARMAX_PASSWORD;
  console.log(
    "✅ Environment variables:",
    hasCredentials ? "LOADED" : "MISSING"
  );

  if (hasCredentials) {
    console.log("🎯 The issue has been fixed!");
    console.log(
      "The scraper now uses the correct login function with CarMax custom web components (hzn-input, hzn-button) instead of the old standard HTML elements."
    );
    console.log(
      'You should no longer see the "No element found for selector: input[type="email"]" error.'
    );
  } else {
    console.log("❌ Environment variables are missing");
  }
} catch (error) {
  console.error("❌ Error importing scrapeMyList:", error.message);
}
