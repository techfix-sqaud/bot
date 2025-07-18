const config = require("../config");
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function login(page, maxRetries = 3) {
  const carmaxEmail = process.env.CARMAX_EMAIL;
  const carmaxPassword = process.env.CARMAX_PASSWORD;

  if (!carmaxEmail || !carmaxPassword) {
    throw new Error("CARMAX_EMAIL or CARMAX_PASSWORD env variable is not set");
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔐 Login attempt ${attempt}`);

      // Try navigation with fallback
      try {
        await page.goto(config.carmaxUrl, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });
      } catch {
        await page.goto(config.carmaxUrl, {
          waitUntil: "domcontentloaded",
          timeout: 20000,
        });
      }

      await sleep(3000);

      // Click login button
      await page.waitForSelector("hzn-button", { timeout: 15000 });
      await page.evaluate(() => {
        const btn = document.querySelector("hzn-button");
        if (btn?.shadowRoot) {
          const inner = btn.shadowRoot.querySelector("button");
          inner?.click();
        }
      });

      // Enter email
      await page.waitForSelector("hzn-input#signInName", {
        visible: true,
        timeout: 15000,
      });
      await page.evaluate((email) => {
        const inp = document.querySelector("hzn-input#signInName");
        const i = inp?.shadowRoot?.querySelector("input");
        if (i) {
          i.value = email;
          i.dispatchEvent(new Event("input", { bubbles: true }));
          i.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }, carmaxEmail);

      // Continue with email
      await page.waitForSelector("hzn-button#continueWithEmail", {
        timeout: 10000,
      });
      await page.evaluate(() => {
        const btn = document.querySelector("hzn-button#continueWithEmail");
        const inner = btn?.shadowRoot?.querySelector("button");
        inner?.click();
      });

      await sleep(4000);

      // Enter password
      await page.waitForSelector("#password", {
        visible: true,
        timeout: 10000,
      });
      await page.type("#password", carmaxPassword, { delay: 100 });

      // Click continue
      await page.waitForSelector("hzn-button#continue", { timeout: 10000 });
      await page.evaluate(() => {
        const btn = document.querySelector("hzn-button#continue");
        const inner = btn?.shadowRoot?.querySelector("button");
        inner?.click();
      });

      // Wait for navigation after login
      try {
        await page.waitForNavigation({
          waitUntil: "networkidle2",
          timeout: 20000,
        });
      } catch {
        await page.waitForNavigation({
          waitUntil: "domcontentloaded",
          timeout: 15000,
        });
      }

      console.log("✅ Login flow completed successfully");
      return true;
    } catch (error) {
      console.warn(`❌ Login attempt ${attempt} failed: ${error.message}`);

      if (attempt === maxRetries) {
        throw new Error("❌ Max login attempts reached");
      }

      await sleep(Math.min(5000 * Math.pow(2, attempt - 1), 30000));

      try {
        await page.reload({ waitUntil: "networkidle0", timeout: 15000 });
      } catch {
        await page.goto(config.carmaxUrl, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });
      }
    }
  }
}

module.exports = { login };
