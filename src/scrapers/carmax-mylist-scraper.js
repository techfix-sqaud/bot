/**
 * CarMax My List Scraper
 * Main scraper orchestrator for CarMax My List functionality
 */

const { launchPuppeteer, saveJSON, generateDateFilename } = require("../utils");
const { loginWithRetry } = require("./carmax-login");
const { navigateToMyList } = require("./carmax-navigation");
const {
  loadAllVehicles,
  extractMyListVehicles,
} = require("./vehicle-extractor");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Set up browser instance with proper configuration
 * @returns {Object} Browser and page instances
 */
async function setupBrowser() {
  // Check for testing browser option
  const showBrowser =
    process.env.SHOW_BROWSER === "true" ||
    process.env.TESTING_BROWSER === "true";

  const browser = await launchPuppeteer({
    headless: !showBrowser, // Show browser if either flag is set
    userDataDir: "./user_data",
    args: [
      "--disable-infobars",
      "--window-position=0,0",
      "--ignore-certificate-errors",
      "--ignore-certificate-errors-spki-list",
      "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });

  if (showBrowser) {
    console.log("🔍 Browser is visible for testing/debugging");
  }

  return { browser, page };
}

/**
 * Main function to scrape CarMax My List
 * @param {string} jobId - Optional job ID for cancellation tracking
 * @returns {Object} Scraping results
 */
async function scrapeMyList(jobId = null) {
  console.log("🚀 Starting CarMax My List scraping...");

  const checkCancellation = () => {
    if (jobId && global.jobCancellation && global.jobCancellation[jobId]) {
      throw new Error("Job was cancelled by user request");
    }
  };

  const { browser, page } = await setupBrowser();
  let vehicles = [];

  try {
    checkCancellation();

    // Step 1: Login to CarMax
    await loginWithRetry(page);
    checkCancellation();

    // Step 2: Navigate to My List
    await navigateToMyList(page);
    await sleep(3000);
    checkCancellation();

    // Step 3: Check if My List is empty
    const isEmpty = await page.evaluate(() => {
      const pageText = document.body?.textContent?.toLowerCase() || "";
      return (
        pageText.includes("no vehicles") ||
        pageText.includes("empty list") ||
        pageText.includes("no saved vehicles") ||
        pageText.includes("your list is empty")
      );
    });

    if (isEmpty) {
      console.log("📭 My List is empty - no vehicles to scrape");
      return {
        vehicles: [],
        filename: null,
        summary: {
          total: 0,
          successful: 0,
          failed: 0,
        },
      };
    }

    // Step 4: Load all vehicles on the page (keeping original method as backup)
    await loadAllVehicles(page);
    checkCancellation();

    // Step 5: Extract vehicle data using enhanced method
    console.log("🚀 Using enhanced vehicle extraction method...");
    const vehicleData = await extractMyListVehicles(page, 1000);
    vehicles.push(...vehicleData);

    console.log(
      `✅ Enhanced extraction completed: ${vehicleData.length} vehicles from My List`
    );

    if (vehicles.length > 0) {
      // Save the scraped data
      const filename = generateDateFilename("mylist_vehicles");
      saveJSON(filename, vehicles);
      console.log(`📁 My List data saved to: ${filename}`);

      return {
        vehicles,
        filename,
        summary: {
          total: vehicles.length,
          successful: vehicles.length,
          failed: 0,
        },
      };
    } else {
      console.log("⚠️ No valid vehicles found in My List");
      return {
        vehicles: [],
        filename: null,
        summary: {
          total: 0,
          successful: 0,
          failed: 0,
        },
      };
    }
  } catch (error) {
    const isCancelled = error.message?.includes("cancelled");

    if (isCancelled) {
      console.log("🛑 My List scraping was cancelled");

      if (vehicles?.length > 0) {
        const filename = generateDateFilename("mylist_vehicles_cancelled");
        saveJSON(filename, vehicles);
        console.log(
          `💾 Partial My List data saved to: ${filename} (${vehicles.length} vehicles)`
        );

        return {
          vehicles,
          filename,
          cancelled: true,
          summary: {
            total: vehicles.length,
            successful: vehicles.length,
            failed: 0,
          },
        };
      } else {
        console.log(
          "🛑 No vehicles were scraped from My List before cancellation"
        );
        return {
          vehicles: [],
          filename: null,
          cancelled: true,
          summary: {
            total: 0,
            successful: 0,
            failed: 0,
          },
        };
      }
    }

    console.error("❌ Error in scrapeMyList:", error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

module.exports = {
  scrapeMyList,
};
