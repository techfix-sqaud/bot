#!/usr/bin/env node

/**
 * Test script to verify browser detection and launch functionality
 */

const config = require("./src/config");

async function testBrowserDetection() {
  console.log("🔍 Testing browser detection...\n");

  // Test the browser detection function directly
  const detectedPath = config.findChromiumExecutable();

  if (detectedPath) {
    console.log(`✅ Browser executable found at: ${detectedPath}`);
  } else {
    console.log(
      "⚠️  No browser executable found. Puppeteer will download bundled Chromium."
    );
  }

  console.log("\n🚀 Testing browser launch...");

  try {
    const puppeteer = require("puppeteer");
    const browser = await puppeteer.launch(
      config.getPuppeteerOptions({
        headless: true, // Use headless for testing
      })
    );

    console.log("✅ Browser launched successfully!");

    const version = await browser.version();
    console.log(`📋 Browser version: ${version}`);

    // Test basic page creation
    const page = await browser.newPage();
    await page.goto("https://www.google.com", {
      waitUntil: "networkidle2",
      timeout: 10000,
    });
    const title = await page.title();
    console.log(`📄 Page title: ${title}`);

    await browser.close();
    console.log("✅ Browser test completed successfully!");
  } catch (error) {
    console.error("❌ Browser test failed:", error.message);
    process.exit(1);
  }
}

// Run the test
testBrowserDetection().catch(console.error);
