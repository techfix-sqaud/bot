/**
 * Configuration settings for CarMax vAuto Bot
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Function to find Chromium executable in various environments
function findChromiumExecutable() {
  const os = require("os");
  const platform = os.platform();

  // First, check if there's an environment variable override
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    if (fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
      console.log(
        `🎯 Using browser from PUPPETEER_EXECUTABLE_PATH: ${process.env.PUPPETEER_EXECUTABLE_PATH}`
      );
      return process.env.PUPPETEER_EXECUTABLE_PATH;
    }
  }

  let commonPaths = [];
  let whichCommands = [];

  // Platform-specific paths and commands
  if (platform === "darwin") {
    // macOS
    commonPaths = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
      "/usr/local/bin/chromium",
      "/usr/local/bin/google-chrome",
      "/opt/homebrew/bin/chromium",
      "/opt/homebrew/bin/google-chrome",
    ];
    whichCommands = [
      "google-chrome",
      "chromium",
      "chrome",
      "google-chrome-stable",
    ];
  } else if (platform === "win32") {
    // Windows
    commonPaths = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Users\\%USERNAME%\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files\\Chromium\\Application\\chromium.exe",
      "C:\\Program Files (x86)\\Chromium\\Application\\chromium.exe",
    ];
    whichCommands = ["chrome", "google-chrome", "chromium"];
  } else {
    // Linux and other Unix-like systems
    commonPaths = [
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/opt/google/chrome/chrome",
      "/snap/bin/chromium",
      "/usr/local/bin/chromium",
      "/usr/local/bin/google-chrome",
      "/opt/chromium/chromium",
      "/usr/bin/google-chrome-unstable",
      "/usr/bin/google-chrome-beta",
    ];
    whichCommands = [
      "google-chrome",
      "google-chrome-stable",
      "chromium",
      "chromium-browser",
      "chrome",
    ];
  }

  // Check common paths first
  console.log(`🔍 Searching for browser executable on ${platform}...`);
  for (const browserPath of commonPaths) {
    try {
      // Expand environment variables in Windows paths
      const expandedPath =
        platform === "win32"
          ? browserPath.replace("%USERNAME%", os.userInfo().username)
          : browserPath;

      console.log(`🔍 Checking path: ${expandedPath}`);
      if (fs.existsSync(expandedPath)) {
        console.log(`✅ Found browser at: ${expandedPath}`);
        return expandedPath;
      } else {
        console.log(`❌ Browser not found at: ${expandedPath}`);
      }
    } catch (error) {
      console.log(`❌ Error checking path ${browserPath}: ${error.message}`);
      // Continue to next path
    }
  }

  // Try to find browser via which/where commands
  console.log(`🔍 Trying command-based detection...`);
  for (const command of whichCommands) {
    try {
      const whichCmd =
        platform === "win32" ? `where ${command}` : `which ${command}`;
      console.log(`🔍 Running: ${whichCmd}`);
      const browserPath = execSync(whichCmd, {
        encoding: "utf8",
        timeout: 5000,
      })
        .trim()
        .split("\n")[0]; // Take first result if multiple

      console.log(`🔍 Command result: ${browserPath}`);
      if (browserPath && fs.existsSync(browserPath)) {
        console.log(`✅ Found browser via ${whichCmd}: ${browserPath}`);
        return browserPath;
      } else if (browserPath) {
        console.log(
          `❌ Browser path from command exists but file not found: ${browserPath}`
        );
      }
    } catch (error) {
      console.log(`❌ Command ${command} failed: ${error.message}`);
      // Continue to next command
    }
  }

  // Try Puppeteer's built-in browser detection
  console.log(`🔍 Trying Puppeteer's bundled browser...`);
  try {
    const puppeteer = require("puppeteer");
    if (
      puppeteer.executablePath &&
      typeof puppeteer.executablePath === "function"
    ) {
      const puppeteerPath = puppeteer.executablePath();
      console.log(`🔍 Puppeteer suggested path: ${puppeteerPath}`);
      if (puppeteerPath && fs.existsSync(puppeteerPath)) {
        console.log(`✅ Using Puppeteer's bundled browser: ${puppeteerPath}`);
        return puppeteerPath;
      } else if (puppeteerPath) {
        console.log(
          `❌ Puppeteer path exists but file not found: ${puppeteerPath}`
        );
      }
    }
  } catch (error) {
    console.log(`❌ Error accessing Puppeteer: ${error.message}`);
    // Puppeteer might not be installed or available
  }

  // If nothing found, let Puppeteer download and use its own Chromium
  console.log(
    `⚠️  No browser executable found. Puppeteer will download and use bundled Chromium.`
  );
  return undefined;
}

module.exports = {
  // Service URLs
  carmaxUrl: "https://www.carmaxauctions.com",
  vautoUrl: "https://www2.vauto.com/genius/platform/quickvin",

  // Browser settings
  headless: process.env.NODE_ENV === "production" ? true : false,
  show2FA: process.env.NODE_ENV === "production" ? false : true,

  // Application settings
  maxRetries: 3,
  requestDelay: 2000, // ms between requests to avoid rate limiting

  // File paths
  dataDir: "./data",
  userDataDir: "./user_data",

  // Puppeteer configuration for deployment
  puppeteerOptions: (() => {
    const executablePath = findChromiumExecutable();
    const options = {
      headless: process.env.NODE_ENV === "production" ? "new" : false,
      args:
        process.env.NODE_ENV === "production"
          ? [
              "--no-sandbox",
              "--disable-setuid-sandbox",
              "--disable-dev-shm-usage",
              "--disable-accelerated-2d-canvas",
              "--no-first-run",
              "--no-zygote",
              "--single-process",
              "--disable-gpu",
            ]
          : [],
      protocolTimeout: 120000, // 2 minutes protocol timeout
    };

    // Only set executablePath if we found a valid one
    if (executablePath) {
      options.executablePath = executablePath;
    }

    return options;
  })(),

  // Get puppeteer options with custom overrides
  getPuppeteerOptions: (overrides = {}) => {
    const executablePath = findChromiumExecutable();
    const baseOptions = {
      headless: process.env.NODE_ENV === "production" ? "new" : false,
      protocolTimeout: 120000,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor",
        ...(process.env.NODE_ENV === "production"
          ? [
              "--disable-accelerated-2d-canvas",
              "--no-first-run",
              "--no-zygote",
              "--single-process",
              "--disable-gpu",
            ]
          : []),
      ],
      ...overrides,
    };

    // Only set executablePath if we found a valid one
    if (executablePath) {
      baseOptions.executablePath = executablePath;
    } else {
      console.log(
        `⚠️  No executablePath set - Puppeteer will use its bundled browser or download one`
      );
    }

    // Merge args arrays if both exist
    if (overrides.args && Array.isArray(overrides.args)) {
      baseOptions.args = [...baseOptions.args, ...overrides.args];
    }

    return baseOptions;
  },

  // Browser detection function (exposed for direct use)
  findChromiumExecutable,
};
