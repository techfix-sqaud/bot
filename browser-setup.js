#!/usr/bin/env node

/**
 * Helper script to detect and configure browser executable path
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const os = require("os");

function findAllBrowsers() {
  const platform = os.platform();
  const found = [];

  let searchPaths = [];
  let commands = [];

  if (platform === "darwin") {
    // macOS
    searchPaths = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
      "/usr/local/bin/chromium",
      "/usr/local/bin/google-chrome",
      "/opt/homebrew/bin/chromium",
      "/opt/homebrew/bin/google-chrome",
    ];
    commands = ["google-chrome", "chromium", "chrome"];
  } else if (platform === "win32") {
    // Windows
    searchPaths = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      `C:\\Users\\${
        os.userInfo().username
      }\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`,
      "C:\\Program Files\\Chromium\\Application\\chromium.exe",
      "C:\\Program Files (x86)\\Chromium\\Application\\chromium.exe",
    ];
    commands = ["chrome", "google-chrome", "chromium"];
  } else {
    // Linux
    searchPaths = [
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/opt/google/chrome/chrome",
      "/snap/bin/chromium",
      "/usr/local/bin/chromium",
      "/usr/local/bin/google-chrome",
      "/opt/chromium/chromium",
    ];
    commands = [
      "google-chrome",
      "google-chrome-stable",
      "chromium",
      "chromium-browser",
    ];
  }

  // Check file paths
  for (const browserPath of searchPaths) {
    try {
      if (fs.existsSync(browserPath)) {
        found.push({ path: browserPath, type: "file" });
      }
    } catch (error) {
      // Continue
    }
  }

  // Check via commands
  for (const command of commands) {
    try {
      const whichCmd =
        platform === "win32" ? `where ${command}` : `which ${command}`;
      const result = execSync(whichCmd, {
        encoding: "utf8",
        timeout: 5000,
      }).trim();
      const paths = result.split("\n").filter((p) => p.trim());

      for (const browserPath of paths) {
        if (browserPath && fs.existsSync(browserPath)) {
          found.push({ path: browserPath, type: "command", command });
        }
      }
    } catch (error) {
      // Continue
    }
  }

  return found;
}

function generateEnvExample(browserPath) {
  return `# Add this to your .env file to set a custom browser path:
PUPPETEER_EXECUTABLE_PATH="${browserPath}"

# Or export it in your shell:
export PUPPETEER_EXECUTABLE_PATH="${browserPath}"`;
}

async function main() {
  console.log("🔍 Searching for browser executables...\n");

  const browsers = findAllBrowsers();

  if (browsers.length === 0) {
    console.log("❌ No browser executables found on this system.");
    console.log("📦 Puppeteer will download and use its bundled Chromium.");
    console.log("💡 You can also install Chrome or Chromium manually.");
    return;
  }

  console.log(`✅ Found ${browsers.length} browser executable(s):\n`);

  browsers.forEach((browser, index) => {
    console.log(`${index + 1}. ${browser.path}`);
    if (browser.type === "command") {
      console.log(`   Found via command: ${browser.command}`);
    }
    console.log("");
  });

  // Test the current config
  const config = require("./src/config");
  const currentPath = config.findChromiumExecutable();

  if (currentPath) {
    console.log(`🎯 Current configuration will use: ${currentPath}\n`);
  } else {
    console.log(
      "⚠️  Current configuration found no browser. Puppeteer will use bundled Chromium.\n"
    );
  }

  if (browsers.length > 0) {
    console.log("💡 To override the browser path, you can:");
    console.log(generateEnvExample(browsers[0].path));
  }
}

main().catch(console.error);
