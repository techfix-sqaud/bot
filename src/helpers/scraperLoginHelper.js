const config = require("../config/config");

// Simple sleep helper
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function isUserLoggedIn(page) {
  try {
    await page.goto(config.carmaxUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await sleep(1000); // Let UI render

    return await page.evaluate(() => {
      const hasDashboard = [...document.querySelectorAll("button")].some(
        (btn) => btn.textContent.trim().toLowerCase() === "member dashboard"
      );

      const hasSearchInventory = [
        ...document.querySelectorAll("hzn-button"),
      ].some(
        (btn) => btn.textContent?.trim().toLowerCase() === "search inventory"
      );

      return hasDashboard || hasSearchInventory;
    });
  } catch (error) {
    console.warn("⚠️ Could not verify login state:", error.message);
    return false;
  }
}

/**
 * Logs in to CarMax site using email/password stored in env
 */
async function login(page, maxRetries = 3) {
  const email = process.env.CARMAX_EMAIL;
  const password = process.env.CARMAX_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "CARMAX_EMAIL or CARMAX_PASSWORD environment variable is missing"
    );
  }

  // 🧪 Check if already logged in
  if (await isUserLoggedIn(page)) {
    console.log("✅ Already logged in — skipping login");
    return true;
  }

  // 🔁 Attempt login with retry
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔐 Login attempt ${attempt}`);

      // Load site
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

      // Click login button (inside shadow DOM)
      await page.waitForSelector("hzn-button", { timeout: 15000 });
      await page.evaluate(() => {
        const btn = document.querySelector("hzn-button");
        const inner = btn?.shadowRoot?.querySelector("button");
        inner?.click();
      });

      // Fill email
      await page.waitForSelector("hzn-input#signInName", {
        visible: true,
        timeout: 15000,
      });
      await page.evaluate((email) => {
        const input = document.querySelector("hzn-input#signInName");
        const field = input?.shadowRoot?.querySelector("input");
        if (field) {
          field.value = email;
          field.dispatchEvent(new Event("input", { bubbles: true }));
          field.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }, email);

      // Continue with email
      await page.waitForSelector("hzn-button#continueWithEmail", {
        timeout: 10000,
      });
      await page.evaluate(() => {
        const btn = document.querySelector("hzn-button#continueWithEmail");
        const inner = btn?.shadowRoot?.querySelector("button");
        inner?.click();
      });

      await sleep(2000);

      // Fill password
      await page.waitForSelector("#password", {
        visible: true,
        timeout: 10000,
      });
      await page.type("#password", password, { delay: 100 });

      // Continue after password
      await page.waitForSelector("hzn-button#continue", { timeout: 10000 });
      await page.evaluate(() => {
        const btn = document.querySelector("hzn-button#continue");
        const inner = btn?.shadowRoot?.querySelector("button");
        inner?.click();
      });

      // Wait for login to finish
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

      // Final confirmation
      if (await isUserLoggedIn(page)) {
        console.log("✅ Login successful");
        return true;
      } else {
        throw new Error("Login flow completed, but login did not take effect");
      }
    } catch (error) {
      console.warn(`❌ Login attempt ${attempt} failed: ${error.message}`);

      if (attempt === maxRetries) {
        throw new Error("❌ Max login attempts reached");
      }

      // Wait and retry
      const backoff = Math.min(5000 * 2 ** (attempt - 1), 30000);
      await sleep(backoff);

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
