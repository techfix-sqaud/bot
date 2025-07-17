/**
 * Vehicle Data Extraction Module
 * Handles extraction of vehicle data from CarMax My List
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Load all vehicles on the page by scrolling/pagination
 * @param {Page} page - Puppeteer page instance
 */
async function loadAllVehicles(page) {
  console.log("📋 Loading all vehicles on page...");

  await page.evaluate(async () => {
    const findScrollContainer = () => {
      const selectors = [
        ".vehicle-list-container",
        ".search-results",
        ".vehicles-container",
        '[class*="scroll"]',
        '[role="main"]',
        "main",
        "body",
      ];

      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.scrollHeight > el.clientHeight) return el;
      }
      return document.documentElement;
    };

    const countVehicles = () => {
      const selectors = [
        ".vehicle-list-item",
        '[class*="vehicle-list"]',
        '[class*="vehicle-row"]',
        "tbody tr",
        ".MuiTableBody-root tr",
        '[role="row"]',
      ];

      return Math.max(
        ...selectors.map((sel) => document.querySelectorAll(sel).length)
      );
    };

    const scrollContainer = findScrollContainer();

    for (let attempts = 0; attempts < 15; attempts++) {
      const initialCount = countVehicles();

      // Try to find and click "See More" button
      const loadMoreBtn = Array.from(document.querySelectorAll("button")).find(
        (btn) => btn.textContent?.trim().toUpperCase().includes("SEE MORE")
      );

      if (
        loadMoreBtn &&
        !loadMoreBtn.disabled &&
        loadMoreBtn.style.display !== "none"
      ) {
        loadMoreBtn.click();
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else {
        // Scroll to load more content
        if (scrollContainer === document.documentElement) {
          window.scrollTo(0, document.body.scrollHeight);
        } else {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      // Check if we loaded more vehicles
      if (countVehicles() <= initialCount) break;
    }

    // Scroll back to top
    window.scrollTo(0, 0);
  });
}

/**
 * Create a standardized vehicle object
 * @param {string} vin - Vehicle identification number
 * @param {string} runNumber - Auction run number
 * @param {string} ymmt - Year Make Model Trim
 * @param {string} mileage - Vehicle mileage
 * @param {string} additionalInfo - Additional vehicle information
 * @returns {Object} Standardized vehicle object
 */
function createVehicleObject(
  vin,
  runNumber,
  ymmt,
  mileage,
  additionalInfo = null
) {
  const ymmtParts = ymmt ? ymmt.split(/\s+/) : [];

  return {
    vin,
    runNumber: runNumber || "Unknown",
    year: ymmtParts[0] || "Unknown",
    make: ymmtParts[1] || "Unknown",
    model: ymmtParts[2] || "Unknown",
    trim: ymmtParts.slice(3).join(" ") || "Unknown",
    mileage: mileage || "Unknown",
    ymmt: ymmt || "Unknown",
    ...(additionalInfo && { additionalInfo }),
    source: "CarMax My List",
    scrapedAt: new Date().toISOString(),
  };
}

/**
 * Extract total vehicle count from page
 * @param {Page} page - Puppeteer page instance
 * @returns {number} Total number of vehicles expected
 */
async function extractTotalVehicleCount(page) {
  try {
    const totalCountText = await page.$eval(
      ".search-bar-title-STpuhW span",
      (el) => el.innerText
    );
    const match = totalCountText.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  } catch (error) {
    console.log("⚠️ Could not extract total vehicle count, defaulting to 0");
    return 0;
  }
}

/**
 * Enhanced vehicle data extraction for My List with improved scrolling and collection
 * @param {Page} page - Puppeteer page instance
 * @param {number} limit - Maximum number of vehicles to extract
 * @returns {Array} Array of vehicle objects
 */
async function extractMyListVehicles(page, limit = 1000) {
  const totalVehiclesExpected = await extractTotalVehicleCount(page);
  console.log(`🎯 Expected total vehicles: ${totalVehiclesExpected}`);

  const seenVINs = new Set();
  let allVehicles = [];
  let scrollTries = 0;

  console.log("🔍 Extracting vehicle data from My List...");

  while (seenVINs.size < totalVehiclesExpected && scrollTries < 50) {
    // Scroll down gradually to load more content
    await page.evaluate(() => window.scrollBy(0, 300));
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const newData = await page.evaluate(() => {
      const vehicles = [];
      const seenVINs = new Set();

      const selectors = [
        ".vehicle-Tixca", // Primary selector based on the provided HTML
        ".vehicle-list-item",
        ".saved-vehicle-item",
        ".mylist-vehicle",
        '[class*="vehicle-list"]',
        '[class*="vehicle-row"]',
        '[class*="vehicle-card"]',
        '[class*="vehicle"]',
        '[class*="saved-vehicle"]',
        '[class*="mylist"]',
        "tbody tr",
        ".MuiTableBody-root tr",
        '[role="row"]',
        '[data-testid*="vehicle"]',
        '[data-testid*="saved"]',
        ".vehicle-item",
        ".list-item",
      ];

      let vehicleElements = [];
      let bestSelector = "";

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > vehicleElements.length) {
          vehicleElements = elements;
          bestSelector = selector;
        }
      }

      console.log(
        `🔍 Found ${vehicleElements.length} vehicles in My List using "${bestSelector}"`
      );

      for (let i = 0; i < vehicleElements.length; i++) {
        try {
          const element = vehicleElements[i];

          // Extract VIN - based on the HTML structure: .vehicle-vin-VvhMG span
          let vin = null;
          const vinSelectors = [
            ".vehicle-vin-VvhMG span", // Specific selector from provided HTML
            ".vehicle-vin-Mc8Le",
            ".vehicle-vin",
            '[class*="vehicle-vin"] span',
            '[class*="vehicle-vin"]',
            '[class*="vin"] span',
            '[class*="vin"]',
            '[data-testid*="vin"]',
            ".vin",
          ];

          for (const vinSelector of vinSelectors) {
            const vinElement = element.querySelector(vinSelector);
            if (vinElement && vinElement.textContent) {
              const vinText = vinElement.textContent
                .trim()
                .replace(/[^A-HJ-NPR-Z0-9]/gi, "");
              if (vinText && vinText.length === 17) {
                vin = vinText;
                break;
              }
            }
          }

          // Fallback VIN extraction from text content
          if (!vin || vin.length !== 17) {
            const textContent = element.textContent || "";
            const vinMatches = textContent.match(/[A-HJ-NPR-Z0-9]{17}/gi);
            if (vinMatches && vinMatches.length > 0) {
              console.log(`🔍 Fallback VIN extraction found: ${vinMatches[0]}`);
              vin = vinMatches[0];
            }
          }

          // Validate VIN
          if (vin && vin.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) {
            // Check if we've already seen this VIN to prevent duplicates
            if (seenVINs.has(vin)) {
              console.log(`⚠️ Skipping duplicate VIN: ${vin}`);
              continue;
            }

            // Add VIN to seen set
            seenVINs.add(vin);

            // Extract vehicle heading (YMMT) - based on HTML: .vehicle-heading-irWa8 span
            let ymmt = null;
            const ymmtSelectors = [
              ".vehicle-heading-irWa8 span", // Specific selector from provided HTML
              ".vehicle-heading-irWa8",
              ".vehicle-ymmt-I4Jge",
              ".vehicle-ymmt",
              '[class*="vehicle-heading"] span',
              '[class*="vehicle-heading"]',
              '[class*="ymmt"]',
              '[class*="vehicle-title"]',
              '[class*="vehicle-name"]',
              ".vehicle-details",
              "h2",
              "h3",
              "h4", // Common heading tags for vehicle info
            ];

            for (const ymmtSelector of ymmtSelectors) {
              const ymmtElement = element.querySelector(ymmtSelector);
              if (ymmtElement && ymmtElement.textContent) {
                ymmt = ymmtElement.textContent.trim();
                if (ymmt && ymmt.length > 5) break; // Basic validation
              }
            }

            // Extract run number - based on HTML: .vehicle-run-number-TOWny
            let runNumber = null;
            const runNumberSelectors = [
              ".vehicle-run-number-TOWny", // Specific selector from provided HTML
              ".vehicle-run-number-yx1uJ",
              ".vehicle-run-number",
              '[class*="run-number"]',
              '[class*="lot-number"]',
              '[data-testid*="run"]',
              '[data-testid*="lot"]',
            ];

            for (const runSelector of runNumberSelectors) {
              const runElement = element.querySelector(runSelector);
              if (runElement && runElement.textContent) {
                runNumber = runElement.textContent.trim();
                if (runNumber) break;
              }
            }

            // Extract mileage from vehicle-info-n4bAH area
            let mileage = null;
            const mileageSelectors = [
              ".vehicle-info-n4bAH span", // Look in vehicle info area from HTML
              ".vehicle-mileage-aQs6j",
              ".vehicle-mileage",
              '[class*="vehicle-info"] span',
              '[class*="mileage"]',
              '[class*="miles"]',
              '[data-testid*="mileage"]',
              '[data-testid*="miles"]',
            ];

            for (const mileageSelector of mileageSelectors) {
              const mileageElements = element.querySelectorAll(mileageSelector);
              for (const mileageElement of mileageElements) {
                if (mileageElement && mileageElement.textContent) {
                  const text = mileageElement.textContent.trim();
                  if (text && (text.includes("mi") || text.includes("mile"))) {
                    mileage = text;
                    break;
                  }
                }
              }
              if (mileage) break;
            }

            // Extract additional vehicle info (engine, transmission, etc.)
            let additionalInfo = null;
            const additionalInfoElements = element.querySelectorAll(
              ".vehicle-info-n4bAH span"
            );
            if (
              additionalInfoElements.length > 1 &&
              additionalInfoElements[1] &&
              additionalInfoElements[1].textContent
            ) {
              // Usually the second span contains transmission and engine info
              additionalInfo = additionalInfoElements[1].textContent.trim();
            }

            // Parse YMMT
            const ymmtParts = ymmt ? ymmt.split(/\s+/) : [];
            const year = ymmtParts[0] || "Unknown";
            const make = ymmtParts[1] || "Unknown";
            const model = ymmtParts[2] || "Unknown";
            const trim = ymmtParts.slice(3).join(" ") || "Unknown";

            console.log("Current vehicle count:", vehicles.length);
            vehicles.push({
              vin,
              runNumber: runNumber || "Unknown",
              year,
              make,
              model,
              trim,
              mileage: mileage || "Unknown",
              ymmt: ymmt || "Unknown",
              additionalInfo: additionalInfo || "Unknown", // Engine, transmission info
              auctionLocation: "My List",
              auctionIndex: 1,
              scrapedAt: new Date().toISOString(),
              source: "MyList", // Add source identifier
            });

            // Progress logging
            if (vehicles.length % 5 === 0 || i === vehicleElements.length - 1) {
              const progress = (
                ((i + 1) / vehicleElements.length) *
                100
              ).toFixed(1);
              console.log(
                `✅ Extracted ${vehicles.length} vehicles from My List... (${progress}% complete)`
              );
            }
          }
        } catch (err) {
          console.log(
            `⚠️ Error processing vehicle ${i + 1} in My List:`,
            err.message
          );
        }
      }

      console.log(
        `✅ Successfully extracted ${vehicles.length} unique vehicles from My List (found ${seenVINs.size} unique VINs)`
      );
      return vehicles;
    });

    let newAdded = 0;
    for (const v of newData) {
      if (!seenVINs.has(v.vin)) {
        seenVINs.add(v.vin);
        allVehicles.push(v);
        newAdded++;
      }
    }

    if (newAdded === 0) {
      scrollTries++;
    } else {
      scrollTries = 0;
    }

    console.log(
      `🔄 Total collected: ${allVehicles.length} / ${totalVehiclesExpected}`
    );

    // Break if we've collected all expected vehicles
    if (
      totalVehiclesExpected > 0 &&
      allVehicles.length >= totalVehiclesExpected
    ) {
      console.log("✅ Collected all expected vehicles!");
      break;
    }
  }

  return allVehicles;
}

module.exports = {
  loadAllVehicles,
  extractMyListVehicles,
  extractTotalVehicleCount,
  createVehicleObject,
};
