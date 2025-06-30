const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Function to find Chromium executable in various environments
function findChromiumExecutable() {
  const os = require("os");
  const platform = os.platform();

  // First, check if there's an environment variable override
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    // If it's just "chromium", try to find it via which command first
    if (process.env.PUPPETEER_EXECUTABLE_PATH === "chromium") {
      try {
        const { execSync } = require("child_process");
        const chromiumPath = execSync("which chromium", {
          encoding: "utf8",
          timeout: 5000,
        }).trim();
        if (chromiumPath && fs.existsSync(chromiumPath)) {
          console.log(`🎯 Found chromium via which command: ${chromiumPath}`);
          return chromiumPath;
        }
      } catch (error) {
        console.log(
          `❌ Could not find chromium via which command: ${error.message}`
        );
      }
    } else if (fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
      console.log(
        `🎯 Using browser from PUPPETEER_EXECUTABLE_PATH: ${process.env.PUPPETEER_EXECUTABLE_PATH}`
      );
      return process.env.PUPPETEER_EXECUTABLE_PATH;
    }
  }

  // Check other environment variables (for Nixpacks and other platforms)
  const envVars = [
    process.env.CHROME_BIN,
    process.env.CHROMIUM_BIN,
    process.env.GOOGLE_CHROME_BIN,
  ].filter(Boolean);

  for (const envVar of envVars) {
    if (envVar === "chromium" || envVar === "chrome") {
      // Try to resolve via which command
      try {
        const { execSync } = require("child_process");
        const resolvedPath = execSync(`which ${envVar}`, {
          encoding: "utf8",
          timeout: 5000,
        }).trim();
        if (resolvedPath && fs.existsSync(resolvedPath)) {
          console.log(`🎯 Found ${envVar} via which command: ${resolvedPath}`);
          return resolvedPath;
        }
      } catch (error) {
        console.log(
          `❌ Could not resolve ${envVar} via which command: ${error.message}`
        );
      }
    } else if (fs.existsSync(envVar)) {
      console.log(`🎯 Using browser from environment variable: ${envVar}`);
      return envVar;
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
    // Linux and other Unix-like systems (including Docker/Alpine/Nixpacks)
    commonPaths = [
      "/usr/bin/chromium-browser", // Debian/Ubuntu
      "/usr/bin/chromium", // Some distributions
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/opt/google/chrome/chrome",
      "/snap/bin/chromium",
      "/usr/local/bin/chromium",
      "/usr/local/bin/google-chrome",
      "/opt/chromium/chromium",
      "/usr/bin/google-chrome-unstable",
      "/usr/bin/google-chrome-beta",
    ];
    whichCommands = [
      "chromium",
      "chromium-browser",
      "google-chrome",
      "google-chrome-stable",
      "chrome",
    ];

    // For Nixpacks, also check nix store paths
    try {
      const { execSync } = require("child_process");
      const nixStoreSearch = execSync(
        "find /nix/store -name chromium -type f 2>/dev/null | head -1",
        {
          encoding: "utf8",
          timeout: 5000,
        }
      ).trim();
      if (nixStoreSearch && fs.existsSync(nixStoreSearch)) {
        console.log(`🎯 Found Chromium in Nix store: ${nixStoreSearch}`);
        commonPaths.unshift(nixStoreSearch);
      }
    } catch (error) {
      console.log(
        `🔍 Nix store search failed (normal if not using Nixpacks): ${error.message}`
      );
    }
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
  carmaxUrl: "https://www.carmaxauctions.com",
  vautoUrl: "https://www2.vauto.com/genius/platform/quickvin",
  headless: process.env.NODE_ENV === "production" ? true : false, // Headless in production
  show2FA: process.env.NODE_ENV === "production" ? false : true, // No 2FA display in production

  // Puppeteer configuration for deployment
  puppeteerOptions: (() => {
    const executablePath = findChromiumExecutable();
    const options = {
      headless: process.env.NODE_ENV === "production" ? "new" : false,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor",
        "--no-first-run",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--disable-field-trial-config",
        "--disable-ipc-flooding-protection",
        // Fix for missing X server/display issues
        "--virtual-time-budget=60000",
        "--disable-extensions",
        "--disable-plugins",
        "--disable-sync",
        "--disable-translate",
        "--disable-default-apps",
        "--disable-component-extensions-with-background-pages",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-client-side-phishing-detection",
        "--disable-hang-monitor",
        "--disable-prompt-on-repost",
        "--disable-domain-reliability",
        "--disable-features=AudioServiceOutOfProcess",
        // Additional flags for containerized environments
        "--no-zygote",
        "--single-process",
        "--disable-accelerated-2d-canvas",
        "--disable-software-rasterizer",
        "--enable-unsafe-swiftshader",
        // Force headless mode in all environments to avoid X server issues
        ...(process.env.NODE_ENV === "production" || !process.env.DISPLAY
          ? ["--headless=new"]
          : []),
      ],
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
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--disable-field-trial-config",
        "--disable-ipc-flooding-protection",
        "--enable-unsafe-swiftshader",
        "--no-first-run",
        "--disable-extensions",
        "--disable-plugins",
        "--disable-sync",
        "--disable-translate",
        "--disable-default-apps",
        "--disable-component-extensions-with-background-pages",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-client-side-phishing-detection",
        "--disable-hang-monitor",
        "--disable-prompt-on-repost",
        "--disable-domain-reliability",
        "--disable-features=AudioServiceOutOfProcess",
        // Force headless and additional containerized environment flags
        "--no-zygote",
        "--single-process",
        "--disable-accelerated-2d-canvas",
        // Force headless mode when no display is available
        ...(process.env.NODE_ENV === "production" || !process.env.DISPLAY
          ? ["--headless=new"]
          : []),
      ],
      ...overrides,
    };

    // Force headless if no display is available regardless of NODE_ENV
    if (!process.env.DISPLAY && baseOptions.headless === false) {
      console.log(
        "⚠️  No DISPLAY environment variable found, forcing headless mode"
      );
      baseOptions.headless = "new";
    }

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
