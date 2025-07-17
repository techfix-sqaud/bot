const { carmaxUrl, headless } = require("./config");
const { saveJSON, loadJSON, launchPuppeteer } = require("./utils");

/**
 * Login to CarMax
 */
async function login(page) {
  await page.goto(carmaxUrl, { waitUntil: "networkidle2" });
  await page.waitForSelector("hzn-button");
  await page.evaluate(() => {
    const btn = document.querySelector("hzn-button");
    btn.shadowRoot.querySelector("button").click();
  });

  // Wait for login page to load
  await page.waitForSelector('input[type="email"]', { visible: true });

  // Enter email
  const carmaxEmail = process.env.CARMAX_EMAIL;
  const carmaxPassword = process.env.CARMAX_PASSWORD;

  if (!carmaxEmail || !carmaxPassword) {
    throw new Error("Missing CarMax credentials in environment variables");
  }

  await page.type('input[type="email"]', carmaxEmail, { delay: 100 });
  await page.click('button[type="submit"]');

  // Wait for password field
  await page.waitForSelector('input[type="password"]', { visible: true });
  await page.type('input[type="password"]', carmaxPassword, { delay: 100 });
  await page.click('button[type="submit"]');

  // Wait for login to complete
  await page.waitForNavigation({ waitUntil: "networkidle2" });
  console.log("✅ CarMax login completed");
}

/**
 * Navigate to My List
 */
async function navigateToMyList(page) {
  console.log("🔍 Navigating to My List...");

  // Look for My List or saved vehicles link
  try {
    // Try different possible selectors for My List
    const myListSelectors = [
      'a[href*="saved"]',
      'a[href*="mylist"]',
      'a[href*="favorites"]',
      'a[href*="wishlist"]',
      '[data-testid*="saved"]',
      '[data-testid*="mylist"]',
      'button:contains("My List")',
      'a:contains("My List")',
      'a:contains("Saved")',
      'a:contains("Favorites")',
    ];

    let myListFound = false;
    for (const selector of myListSelectors) {
      try {
        if (selector.includes(":contains")) {
          // Use page.evaluate for text-based selectors
          const element = await page.evaluateHandle(() => {
            return Array.from(document.querySelectorAll("a, button")).find(
              (el) =>
                el.textContent.toLowerCase().includes("my list") ||
                el.textContent.toLowerCase().includes("saved") ||
                el.textContent.toLowerCase().includes("favorites")
            );
          });

          if (element) {
            await element.click();
            myListFound = true;
            break;
          }
        } else {
          await page.waitForSelector(selector, { timeout: 2000 });
          await page.click(selector);
          myListFound = true;
          break;
        }
      } catch (error) {
        // Continue to next selector
        continue;
      }
    }

    if (!myListFound) {
      console.log(
        "⚠️ Could not find My List navigation. Looking for direct URL..."
      );

      // Try direct navigation to common My List URLs
      const myListUrls = [
        `${carmaxUrl}/saved-vehicles`,
        `${carmaxUrl}/my-list`,
        `${carmaxUrl}/favorites`,
        `${carmaxUrl}/account/saved-vehicles`,
      ];

      for (const url of myListUrls) {
        try {
          await page.goto(url, { waitUntil: "networkidle2" });

          // Check if we're on a valid My List page
          const pageContent = await page.evaluate(
            () => document.body.textContent
          );
          if (
            pageContent.includes("saved") ||
            pageContent.includes("My List") ||
            pageContent.includes("favorites")
          ) {
            console.log(`✅ Found My List at: ${url}`);
            myListFound = true;
            break;
          }
        } catch (error) {
          continue;
        }
      }
    }

    if (!myListFound) {
      throw new Error(
        "Could not find or navigate to My List. Please ensure you have saved vehicles."
      );
    }

    // Wait for the page to load
    await page.waitForTimeout(3000);
    console.log("✅ Successfully navigated to My List");
  } catch (error) {
    throw new Error(`Failed to navigate to My List: ${error.message}`);
  }
}

/**
 * Scrape vehicles from My List
 */
