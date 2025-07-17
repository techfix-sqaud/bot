const fs = require("fs");
const _ = require("lodash");
const puppeteer = require("puppeteer");

exports.saveJSON = (file, data) =>
  fs.writeFileSync(file, JSON.stringify(data, null, 2));

exports.loadJSON = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file));
  } catch {
    return [];
  }
};

exports.summarizeVehicle = (v) =>
  `🔥 ${v.title} | ${v.mileage}, ${v.engine} | Auction: ${v.auctionLocation}`;

exports.fuzzyMatchVIN = (str, vinList) => {
  // exact VIN match
  if (vinList.includes(str)) return str;
  // fallback fuzzy (could use string similarity)
  return _.find(vinList, (vin) => str.includes(vin.substring(0, 8))) || null;
};

/**
 * Generate a filename with current date and time
 * @param {string} prefix - The prefix for the filename
 * @param {string} extension - The file extension (default: 'json')
 * @returns {string} - Filename with date timestamp
 */
exports.generateDateFilename = (prefix, extension = "json") => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  const timestamp = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  return `./data/${prefix}_${timestamp}.${extension}`;
};

/**
 * Get standardized Puppeteer launch configuration for server/development environments
 * @param {Object} options - Additional launch options to merge
 * @returns {Object} - Puppeteer launch configuration
 */
exports.getPuppeteerConfig = (options = {}) => {
  // Determine the executable path for Chromium
  let executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;

  // In production/server environments, try to find Chromium
  if (process.env.NODE_ENV === "production" && !executablePath) {
    const { execSync } = require("child_process");
    try {
      // Try common Chromium/Chrome paths
      executablePath = execSync(
        "which chromium || which google-chrome || which chrome",
        {
          encoding: "utf8",
          stdio: "pipe",
        }
      ).trim();
    } catch (error) {
      // Fallback to Nix store path pattern
      executablePath = "/nix/store/*/bin/chromium";
    }
  }

  const defaultConfig = {
    userDataDir: "./user_data",
    headless:
      process.env.NODE_ENV === "production"
        ? true
        : options.headless !== undefined
        ? options.headless
        : false,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-infobars",
      "--window-position=0,0",
      "--ignore-certificate-errors",
      "--ignore-certificate-errors-spki-list",
      "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    ],
  };

  // Add executable path for production/server environments
  if (executablePath) {
    defaultConfig.executablePath = executablePath;
  }

  // Add additional server-specific Chrome flags in production
  if (process.env.NODE_ENV === "production") {
    defaultConfig.args.push(
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-features=TranslateUI",
      "--disable-ipc-flooding-protection",
      "--single-process" // Use single process in resource-constrained environments
    );
  }

  // Merge with provided options, giving priority to custom options
  return {
    ...defaultConfig,
    ...options,
    args: [...defaultConfig.args, ...(options.args || [])],
  };
};

/**
 * Launch Puppeteer with standardized configuration
 * @param {Object} options - Additional launch options
 * @returns {Promise} - Puppeteer browser instance
 */
exports.launchPuppeteer = async (options = {}) => {
  const config = exports.getPuppeteerConfig(options);
  console.log(`🚀 Launching browser with headless: ${config.headless}`);
  return await puppeteer.launch(config);
};
