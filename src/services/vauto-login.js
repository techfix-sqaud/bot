/**
 * vAuto Login Service
 * Handles login to vAuto with environment credentials and 2FA
 */

const config = require("../config");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Login to vAuto
 * @param {Page} page - Puppeteer page instance
 */
async function loginToVAuto(page) {
  console.log("🔐 Logging into vAuto...");

  try {
    await page.goto(config.vautoUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    const vautoUsername = process.env.VAUTO_USERNAME;
    const vautoPassword = process.env.VAUTO_PASSWORD;

    if (!vautoUsername || !vautoPassword) {
      throw new Error("Missing vAuto credentials in environment variables");
    }

    // Enter username
    await page.waitForSelector("#Email", { timeout: 10000 });
    await page.type("#Email", vautoUsername, { delay: 100 });

    // Enter password
    await page.waitForSelector("#Password", { timeout: 10000 });
    await page.type("#Password", vautoPassword, { delay: 100 });

    // Click sign in
    await page.waitForSelector("#signIn", { timeout: 10000 });
    await page.click("#signIn");

    // Wait for potential 2FA or login completion
    await sleep(3000);

    // Check if 2FA is required
    const needsTwoFactor = await page.evaluate(() => {
      const pageContent = document.body?.textContent?.toLowerCase() || "";
      return (
        pageContent.includes("verification") ||
        pageContent.includes("two-factor") ||
        pageContent.includes("authenticator") ||
        pageContent.includes("enter code") ||
        document.querySelector('input[type="text"][maxlength="6"]') !== null ||
        document.querySelector("#verification-code") !== null
      );
    });

    if (needsTwoFactor) {
      console.log("🔐 2FA required for vAuto login");

      if (config.show2FA) {
        console.log("⏳ Please complete 2FA in the browser...");
        console.log("⏳ Waiting for 2FA completion (up to 2 minutes)...");

        // Wait for 2FA completion with timeout
        let twoFactorCompleted = false;
        const maxWaitTime = 120000; // 2 minutes
        const checkInterval = 2000; // 2 seconds
        let elapsedTime = 0;

        while (!twoFactorCompleted && elapsedTime < maxWaitTime) {
          await sleep(checkInterval);
          elapsedTime += checkInterval;

          // Check if we've moved past 2FA
          twoFactorCompleted = await page.evaluate(() => {
            const pageContent = document.body?.textContent?.toLowerCase() || "";
            return (
              !pageContent.includes("verification") &&
              !pageContent.includes("enter code") &&
              !document.querySelector('input[type="text"][maxlength="6"]') &&
              !document.querySelector("#verification-code")
            );
          });

          if (twoFactorCompleted) {
            console.log("✅ 2FA completed successfully");
            break;
          }
        }

        if (!twoFactorCompleted) {
          throw new Error(
            "2FA timeout - please complete verification within 2 minutes"
          );
        }
      } else {
        throw new Error(
          "2FA required but show2FA is disabled. Please enable show2FA in config."
        );
      }
    }

    // Wait for login completion
    try {
      await page.waitForNavigation({
        waitUntil: "networkidle2",
        timeout: 15000,
      });
    } catch {
      // Navigation might not trigger, check for successful login
      const isLoggedIn = await page.evaluate(() => {
        const url = window.location.href.toLowerCase();
        const pageContent = document.body?.textContent?.toLowerCase() || "";
        return (
          !url.includes("login") &&
          !pageContent.includes("sign in") &&
          !pageContent.includes("invalid credentials")
        );
      });

      if (!isLoggedIn) {
        throw new Error("Login failed - still on login page");
      }
    }

    console.log("✅ vAuto login completed successfully");
  } catch (error) {
    console.error("❌ vAuto login failed:", error.message);
    throw error;
  }
}

module.exports = {
  loginToVAuto,
};