async function scrapeMyListVehicles(page) {
  console.log("📋 Scraping vehicles from My List...");

  try {
    // Wait for vehicle cards to load
    await page.waitForTimeout(2000);

    // Look for vehicle cards/containers
    const vehicleSelectors = [
      '[data-testid*="vehicle"]',
      ".vehicle-card",
      ".car-card",
      ".listing",
      '[class*="vehicle"]',
      '[class*="car"]',
    ];

    let vehicles = [];

    for (const selector of vehicleSelectors) {
      try {
        const foundVehicles = await page.$$eval(selector, (elements) => {
          return elements
            .map((element, index) => {
              try {
                // Extract basic vehicle information
                const titleElement = element.querySelector(
                  'h1, h2, h3, h4, .title, [class*="title"]'
                );
                const title = titleElement
                  ? titleElement.textContent.trim()
                  : `Vehicle ${index + 1}`;

                // Try to find VIN
                const vinElement =
                  element.querySelector(
                    '[data-testid*="vin"], .vin, [class*="vin"]'
                  ) ||
                  Array.from(element.querySelectorAll("*")).find((el) =>
                    el.textContent.match(/VIN[\s:]*([A-HJ-NPR-Z0-9]{17})/i)
                  );
                const vin = vinElement
                  ? (vinElement.textContent.match(/([A-HJ-NPR-Z0-9]{17})/i) || [
                      "",
                      "",
                    ])[1]
                  : null;

                // Try to find mileage
                const mileageElement =
                  element.querySelector(
                    '[data-testid*="mileage"], .mileage, [class*="mileage"]'
                  ) ||
                  Array.from(element.querySelectorAll("*")).find((el) =>
                    el.textContent.match(/\d{1,3}(,\d{3})*\s*(mi|miles|k|km)/i)
                  );
                const mileageText = mileageElement
                  ? mileageElement.textContent
                  : "";
                const mileage =
                  mileageText
                    .match(/(\d{1,3}(?:,\d{3})*)/)?.[1]
                    ?.replace(/,/g, "") || null;

                // Try to find year and make/model
                const yearMatch = title.match(/\b(19|20)\d{2}\b/);
                const year = yearMatch ? yearMatch[0] : null;

                // Extract make and model (everything after year)
                const makeModel = year ? title.replace(year, "").trim() : title;

                // Try to find href/link
                const linkElement = element.querySelector("a[href]");
                const href = linkElement
                  ? linkElement.getAttribute("href")
                  : null;

                // Try to find additional details
                const engineElement = element.querySelector(
                  '[class*="engine"], [data-testid*="engine"]'
                );
                const engine = engineElement
                  ? engineElement.textContent.trim()
                  : null;

                return {
                  title,
                  year,
                  makeModel,
                  vin,
                  mileage,
                  engine,
                  href,
                  scrapedAt: new Date().toISOString(),
                  source: "CarMax My List",
                };
              } catch (error) {
                console.warn(
                  `Error extracting vehicle ${index}:`,
                  error.message
                );
                return null;
              }
            })
            .filter((vehicle) => vehicle !== null);
        });

        if (foundVehicles.length > 0) {
          vehicles = foundVehicles;
          console.log(
            `✅ Found ${vehicles.length} vehicles using selector: ${selector}`
          );
          break;
        }
      } catch (error) {
        continue;
      }
    }

    if (vehicles.length === 0) {
      console.log(
        "⚠️ No vehicles found in My List with standard selectors. Trying alternative extraction..."
      );

      // Alternative extraction method
      vehicles = await page.evaluate(() => {
        const allElements = document.querySelectorAll("*");
        const vehicleData = [];

        // Look for VINs anywhere on the page
        Array.from(allElements).forEach((element, index) => {
          const text = element.textContent || "";
          const vinMatch = text.match(/VIN[\s:]*([A-HJ-NPR-Z0-9]{17})/i);

          if (vinMatch) {
            const vin = vinMatch[1];

            // Try to find associated vehicle info
            let container = element;
            for (let i = 0; i < 5; i++) {
              container = container.parentElement;
              if (!container) break;
            }

            if (container) {
              const containerText = container.textContent;
              const yearMatch = containerText.match(/\b(19|20)\d{2}\b/);
              const mileageMatch = containerText.match(
                /(\d{1,3}(?:,\d{3})*)\s*(?:mi|miles)/i
              );

              vehicleData.push({
                title: `Vehicle ${vehicleData.length + 1}`,
                year: yearMatch ? yearMatch[0] : null,
                makeModel: "Unknown",
                vin: vin,
                mileage: mileageMatch
                  ? mileageMatch[1].replace(/,/g, "")
                  : null,
                engine: null,
                href: null,
                scrapedAt: new Date().toISOString(),
                source: "CarMax My List (Alternative)",
              });
            }
          }
        });

        return vehicleData;
      });
    }

    return vehicles;
  } catch (error) {
    console.error("Error scraping My List vehicles:", error.message);
    return [];
  }
}

/**
 * Main function to scrape CarMax My List
 */
async function scrapeMyList() {
  console.log("🚀 Starting CarMax My List scraping...");

  const browser = await launchPuppeteer({
    headless,
    args: ["--disable-web-security", "--disable-features=VizDisplayCompositor"],
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(60000);

  try {
    // Login to CarMax
    await login(page);

    // Navigate to My List
    await navigateToMyList(page);

    // Scrape vehicles from My List
    const vehicles = await scrapeMyListVehicles(page);

    if (vehicles.length === 0) {
      console.log("⚠️ No vehicles found in My List. This could mean:");
      console.log("   - Your My List is empty");
      console.log("   - The page structure has changed");
      console.log("   - Navigation to My List failed");
      return [];
    }

    console.log(
      `📋 Successfully scraped ${vehicles.length} vehicles from My List`
    );

    // Load existing vehicles and merge
    const existingVehicles = loadJSON("./data/vehicles.json");
    const allVehicles = [...existingVehicles];

    // Add new vehicles (avoid duplicates by VIN)
    let newCount = 0;
    vehicles.forEach((vehicle) => {
      if (vehicle.vin) {
        const exists = allVehicles.find(
          (existing) => existing.vin === vehicle.vin
        );
        if (!exists) {
          allVehicles.push(vehicle);
          newCount++;
        }
      } else {
        // If no VIN, add anyway but with warning
        allVehicles.push(vehicle);
        newCount++;
      }
    });

    // Save updated vehicles
    saveJSON("./data/vehicles.json", allVehicles);

    console.log(`✅ My List scraping completed!`);
    console.log(`   Total vehicles in database: ${allVehicles.length}`);
    console.log(`   New vehicles from My List: ${newCount}`);

    return allVehicles;
  } catch (error) {
    console.error("❌ My List scraping failed:", error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeMyList };
