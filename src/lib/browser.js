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
  // Use the enhanced configuration with browser detection
  const puppeteerOptions = config.getPuppeteerOptions(options);
  
  // Add some additional browser-specific args for compatibility
  const defaultArgs = [
    "--disable-infobars",
    "--window-position=0,0",
    "--ignore-certificate-errors",
    "--ignore-certificate-errors-spki-list",
    "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  ];

  // Merge with existing args
  puppeteerOptions.args = [...puppeteerOptions.args, ...defaultArgs];

  console.log("🚀 Launching browser with options:", {
    headless: puppeteerOptions.headless,
    executablePath: puppeteerOptions.executablePath || "bundled",
    argsCount: puppeteerOptions.args.length
  });

  try {
    const browser = await puppeteer.launch(puppeteerOptions);
    console.log("🌐 Browser launched successfully");
    return browser;
  } catch (error) {
    console.error("❌ Failed to launch browser:", error.message);
    
    // If we failed with custom executable, try with Puppeteer's bundled version
    if (puppeteerOptions.executablePath) {
      console.log("🔄 Retrying with Puppeteer's bundled browser...");
      const fallbackOptions = { ...puppeteerOptions };
      delete fallbackOptions.executablePath;
      
      try {
        const browser = await puppeteer.launch(fallbackOptions);
        console.log("🌐 Browser launched successfully with fallback");
        return browser;
      } catch (fallbackError) {
        console.error("❌ Fallback browser launch also failed:", fallbackError.message);
        throw fallbackError;
      }
    }
    
    throw error;
  }
}

module.exports = {
  launchPuppeteer,
};
