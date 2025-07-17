/**
 * CarMax Login Module
 * Handles login to CarMax with environment credentials
 */

const config = require("../config");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Login to CarMax
 * @param {Page} page - Puppeteer page instance
 */
async function login(page) {
  console.log("🔐 Logging into CarMax...");

  try {
    await page.goto(config.carmaxUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Wait for and click the login button
    await page.waitForSelector("hzn-button", { timeout: 10000 });
    await page.evaluate(() => {
      const btn = document.querySelector("hzn-button");
      if (btn && btn.shadowRoot) {
        btn.shadowRoot.querySelector("button").click();
      }
    });

    // Wait for email input and enter credentials
    await page.waitForSelector('input[type="email"]', {
      visible: true,
      timeout: 10000,
    });

    const carmaxEmail = process.env.CARMAX_EMAIL;
    const carmaxPassword = process.env.CARMAX_PASSWORD;

    if (!carmaxEmail || !carmaxPassword) {
      throw new Error("Missing CarMax credentials in environment variables");
    }

    // Enter email using shadow DOM
    await page.evaluate((email) => {
      const inp = document.querySelector('input[type="email"]');
      if (inp.shadowRoot) {
        const shadowInput = inp.shadowRoot.querySelector("input");
        shadowInput.value = email;
        shadowInput.dispatchEvent(new Event("input", { bubbles: true }));
        shadowInput.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        inp.value = email;
        inp.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }, carmaxEmail);

    // Click continue with email
    await page.waitForSelector("hzn-button#continueWithEmail", {
      timeout: 10000,
    });
    await page.evaluate(() => {
      const continueBtn = document.querySelector(
        "hzn-button#continueWithEmail"
      );
      if (continueBtn && continueBtn.shadowRoot) {
        continueBtn.shadowRoot.querySelector("button").click();
      }
    });

    await sleep(4000);

    // Enter password
    await page.type("#password", carmaxPassword, { delay: 100 });

    // Click continue
    await page.waitForSelector("hzn-button#continue", { timeout: 10000 });
    await page.evaluate(() => {
      const continueBtn = document.querySelector("hzn-button#continue");
      if (continueBtn && continueBtn.shadowRoot) {
        continueBtn.shadowRoot.querySelector("button").click();
      }
    });

    // Wait for login to complete
    try {
      await page.waitForNavigation({
        waitUntil: "networkidle2",
        timeout: 20000,
      });
    } catch {
      // Try alternative navigation wait
      await page.waitForNavigation({
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });
    }

    console.log("✅ CarMax login completed successfully");
  } catch (error) {
    console.error("❌ CarMax login failed:", error.message);
    throw error;
  }
}

/**
 * Login with retry mechanism
 * @param {Page} page - Puppeteer page instance
 * @param {number} maxRetries - Maximum number of retry attempts
 */
async function loginWithRetry(page, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Login attempt ${attempt}/${maxRetries}`);
      await login(page);
      return; // Success
    } catch (error) {
      console.error(`❌ Login attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        throw new Error(`Failed to login after ${maxRetries} attempts`);
      }

      console.log(`⏳ Retrying in 5 seconds...`);
      await sleep(5000);
    }
  }
}

module.exports = {
  login,
  loginWithRetry,
};
