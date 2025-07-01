require("dotenv").config();
const puppeteer = require("puppeteer");
const { carmaxUrl } = require("./src/config");
const { launchPuppeteer } = require("./src/utils");

async function debugLogin() {
  console.log("🚀 Starting CarMax login debug...");

  // Check credentials
  const carmaxEmail = process.env.CARMAX_EMAIL;
  const carmaxPassword = process.env.CARMAX_PASSWORD;

  console.log(`📧 Email: ${carmaxEmail}`);
  console.log(`🔑 Password: ${carmaxPassword ? "***SET***" : "NOT SET"}`);

  if (!carmaxEmail || !carmaxPassword) {
    throw new Error("CarMax credentials not found in environment variables");
  }

  let browser, page;
  try {
    console.log("🌐 Launching browser...");
    browser = await launchPuppeteer();
    page = await browser.newPage();

    // Enable console logging from the page
    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
    page.on("pageerror", (error) => console.log("PAGE ERROR:", error.message));

    console.log(`🔗 Navigating to: ${carmaxUrl}`);
    await page.goto(carmaxUrl, { waitUntil: "networkidle2", timeout: 30000 });

    console.log("📸 Taking screenshot after page load...");
    await page.screenshot({ path: "debug-1-initial.png", fullPage: true });

    // Check what's on the page
    const title = await page.title();
    console.log(`📄 Page title: ${title}`);

    const url = page.url();
    console.log(`🔗 Current URL: ${url}`);

    // Look for sign-in button
    console.log("🔍 Looking for sign-in button...");

    try {
      await page.waitForSelector("hzn-button", { timeout: 10000 });
      console.log("✅ Found hzn-button element");

      // Check if it's the sign-in button
      const buttonText = await page.evaluate(() => {
        const btn = document.querySelector("hzn-button");
        return btn ? btn.textContent || btn.innerText : "NO TEXT";
      });
      console.log(`🔘 Button text: ${buttonText}`);

      // Click the button
      console.log("👆 Clicking sign-in button...");
      await page.evaluate(() => {
        const btn = document.querySelector("hzn-button");
        if (btn && btn.shadowRoot) {
          const shadowButton = btn.shadowRoot.querySelector("button");
          if (shadowButton) {
            shadowButton.click();
            return "Clicked shadow button";
          }
        }
        // Fallback to regular click
        btn.click();
        return "Clicked regular button";
      });

      console.log("📸 Taking screenshot after button click...");
      await page.screenshot({
        path: "debug-2-after-signin-click.png",
        fullPage: true,
      });

      // Wait a bit and check for email input
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (error) {
      console.log("❌ Could not find or click sign-in button:", error.message);

      // Let's see what buttons are available
      const buttons = await page.evaluate(() => {
        const allButtons = Array.from(
          document.querySelectorAll('button, hzn-button, [role="button"]')
        );
        return allButtons.map((btn) => ({
          tagName: btn.tagName,
          text: btn.textContent || btn.innerText || "NO TEXT",
          className: btn.className,
          id: btn.id,
        }));
      });
      console.log("Available buttons:", buttons);
    }

    // Look for email input
    console.log("🔍 Looking for email input...");

    try {
      await page.waitForSelector("hzn-input#signInName", {
        visible: true,
        timeout: 10000,
      });
      console.log("✅ Found email input field");

      // Enter email
      console.log("✍️ Entering email...");
      await page.evaluate((email) => {
        const inp = document.querySelector("hzn-input#signInName");
        if (inp && inp.shadowRoot) {
          const shadowInput = inp.shadowRoot.querySelector("input");
          if (shadowInput) {
            shadowInput.value = email;
            shadowInput.dispatchEvent(new Event("input", { bubbles: true }));
            shadowInput.dispatchEvent(new Event("change", { bubbles: true }));
            return "Set email in shadow input";
          }
        }
        return "Could not find shadow input";
      }, carmaxEmail);

      console.log("📸 Taking screenshot after email entry...");
      await page.screenshot({
        path: "debug-3-after-email.png",
        fullPage: true,
      });

      // Look for continue button
      console.log("🔍 Looking for continue with email button...");
      await page.waitForSelector("hzn-button#continueWithEmail", {
        timeout: 10000,
      });
      console.log("✅ Found continue button");

      // Click continue
      console.log("👆 Clicking continue button...");
      await page.evaluate(() => {
        const btn = document.querySelector("hzn-button#continueWithEmail");
        if (btn && btn.shadowRoot) {
          const shadowButton = btn.shadowRoot.querySelector("button");
          if (shadowButton) {
            shadowButton.click();
          }
        }
      });

      console.log("📸 Taking screenshot after continue click...");
      await page.screenshot({
        path: "debug-4-after-continue.png",
        fullPage: true,
      });

      // Wait for password field
      console.log("⏳ Waiting for password field...");
      await new Promise((resolve) => setTimeout(resolve, 4000));

      // Look for password input
      console.log("🔍 Looking for password input...");
      await page.waitForSelector("#password", { timeout: 10000 });
      console.log("✅ Found password input field");

      // Enter password
      console.log("✍️ Entering password...");
      await page.type("#password", carmaxPassword, { delay: 100 });

      console.log("📸 Taking screenshot after password entry...");
      await page.screenshot({
        path: "debug-5-after-password.png",
        fullPage: true,
      });

      // Look for final continue button
      console.log("🔍 Looking for final continue button...");
      await page.waitForSelector("hzn-button#continue", { timeout: 10000 });
      console.log("✅ Found final continue button");

      // Click final continue
      console.log("👆 Clicking final continue button...");
      await page.evaluate(() => {
        const btn = document.querySelector("hzn-button#continue");
        if (btn && btn.shadowRoot) {
          const shadowButton = btn.shadowRoot.querySelector("button");
          if (shadowButton) {
            shadowButton.click();
          }
        }
      });

      console.log("⏳ Waiting for navigation...");
      await page.waitForNavigation({
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      console.log("📸 Taking screenshot after login...");
      await page.screenshot({
        path: "debug-6-after-login.png",
        fullPage: true,
      });

      const finalUrl = page.url();
      const finalTitle = await page.title();
      console.log(`🎉 Login completed! URL: ${finalUrl}`);
      console.log(`📄 Page title: ${finalTitle}`);
    } catch (error) {
      console.log("❌ Error during email/password flow:", error.message);

      // Take a screenshot of current state
      await page.screenshot({ path: "debug-error.png", fullPage: true });

      // Let's see what inputs are available
      const inputs = await page.evaluate(() => {
        const allInputs = Array.from(
          document.querySelectorAll(
            'input, hzn-input, [type="text"], [type="email"], [type="password"]'
          )
        );
        return allInputs.map((inp) => ({
          tagName: inp.tagName,
          type: inp.type,
          id: inp.id,
          className: inp.className,
          placeholder: inp.placeholder,
        }));
      });
      console.log("Available inputs:", inputs);
    }
  } catch (error) {
    console.error("❌ Fatal error:", error.message);
    if (page) {
      await page.screenshot({ path: "debug-fatal-error.png", fullPage: true });
    }
  } finally {
    if (browser) {
      console.log("🔚 Closing browser...");
      await browser.close();
    }
  }
}

debugLogin().catch(console.error);
