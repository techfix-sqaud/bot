const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Function to find Chromium executable in various environments
function findChromiumExecutable() {
  // In production, prefer environment variable or simple paths
  if (process.env.NODE_ENV === "production") {
    const prodPaths = [
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/google-chrome",
    ];

    for (const browserPath of prodPaths) {
      try {
        if (fs.existsSync(browserPath)) {
          return browserPath;
        }
      } catch (error) {
        // Continue to next path
      }
    }

    // Try to use 'which' command safely
    try {
      const chromiumPath = execSync("which chromium", {
        encoding: "utf8",
        timeout: 5000,
      }).trim();
      if (chromiumPath) {
        return chromiumPath;
      }
    } catch (error) {
      // Ignore error in production
    }

    return undefined; // Let Puppeteer use bundled Chromium
  }

  // Development environment - more extensive search
  const commonPaths = [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/opt/google/chrome/chrome",
    // macOS paths
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ];

  // Check common paths first
  for (const browserPath of commonPaths) {
    try {
      if (fs.existsSync(browserPath)) {
        return browserPath;
      }
    } catch (error) {
      // Continue to next path
    }
  }

  // Try to find chromium via which command
  try {
    const chromiumPath = execSync("which chromium", {
      encoding: "utf8",
      timeout: 5000,
    }).trim();
    if (chromiumPath && fs.existsSync(chromiumPath)) {
      return chromiumPath;
    }
  } catch (error) {
    // Ignore error, try next method
  }

  // Try to find chrome via which command
  try {
    const chromePath = execSync("which google-chrome", {
      encoding: "utf8",
      timeout: 5000,
    }).trim();
    if (chromePath && fs.existsSync(chromePath)) {
      return chromePath;
    }
  } catch (error) {
    // Ignore error, try next method
  }

  // If nothing found, return undefined to use Puppeteer's bundled Chromium
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
    executablePath:
      process.env.PUPPETEER_EXECUTABLE_PATH || findChromiumExecutable(),
  },
};
