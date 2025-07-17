/**
 * Browser Utilities
 * Common browser setup and configuration
 */

const puppeteer = require("puppeteer");
const config = require("../config");

/**
 * Launch Puppeteer with standard configuration
 * @param {Object} options - Puppeteer launch options
 * @returns {Browser} Puppeteer browser instance
 */
async function launchPuppeteer(options = {}) {
  const defaultOptions = {
    headless: config.headless,
    userDataDir: config.userDataDir,
    args: [
      "--disable-infobars",
      "--window-position=0,0",
      "--ignore-certificate-errors",
      "--ignore-certificate-errors-spki-list",
      "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    ],
  };

  const mergedOptions = { ...defaultOptions, ...options };

  try {
    const browser = await puppeteer.launch(mergedOptions);
    console.log("🌐 Browser launched successfully");
    return browser;
  } catch (error) {
    console.error("❌ Failed to launch browser:", error.message);
    throw error;
  }
}

module.exports = {
  launchPuppeteer,
};
