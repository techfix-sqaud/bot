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

      if (fs.existsSync(expandedPath)) {
        console.log(`✅ Found browser at: ${expandedPath}`);
        return expandedPath;
      }
    } catch (error) {
      // Continue to next path
    }
  }

  // Try to find browser via which/where commands
  for (const command of whichCommands) {
    try {
      const whichCmd =
        platform === "win32" ? `where ${command}` : `which ${command}`;
      const browserPath = execSync(whichCmd, {
        encoding: "utf8",
        timeout: 5000,
      })
        .trim()
        .split("\n")[0]; // Take first result if multiple

      if (browserPath && fs.existsSync(browserPath)) {
        console.log(`✅ Found browser via ${whichCmd}: ${browserPath}`);
        return browserPath;
      }
    } catch (error) {
      // Continue to next command
    }
  }

  // Try Puppeteer's built-in browser detection
  try {
    const puppeteer = require("puppeteer");
    if (
      puppeteer.executablePath &&
      typeof puppeteer.executablePath === "function"
    ) {
      const puppeteerPath = puppeteer.executablePath();
      if (puppeteerPath && fs.existsSync(puppeteerPath)) {
        console.log(`✅ Using Puppeteer's bundled browser: ${puppeteerPath}`);
        return puppeteerPath;
      }
    }
  } catch (error) {
    // Puppeteer might not be installed or available
  }

  // If nothing found, let Puppeteer download and use its own Chromium
  console.log(
    `⚠️  No browser executable found. Puppeteer will download and use bundled Chromium.`
  );
  return undefined;
}

module.exports = {
  carmaxUrl: "https://www.carmaxauctions.com",
  vautoUrl: "https://www2.vauto.com/genius/platform/quickvin",
  headless: process.env.NODE_ENV === "production" ? true : false, // Headless in production
  show2FA: process.env.NODE_ENV === "production" ? false : true, // No 2FA display in production

  // Puppeteer configuration for deployment
  puppeteerOptions: {
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
    executablePath: findChromiumExecutable(),
    protocolTimeout: 120000, // 2 minutes protocol timeout
  },

  // Get puppeteer options with custom overrides
  getPuppeteerOptions: (overrides = {}) => {
    const baseOptions = {
      headless: process.env.NODE_ENV === "production" ? "new" : false,
      executablePath: findChromiumExecutable(),
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

    // Merge args arrays if both exist
    if (overrides.args && Array.isArray(overrides.args)) {
      baseOptions.args = [...baseOptions.args, ...overrides.args];
    }

    return baseOptions;
  },

  // Browser detection function (exposed for direct use)
  findChromiumExecutable,
};
