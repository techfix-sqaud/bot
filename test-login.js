require("dotenv").config();
const puppeteer = require("puppeteer");
const { vautoUrl } = require("./src/config");

/**
 * Test script for vAuto login with 2FA handling
 */
async function testVAutoLogin() {
  const browser = await puppeteer.launch({
    userDataDir: "./user_data",
    headless: false, // Always show browser for login testing
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-infobars",
      "--window-position=0,0",
      "--ignore-certificate-errors",
      "--ignore-certificate-errors-spki-list",
      "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    ],
  });

  const page = await browser.newPage();

  try {
    console.log("🔐 Testing vAuto login with 2FA handling...");

    await page.goto(vautoUrl, { waitUntil: "networkidle2" });

    const pageContent = await page.evaluate(() => document.body.textContent);

    if (!pageContent.includes("Sign in to vAuto")) {
      console.log("✅ Already logged into vAuto");
      return;
    }

    const vautoUser = process.env.VAUTO_USERNAME;
    const vautoPassword = process.env.VAUTO_PASSWORD;

    if (!vautoUser || !vautoPassword) {
      throw new Error("Missing vAuto credentials in environment variables");
    }

    console.log(`📧 Using username: ${vautoUser.substring(0, 3)}***`);

    // Enter username
    await page.waitForSelector("#username", { visible: true });
    await page.type("#username", vautoUser, { delay: 100 });
    await page.click("#signIn");

    // Enter password
    await page.waitForSelector("#password", { visible: true });
    await page.type("#password", vautoPassword, { delay: 100 });

    await new Promise((resolve) => setTimeout(resolve, 2000));
    await page.click("#signIn");

    // Check for 2FA or successful login
    try {
      console.log("🔍 Checking for login completion or 2FA requirement...");

      // Wait for either successful login navigation or 2FA prompt
      await Promise.race([
        page.waitForNavigation({ waitUntil: "networkidle0", timeout: 10000 }),
        page.waitForSelector(
          "input[type='text'][placeholder*='code'], input[name*='code'], input[id*='code'], input[class*='code']",
          { timeout: 10000 }
        ),
      ]);

      // Check if we're on the main vAuto page (successful login)
      const currentUrl = page.url();
      const pageContent = await page.evaluate(() => document.body.textContent);

      if (
        currentUrl.includes("platform") ||
        (pageContent.includes("vAuto") && !pageContent.includes("Sign in"))
      ) {
        console.log("✅ Successfully logged into vAuto without 2FA");
        return;
      }

      // Check for 2FA requirement
      const has2FA = await page.evaluate(() => {
        // Look for common 2FA indicators
        const text = document.body.textContent.toLowerCase();
        const codeInputs = document.querySelectorAll(
          "input[type='text'], input[type='number']"
        );

        return (
          text.includes("verification") ||
          text.includes("authenticator") ||
          text.includes("code") ||
          text.includes("2fa") ||
          text.includes("two-factor") ||
          codeInputs.length > 0
        );
      });

      if (has2FA) {
        console.log(
          "🔐 2FA detected! Browser is visible for manual authentication."
        );
        console.log("📱 Instructions:");
        console.log(
          "   1. Check your authenticator app or SMS for the verification code"
        );
        console.log("   2. Enter the code in the browser window");
        console.log("   3. Click submit/continue");
        console.log("   4. The script will detect completion automatically");
        console.log("");
        console.log(
          "⏳ Waiting for manual 2FA completion (timeout: 5 minutes)..."
        );

        // Bring browser window to front for easier access
        await page.bringToFront();

        // Wait for navigation after 2FA completion (with longer timeout)
        await page.waitForNavigation({
          waitUntil: "networkidle0",
          timeout: 300000, // 5 minutes for testing
        });

        console.log("✅ 2FA completed successfully!");
      }

      console.log("✅ Successfully logged into vAuto");
    } catch (error) {
      // If we timeout waiting for navigation, check if we're already logged in
      const currentUrl = page.url();
      const pageContent = await page.evaluate(() => document.body.textContent);

      if (
        currentUrl.includes("platform") ||
        (pageContent.includes("vAuto") && !pageContent.includes("Sign in"))
      ) {
        console.log("✅ Login successful (navigation timeout ignored)");
        return;
      }

      console.log("⚠️ Login process unclear, please check browser manually");
      console.log(`Current URL: ${currentUrl}`);

      // Keep browser open for manual inspection
      console.log(
        "🖥️ Browser will stay open for 30 seconds for manual inspection..."
      );
      await new Promise((resolve) => setTimeout(resolve, 30000));
    }
  } catch (error) {
    console.error("❌ Login test failed:", error.message);
  } finally {
    console.log("🔚 Closing browser...");
    await browser.close();
  }
}

if (require.main === module) {
  testVAutoLogin();
}

module.exports = testVAutoLogin;
