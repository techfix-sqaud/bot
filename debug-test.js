require("dotenv").config();

async function debugTest() {
  console.log("🔍 Debug Test - Environment Variables");
  console.log("=====================================");

  // Check all environment variables
  console.log("Environment variables:");
  console.log(
    `VAUTO_USER: ${
      process.env.VAUTO_USER
        ? "✅ Set (" + process.env.VAUTO_USER.substring(0, 3) + "***)"
        : "❌ Not set"
    }`
  );
  console.log(
    `VAUTO_PASSWORD: ${
      process.env.VAUTO_PASSWORD
        ? "✅ Set (" + "*".repeat(process.env.VAUTO_PASSWORD.length) + ")"
        : "❌ Not set"
    }`
  );

  if (!process.env.VAUTO_USER || !process.env.VAUTO_PASSWORD) {
    console.log("\n❌ Missing credentials! Check your .env file.");
    return;
  }

  console.log("\n🔍 Testing basic browser functionality...");

  try {
    const puppeteer = require("puppeteer");
    const browser = await puppeteer.launch({
      headless: false, // Show browser for debugging
      userDataDir: "./user_data",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    console.log("✅ Browser launched successfully");
    console.log("🌐 Navigating to vAuto...");

    await page.goto("https://www2.vauto.com/genius/platform/quickvin", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    console.log("✅ Page loaded successfully");

    // Check page content
    const title = await page.title();
    console.log(`📄 Page title: ${title}`);

    const pageContent = await page.evaluate(() => document.body.textContent);
    console.log(
      `📝 Page contains "Sign in": ${pageContent.includes("Sign in to vAuto")}`
    );

    // Take a screenshot for debugging
    await page.screenshot({ path: "debug-vauto-page.png", fullPage: true });
    console.log("📸 Screenshot saved as debug-vauto-page.png");

    // Wait 5 seconds so you can see the page
    console.log("⏱️ Waiting 5 seconds for manual inspection...");
    await page.waitForTimeout(5000);

    await browser.close();
    console.log("✅ Browser closed successfully");
  } catch (error) {
    console.error("❌ Browser test failed:", error.message);
  }
}

debugTest();
