#!/usr/bin/env node

const config = require("./src/config.js");

console.log("🔍 Browser Detection Debug Tool\n");

console.log("Environment Variables:");
console.log(`NODE_ENV: ${process.env.NODE_ENV || "undefined"}`);
console.log(
  `PUPPETEER_EXECUTABLE_PATH: ${
    process.env.PUPPETEER_EXECUTABLE_PATH || "undefined"
  }\n`
);

console.log("Detected Browser Configuration:");
console.log(`Headless mode: ${config.puppeteerOptions.headless}`);
console.log(
  `Executable path: ${
    config.puppeteerOptions.executablePath ||
    "undefined (will use bundled Chromium)"
  }\n`
);

// Test browser launch
const puppeteer = require("puppeteer");

async function testBrowserLaunch() {
  try {
    console.log("🚀 Testing browser launch...");
    const browser = await puppeteer.launch(config.getPuppeteerOptions());
    console.log("✅ Browser launched successfully!");

    const version = await browser.version();
    console.log(`Browser version: ${version}`);

    await browser.close();
    console.log("✅ Browser closed successfully!");
  } catch (error) {
    console.error("❌ Browser launch failed:");
    console.error(error.message);

    // Try to provide helpful suggestions
    if (error.message.includes("could not find expected browser")) {
      console.log("\n💡 Suggestions:");
      console.log("1. Install Chromium: sudo apt install chromium-browser");
      console.log("2. Or install Google Chrome");
      console.log("3. Set PUPPETEER_EXECUTABLE_PATH to correct browser path");
    }
  }
}

testBrowserLaunch();
