#!/usr/bin/env node

/**
 * CarMax Login Page Inspector
 * This script opens CarMax and logs the page structure for debugging
 */

const { launchPuppeteer } = require("./src/utils");

async function inspectCarMaxLoginPage() {
  console.log("🔍 Inspecting CarMax Login Page Structure");
  console.log("=" .repeat(50));
  
  const browser = await launchPuppeteer({
    headless: false, // Always show browser for inspection
    userDataDir: "./user_data",
    args: [
      "--disable-infobars",
      "--window-position=0,0",
      "--ignore-certificate-errors",
      "--ignore-certificate-errors-spki-list",
      "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    
    console.log("🌐 Navigating to CarMax auctions...");
    await page.goto("https://www.carmaxauctions.com", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    
    // Wait a bit for the page to fully load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log("📄 Current page title:", await page.title());
    console.log("🔗 Current URL:", page.url());
    
    // Check for various login-related elements
    const pageInfo = await page.evaluate(() => {
      const info = {
        title: document.title,
        url: window.location.href,
        hasLoginButton: false,
        hasEmailInput: false,
        hasPasswordInput: false,
        loginElements: [],
        emailElements: [],
        buttonElements: [],
        allElements: []
      };
      
      // Check for login buttons
      const loginSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:contains("login")',
        'button:contains("sign in")',
        'a:contains("login")',
        'a:contains("sign in")',
        'hzn-button',
        '[class*="login"]',
        '[class*="signin"]',
        '[data-testid*="login"]',
        '[data-testid*="signin"]'
      ];
      
      // Check for email inputs
      const emailSelectors = [
        'input[type="email"]',
        'input[name="email"]',
        'input[placeholder*="email"]',
        'input[id*="email"]',
        'input[class*="email"]'
      ];
      
      // Check for password inputs
      const passwordSelectors = [
        'input[type="password"]',
        'input[name="password"]',
        'input[id*="password"]',
        'input[class*="password"]'
      ];
      
      // Find login elements
      loginSelectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            info.hasLoginButton = true;
            elements.forEach(el => {
              info.loginElements.push({
                selector,
                text: el.textContent?.trim() || '',
                id: el.id || '',
                className: el.className || '',
                tagName: el.tagName
              });
            });
          }
        } catch (e) {
          // Ignore errors for invalid selectors
        }
      });
      
      // Find email elements
      emailSelectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            info.hasEmailInput = true;
            elements.forEach(el => {
              info.emailElements.push({
                selector,
                id: el.id || '',
                className: el.className || '',
                name: el.name || '',
                placeholder: el.placeholder || ''
              });
            });
          }
        } catch (e) {
          // Ignore errors for invalid selectors
        }
      });
      
      // Find all buttons
      document.querySelectorAll('button, input[type="submit"], input[type="button"]').forEach(el => {
        info.buttonElements.push({
          text: el.textContent?.trim() || '',
          id: el.id || '',
          className: el.className || '',
          type: el.type || '',
          tagName: el.tagName
        });
      });
      
      return info;
    });
    
    console.log("\n📊 Page Analysis Results:");
    console.log("=" .repeat(30));
    console.log(`Has Login Button: ${pageInfo.hasLoginButton}`);
    console.log(`Has Email Input: ${pageInfo.hasEmailInput}`);
    console.log(`Has Password Input: ${pageInfo.hasPasswordInput}`);
    
    if (pageInfo.loginElements.length > 0) {
      console.log("\n🔘 Login Elements Found:");
      pageInfo.loginElements.forEach((el, i) => {
        console.log(`  ${i + 1}. ${el.tagName} - "${el.text}" (${el.selector})`);
        if (el.id) console.log(`     ID: ${el.id}`);
        if (el.className) console.log(`     Class: ${el.className}`);
      });
    }
    
    if (pageInfo.emailElements.length > 0) {
      console.log("\n📧 Email Input Elements Found:");
      pageInfo.emailElements.forEach((el, i) => {
        console.log(`  ${i + 1}. ${el.selector}`);
        if (el.id) console.log(`     ID: ${el.id}`);
        if (el.name) console.log(`     Name: ${el.name}`);
        if (el.className) console.log(`     Class: ${el.className}`);
        if (el.placeholder) console.log(`     Placeholder: ${el.placeholder}`);
      });
    }
    
    if (pageInfo.buttonElements.length > 0) {
      console.log("\n🔘 All Button Elements:");
      pageInfo.buttonElements.slice(0, 10).forEach((el, i) => { // Show first 10
        console.log(`  ${i + 1}. ${el.tagName} - "${el.text}"`);
        if (el.id) console.log(`     ID: ${el.id}`);
        if (el.className) console.log(`     Class: ${el.className}`);
      });
      if (pageInfo.buttonElements.length > 10) {
        console.log(`     ... and ${pageInfo.buttonElements.length - 10} more buttons`);
      }
    }
    
    console.log("\n⏳ Browser will stay open for 30 seconds for manual inspection...");
    console.log("Use this time to manually inspect the page structure");
    
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    console.error("❌ Error inspecting page:", error.message);
  } finally {
    await browser.close();
    console.log("✅ Inspection completed");
  }
}

// Run the inspection
if (require.main === module) {
  inspectCarMaxLoginPage();
}

module.exports = { inspectCarMaxLoginPage };
