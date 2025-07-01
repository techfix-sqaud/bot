const puppeteer = require("puppeteer");
const config = require("./config");
const { saveJSON, generateDateFilename, launchPuppeteer } = require("./utils");
const annotateUser = require("./vautoAnnotator");

async function loginWithRetry(page, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔐 Login attempt ${attempt}/${maxRetries}...`);
      await login(page);
      return true;
    } catch (error) {
      console.log(`❌ Login attempt ${attempt} failed: ${error.message}`);

      if (attempt === maxRetries) {
        throw error;
      }

      // Wait before retry with exponential backoff
      const delay = Math.min(5000 * Math.pow(2, attempt - 1), 30000);
      console.log(`⏳ Waiting ${delay / 1000} seconds before retry...`);
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Refresh page before retry
      try {
        await page.reload({ waitUntil: "networkidle0", timeout: 15000 });
      } catch (reloadError) {
        console.log(`⚠️ Page reload failed: ${reloadError.message}`);
        await page.goto(config.carmaxUrl, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });
      }
    }
  }
}

async function login(page) {
  try {
    console.log("🌐 Navigating to CarMax...");

    // Use multiple navigation strategies to handle HTTP/2 issues
    const navigationOptions = [
      { waitUntil: "networkidle2", timeout: 30000 },
      { waitUntil: "domcontentloaded", timeout: 20000 },
      { waitUntil: "load", timeout: 15000 },
    ];

    let navigationSuccess = false;
    for (const options of navigationOptions) {
      try {
        await page.goto(config.carmaxUrl, options);
        navigationSuccess = true;
        break;
      } catch (navError) {
        console.log(
          `⚠️ Navigation failed with ${options.waitUntil}: ${navError.message}`
        );
        if (options === navigationOptions[navigationOptions.length - 1]) {
          throw navError;
        }
      }
    }

    if (!navigationSuccess) {
      throw new Error("All navigation strategies failed");
    }

    console.log("✅ Successfully navigated to CarMax");

    // Add delay to ensure page is fully loaded
    await new Promise((resolve) => setTimeout(resolve, 3000));

    await page.waitForSelector("hzn-button", { timeout: 15000 });
    await page.evaluate(() => {
      const btn = document.querySelector("hzn-button");
      btn.shadowRoot.querySelector("button").click();
    });

    await page.waitForSelector("hzn-input#signInName", {
      visible: true,
      timeout: 15000,
    });
    const carmaxEmail = process.env.CARMAX_EMAIL;

    if (!carmaxEmail) {
      throw new Error("CARMAX_EMAIL environment variable is not set");
    }

    await page.evaluate((email) => {
      const inp = document.querySelector("hzn-input#signInName");
      const i = inp.shadowRoot.querySelector("input");
      i.value = email;
      i.dispatchEvent(new Event("input", { bubbles: true }));
      i.dispatchEvent(new Event("change", { bubbles: true }));
    }, carmaxEmail);

    await page.waitForSelector("hzn-button#continueWithEmail", {
      timeout: 10000,
    });
    await page.evaluate(() => {
      document
        .querySelector("hzn-button#continueWithEmail")
        .shadowRoot.querySelector("button")
        .click();
    });

    await new Promise((resolve) => setTimeout(resolve, 4000));
    const carmaxPassword = process.env.CARMAX_PASSWORD;

    if (!carmaxPassword) {
      throw new Error(
        "CARMAX_PASSWORD environment variable is not set or is empty"
      );
    }

    await page.type("#password", carmaxPassword, { delay: 100 });
    await page.waitForSelector("hzn-button#continue", { timeout: 10000 });
    await page.evaluate(() => {
      document
        .querySelector("hzn-button#continue")
        .shadowRoot.querySelector("button")
        .click();
    });

    // Handle navigation with multiple strategies
    try {
      await page.waitForNavigation({
        waitUntil: "networkidle2",
        timeout: 20000,
      });
    } catch (navError) {
      console.log("⚠️ Navigation timeout, trying alternative wait...");
      await page.waitForNavigation({
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });
    }

    console.log("✅ Login completed successfully");
  } catch (error) {
    console.error("❌ Login failed:", error.message);
    throw error;
  }
}

async function navigateToAuctions(page) {
  console.log("🔍 Looking for 'Show all auctions' link...");

  try {
    await page.waitForSelector("hzn-text-link", { timeout: 10000 });

    // Find and click the "Show all auctions" link
    const showAllAuctionsClicked = await page.evaluate(() => {
      const textLinks = document.querySelectorAll("hzn-text-link");
      for (let link of textLinks) {
        const linkText = link.textContent?.trim().toLowerCase();
        if (
          linkText === "show all auctions" ||
          linkText.includes("all auctions")
        ) {
          link.click();
          return true;
        }
      }

      // Also try regular links
      const allLinks = document.querySelectorAll("a");
      for (let link of allLinks) {
        const linkText = link.textContent?.trim().toLowerCase();
        if (
          linkText === "show all auctions" ||
          linkText.includes("all auctions")
        ) {
          link.click();
          return true;
        }
      }

      return false;
    });

    if (showAllAuctionsClicked) {
      console.log('✅ Clicked on "Show all auctions"');
      // Wait for navigation to complete
      //   await page.waitForNavigation({
      //     waitUntil: "networkidle2",
      //     timeout: 10000,
      //   });
      console.log("🔄 Navigation to auctions page completed");
    } else {
      console.log(
        '❌ "Show all auctions" link not found, continuing with current page...'
      );
    }
  } catch (error) {
    console.log('⚠️ Error finding "Show all auctions" link:', error.message);
    console.log("📍 Continuing with current page content...");
  }

  // Wait for page to fully load
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Try multiple possible selectors for auction cards
  const possibleSelectors = [
    '[data-testid="auction-carousel-card"]', // From your HTML sample
    ".auction-card-op7J1", // From your HTML sample
    '[data-testid="auction-card"]',
    ".auction-card",
    ".auction",
    '[class*="auction-card"]',
    '[class*="auction"]',
    '[class*="card"]',
    ".card",
    "article",
    '[role="article"]',
    'div[class*="grid"] > div', // Common grid layouts
    ".auction-container",
    '[class*="auction-item"]',
  ];

  let auctionCards = [];
  let workingSelector = null;

  console.log("🔍 Searching for auction cards with different selectors...");

  for (const selector of possibleSelectors) {
    try {
      console.log(`Trying selector: ${selector}`);
      await page.waitForSelector(selector, { timeout: 3000 });
      auctionCards = await page.$$(selector);
      if (auctionCards.length > 0) {
        workingSelector = selector;
        console.log(
          `✅ Found ${auctionCards.length} elements with selector: ${selector}`
        );
        break;
      }
    } catch (e) {
      console.log(`❌ Selector "${selector}" not found or timed out`);
    }
  }

  if (auctionCards.length === 0) {
    console.log(
      "🔍 No auction cards found with any selector. Let's inspect the page structure..."
    );

    // Get page HTML to debug
    const bodyHTML = await page.evaluate(() => {
      return document.body.innerHTML.substring(0, 2000); // First 2000 chars
    });
    console.log("Page HTML snippet:", bodyHTML);

    // Try to find any clickable elements that might be auction-related
    const clickableElements = await page.evaluate(() => {
      const elements = Array.from(
        document.querySelectorAll(
          'button, a, [onclick], [class*="click"], [class*="btn"]'
        )
      );
      return elements.slice(0, 10).map((el) => ({
        tagName: el.tagName,
        className: el.className,
        text: el.textContent?.trim().substring(0, 50),
        href: el.href || "",
      }));
    });
    console.log("Clickable elements found:", clickableElements);

    throw new Error("No auction cards found on the page");
  }

  console.log(
    `Found ${auctionCards.length} auction cards using selector: ${workingSelector}`
  );

  return workingSelector;
}

async function scrapeSingleAuction(page, auctionsSelector, index) {
  const vehicles = [];

  try {
    console.log(`\n🔄 Starting auction ${index + 1}...`);

    // Wait for auction cards and get them
    await page.waitForSelector(auctionsSelector, { timeout: 5000 });
    const auctionCards = await page.$$(auctionsSelector);

    if (!auctionCards[index]) {
      console.log(`❌ Auction card ${index + 1} not found`);
      return vehicles;
    }

    // Get auction info and click View Cars button
    console.log(`📍 Getting auction info for card ${index + 1}...`);
    const auctionInfo = await getAuctionInfo(page, auctionCards[index], index);
    console.log(`🏁 Processing: ${auctionInfo.location}`);

    const currentUrl = page.url();
    console.log(`🔗 Current URL: ${currentUrl}`);

    if (!(await clickViewCarsButton(page, auctionCards[index], index + 1))) {
      return vehicles;
    }

    // Wait for vehicles page to load
    console.log(`⏳ Waiting for vehicles page to load...`);
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Get total cars info
    const totalCarsInfo = await getTotalCarsInfo(page);
    if (totalCarsInfo) {
      console.log(`📊 Found ${totalCarsInfo.totalCars} total cars available`);
    }

    // Load all vehicles with scrolling
    console.log(`🔄 Loading all vehicles (scrolling/clicking load more)...`);
    await loadAllVehicles(page);

    // Extract vehicle data (limit to 100 for testing)
    console.log(`🔍 Extracting vehicle data...`);
    const vehicleData = await extractVehicleData(
      page,
      index,
      auctionInfo.location,
      100
    );

    vehicles.push(...vehicleData);
    console.log(
      `✅ Extracted ${vehicleData.length} vehicles from ${auctionInfo.location}`
    );

    // Navigate back to auctions list
    const finalUrl = page.url();
    if (currentUrl !== finalUrl) {
      console.log(`🔙 Navigating back to auctions list...`);
      await navigateBackToAuctions(page, auctionsSelector, currentUrl);
    }
  } catch (error) {
    console.log(`❌ Error in auction ${index + 1}: ${error.message}`);
  }

  return vehicles;
}

// Helper function to get auction info
async function getAuctionInfo(page, auctionCard, index) {
  return await page.evaluate(
    (card, idx) => {
      const locationElement =
        card.querySelector(".auction-location, .location, h3, h4, .title") ||
        card.querySelector("[data-testid*='location'], [data-testid*='title']");

      return {
        location: locationElement?.textContent?.trim() || `Auction ${idx + 1}`,
        text: card.textContent?.substring(0, 100) || "",
      };
    },
    auctionCard,
    index
  );
}

// Helper function to click View Cars button
async function clickViewCarsButton(page, auctionCard, auctionNum) {
  console.log(`🖱️ Looking for "View Cars" button...`);

  const result = await page.evaluate((card) => {
    // Find any button with "View Cars" text
    const buttons = card.querySelectorAll(
      'hzn-button, button, a, [role="button"]'
    );

    for (const btn of buttons) {
      const btnText = btn.textContent?.trim().toLowerCase();
      if (btnText.includes("view cars")) {
        // Check if disabled
        if (
          btn.disabled ||
          btn.getAttribute("disabled") !== null ||
          btn.hasAttribute("disabled") ||
          btn.getAttribute("aria-disabled") === "true"
        ) {
          return "disabled";
        }

        // Try to click
        try {
          // For hzn-button, try shadow DOM first
          if (btn.tagName.toLowerCase() === "hzn-button") {
            const shadowButton = btn.shadowRoot?.querySelector("button");
            if (shadowButton) {
              shadowButton.click();
            } else {
              btn.click();
            }
          } else {
            btn.click();
          }
          return "clicked";
        } catch (err) {
          console.log("Click error:", err.message);
        }
      }
    }
    return "not_found";
  }, auctionCard);

  if (result === "disabled") {
    console.log(`⏭️ Skipping auction ${auctionNum} - button disabled`);
    return false;
  } else if (result === "not_found") {
    console.log(`❌ "View Cars" button not found in auction ${auctionNum}`);
    return false;
  } else if (result === "clicked") {
    console.log(
      `✅ Successfully clicked "View Cars" for auction ${auctionNum}`
    );
    return true;
  }

  return false;
}

// Helper function to get total cars info
async function getTotalCarsInfo(page) {
  return await page.evaluate(() => {
    const pageText = document.body?.textContent || "";
    const match = pageText.match(/(\d+)\s*cars?\s*available/i);
    return match
      ? { totalCars: parseInt(match[1]), displayText: match[0] }
      : null;
  });
}

// Helper function to load all vehicles
async function loadAllVehicles(page) {
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

      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.scrollHeight > element.clientHeight) {
          return element;
        }
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
    let attempts = 0;
    const maxAttempts = 15;

    console.log(`🔄 Starting vehicle loading loop...`);

    while (attempts < maxAttempts) {
      const initialCount = countVehicles();

      // Try clicking "SEE MORE MATCHES" button first
      const loadMoreBtn = Array.from(document.querySelectorAll("button")).find(
        (btn) => btn.textContent?.trim().toUpperCase().includes("SEE MORE")
      );

      if (
        loadMoreBtn &&
        !loadMoreBtn.disabled &&
        loadMoreBtn.style.display !== "none"
      ) {
        console.log(
          `📋 Clicking "SEE MORE MATCHES" button (attempt ${attempts + 1})`
        );
        loadMoreBtn.click();
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else {
        // Scroll to bottom
        if (scrollContainer === document.documentElement) {
          window.scrollTo(0, document.body.scrollHeight);
        } else {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      const newCount = countVehicles();
      console.log(
        `📈 Vehicle count: ${initialCount} → ${newCount} (attempt ${
          attempts + 1
        })`
      );

      if (newCount <= initialCount) break;
      attempts++;
    }

    console.log(`✅ Completed loading vehicles after ${attempts} attempts`);
    // Scroll back to top
    window.scrollTo(0, 0);
  });
}

// Helper function to extract vehicle data
async function extractVehicleData(
  page,
  auctionIndex,
  auctionLocation,
  limit = 100
) {
  return await page.evaluate(
    (idx, location, maxVehicles) => {
      const vehicles = [];

      // Find vehicle elements
      const selectors = [
        ".vehicle-list-item",
        '[class*="vehicle-list"]',
        '[class*="vehicle-row"]',
        "tbody tr",
        ".MuiTableBody-root tr",
        '[role="row"]',
        '[data-testid*="vehicle"]',
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
        `🔍 Found ${vehicleElements.length} vehicles using "${bestSelector}"`
      );

      const toProcess = Math.min(vehicleElements.length, maxVehicles);
      console.log(
        `📋 Processing ${toProcess} vehicles (limited for testing)...`
      );

      for (let i = 0; i < toProcess; i++) {
        try {
          const element = vehicleElements[i];

          // Extract VIN
          let vin = null;
          const vinElement = element.querySelector(
            '.vehicle-vin-Mc8Le, .vehicle-vin, [class*="vehicle-vin"]'
          );
          if (vinElement) {
            vin = vinElement.textContent
              ?.trim()
              .replace(/[^A-HJ-NPR-Z0-9]/gi, "");
          }

          // Fallback VIN extraction
          if (!vin) {
            const vinMatch = element.textContent?.match(
              /[A-HJ-NPR-Z0-9\s\-]{15,20}/
            );
            if (vinMatch) {
              vin = vinMatch[0].replace(/[^A-HJ-NPR-Z0-9]/gi, "");
            }
          }

          // Validate VIN
          if (vin && vin.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) {
            // Extract other data
            const ymmt = element
              .querySelector(
                '.vehicle-ymmt-I4Jge, .vehicle-ymmt, [class*="ymmt"]'
              )
              ?.textContent?.trim();
            const runNumber = element
              .querySelector(
                '.vehicle-run-number-yx1uJ, .vehicle-run-number, [class*="run-number"]'
              )
              ?.textContent?.trim();
            const mileage = element
              .querySelector(
                '.vehicle-mileage-aQs6j, .vehicle-mileage, [class*="mileage"]'
              )
              ?.textContent?.trim();

            // Parse YMMT
            const ymmtParts = ymmt ? ymmt.split(/\s+/) : [];
            const year = ymmtParts[0] || "Unknown";
            const make = ymmtParts[1] || "Unknown";
            const model = ymmtParts[2] || "Unknown";
            const trim = ymmtParts.slice(3).join(" ") || "Unknown";

            vehicles.push({
              vin,
              runNumber: runNumber || "Unknown",
              year,
              make,
              model,
              trim,
              mileage: mileage || "Unknown",
              ymmt: ymmt || "Unknown",
              auctionLocation: location,
              auctionIndex: idx + 1,
              scrapedAt: new Date().toISOString(),
            });

            // Progress logging
            if (vehicles.length % 25 === 0) {
              console.log(`✅ Extracted ${vehicles.length} vehicles so far...`);
            }
          }
        } catch (err) {
          // Silent error handling for individual vehicles
        }
      }

      console.log(
        `✅ Successfully extracted ${vehicles.length} valid vehicles`
      );
      return vehicles;
    },
    auctionIndex,
    auctionLocation,
    limit
  );
}

// Helper function to navigate back to auctions
async function navigateBackToAuctions(page, auctionsSelector, originalUrl) {
  try {
    console.log(`🔙 Going back to previous page...`);
    await page.goBack({ waitUntil: "networkidle2", timeout: 10000 });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify we're back on auctions page
    console.log(`🔍 Verifying auction cards are visible...`);
    await page.waitForSelector(auctionsSelector, { timeout: 8000 });

    const cardCount = await page.$$eval(auctionsSelector, (els) => els.length);
    console.log(
      `✅ Successfully returned to auctions page (${cardCount} cards found)`
    );
  } catch (error) {
    console.log(`⚠️ Navigation back failed: ${error.message}`);
    console.log(`🔄 Attempting page refresh...`);

    try {
      await page.reload({ waitUntil: "networkidle2", timeout: 10000 });
      await page.waitForSelector(auctionsSelector, { timeout: 8000 });
      console.log(`✅ Page refreshed successfully`);
    } catch (refreshError) {
      console.log(`❌ Page refresh failed: ${refreshError.message}`);
      throw new Error("Unable to return to auctions page");
    }
  }
}

async function scrapeAuctions() {
  const browser = await launchPuppeteer({
    headless: config.headless,
    protocolTimeout: 120000, // 2 minutes protocol timeout
    args: [
      "--disable-dev-shm-usage",
      "--disable-web-security",
      "--disable-features=VizDisplayCompositor",
    ],
  });
  const page = await browser.newPage();

  // Set longer timeouts for page operations
  page.setDefaultTimeout(60000); // 60 seconds default timeout
  page.setDefaultNavigationTimeout(60000); // 60 seconds navigation timeout

  // Add extra headers to help with HTTP/2 issues
  await page.setExtraHTTPHeaders({
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    DNT: "1",
    Connection: "keep-alive",
    "Upgrade-Insecure-Requests": "1",
  });

  try {
    await loginWithRetry(page);
    console.log("✅ Login completed");

    const auctionsSelector = await navigateToAuctions(page);

    // Wait for auction cards to load after clicking "Show all auctions"
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const auctionCards = await page.$$(auctionsSelector);
    console.log(`Found ${auctionCards.length} auction cards to scrape`);

    if (auctionCards.length === 0) {
      console.log(
        "⚠️ No auction cards found. You may need to update the selectors."
      );

      // Debug: Let's see what elements are actually on the page
      const debugInfo = await page.evaluate(() => {
        const allCards = document.querySelectorAll(
          '[class*="card"], [class*="auction"], [class*="vehicle"]'
        );
        return {
          totalElements: allCards.length,
          elementClasses: Array.from(allCards)
            .slice(0, 5)
            .map((el) => el.className),
          pageTitle: document.title,
          url: window.location.href,
        };
      });
      console.log("Debug info:", debugInfo);
    }

    const vehicles = [];
    const maxAuctionsToProcess = Math.min(auctionCards.length, 10); // Process max 10 auctions to avoid long runtime

    for (let i = 0; i < maxAuctionsToProcess; i++) {
      console.log(
        `🔍 Processing auction ${i + 1} of ${maxAuctionsToProcess} (out of ${
          auctionCards.length
        } total)`
      );

      // Enhanced auction card re-detection with retry logic
      let currentAuctionsSelector = auctionsSelector;
      let auctionProcessed = false;
      const maxSelectorRetries = 3;

      for (
        let selectorRetry = 0;
        selectorRetry < maxSelectorRetries;
        selectorRetry++
      ) {
        try {
          // Try to find auction cards with current selector
          await page.waitForSelector(currentAuctionsSelector, {
            timeout: 8000,
          });

          // Verify we have enough auction cards
          const currentCardCount = await page.$$eval(
            currentAuctionsSelector,
            (els) => els.length
          );

          if (currentCardCount > i) {
            console.log(
              `✅ Found ${currentCardCount} auction cards with selector: ${currentAuctionsSelector}`
            );
            const vinBatch = await scrapeSingleAuction(
              page,
              currentAuctionsSelector,
              i
            );
            vehicles.push(...vinBatch);
            auctionProcessed = true;
            break;
          } else {
            throw new Error(
              `Not enough auction cards: need ${
                i + 1
              }, found ${currentCardCount}`
            );
          }
        } catch (error) {
          console.log(
            `⚠️ Selector retry ${selectorRetry + 1}/${maxSelectorRetries}: ${
              error.message
            }`
          );

          if (selectorRetry < maxSelectorRetries - 1) {
            // Try to re-detect auction cards with different selectors
            console.log(`🔍 Attempting to re-detect auction cards...`);

            const possibleSelectors = [
              '[data-testid="auction-carousel-card"]',
              ".auction-card-op7J1",
              '[data-testid="auction-card"]',
              ".auction-card",
              '[class*="auction-card"]',
              '[class*="auction"]',
            ];

            let foundAlternativeSelector = false;
            for (const testSelector of possibleSelectors) {
              try {
                await page.waitForSelector(testSelector, { timeout: 3000 });
                const testCards = await page.$$(testSelector);
                if (testCards.length > i) {
                  console.log(
                    `✅ Found alternative selector with ${testCards.length} cards: ${testSelector}`
                  );
                  currentAuctionsSelector = testSelector;
                  foundAlternativeSelector = true;
                  break;
                }
              } catch (testError) {
                // Continue to next selector
              }
            }

            if (!foundAlternativeSelector) {
              console.log(
                "⚠️ No alternative selectors found, refreshing page..."
              );
              await page.reload({ waitUntil: "networkidle2", timeout: 15000 });
              await new Promise((resolve) => setTimeout(resolve, 3000));
            }
          }
        }
      }

      if (!auctionProcessed) {
        console.log(
          `❌ Failed to process auction ${
            i + 1
          } after ${maxSelectorRetries} attempts, skipping remaining auctions`
        );
        break;
      }

      // Add a delay between auction processing to avoid overwhelming the server
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Log progress every few auctions
      if ((i + 1) % 3 === 0) {
        console.log(
          `📊 Progress: Processed ${
            i + 1
          }/${maxAuctionsToProcess} auctions, collected ${
            vehicles.length
          } vehicles total`
        );
      }
    }

    console.log(`✅ Scraped and saved ${vehicles.length} vehicles`);
    saveJSON("./data/vehicles.json", vehicles);

    return vehicles;
  } catch (error) {
    console.error("❌ Error in scrapeAuctions:", error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// Helper function to navigate to My List
async function navigateToMyList(page) {
  console.log("🔍 Looking for 'My List' link...");

  try {
    // Wait for the page to load and look for navigation container
    console.log("⏳ Waiting for page elements to load...");
    await page.waitForSelector("body", { timeout: 10000 });

    // Give the page more time to fully load
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // First, let's debug what's actually on the page
    console.log("🔍 Debugging page content...");
    const debugInfo = await page.evaluate(() => {
      const currentUrl = window.location.href;
      const pageTitle = document.title;

      // Look for all links on the page
      const allLinks = Array.from(document.querySelectorAll("a"));
      const linkInfo = allLinks.slice(0, 20).map((link) => ({
        href: link.href,
        text: link.textContent?.trim().substring(0, 50),
        className:
          typeof link.className === "string"
            ? link.className
            : link.className?.toString() || "",
      }));

      // Look for any element containing "my list", "mylist", "saved", etc.
      const potentialMyListElements = Array.from(document.querySelectorAll("*"))
        .filter((el) => {
          const text = el.textContent?.toLowerCase() || "";
          const href = el.href?.toLowerCase() || "";
          // Safely get className as string
          const className = (
            typeof el.className === "string"
              ? el.className
              : el.className?.toString() || ""
          ).toLowerCase();
          return (
            text.includes("my list") ||
            text.includes("mylist") ||
            text.includes("saved") ||
            text.includes("favorites") ||
            href.includes("mylist") ||
            href.includes("saved") ||
            className.includes("mylist") ||
            className.includes("saved")
          );
        })
        .slice(0, 10)
        .map((el) => ({
          tagName: el.tagName,
          text: el.textContent?.trim().substring(0, 100),
          href: el.href || "",
          className:
            typeof el.className === "string"
              ? el.className
              : el.className?.toString() || "",
        }));

      return {
        currentUrl,
        pageTitle,
        totalLinks: allLinks.length,
        linkInfo,
        potentialMyListElements,
      };
    });

    console.log("📊 Page Debug Info:", {
      url: debugInfo.currentUrl,
      title: debugInfo.pageTitle,
      totalLinks: debugInfo.totalLinks,
    });

    console.log("🔗 Available links (first 20):");
    debugInfo.linkInfo.forEach((link, index) => {
      console.log(`  ${index + 1}. "${link.text}" -> ${link.href}`);
    });

    console.log("🎯 Potential My List elements:");
    debugInfo.potentialMyListElements.forEach((el, index) => {
      console.log(
        `  ${index + 1}. ${el.tagName}: "${el.text}" (href: ${el.href})`
      );
    });

    // Find and click the "My List" link using enhanced logic
    const navigationResult = await page.evaluate(() => {
      const results = [];

      // Strategy 1: Try exact href patterns
      const hrefSelectors = [
        'a[href="/mylist"]',
        'a[href*="/mylist"]',
        'a[href*="/my-list"]',
        'a[href*="mylist"]',
        'a[href*="my-list"]',
        'a[href*="favorites"]',
        'a[href*="saved"]',
        'a[href*="wishlist"]',
        'a[href*="saved-vehicles"]',
      ];

      for (const selector of hrefSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          results.push({
            strategy: "href_pattern",
            selector,
            found: elements.length,
            elements: Array.from(elements).map((el) => ({
              href: el.href,
              text: el.textContent?.trim(),
            })),
          });

          // Try clicking the first one
          try {
            elements[0].click();
            return {
              success: true,
              strategy: "href_pattern",
              selector,
              clickedElement: {
                href: elements[0].href,
                text: elements[0].textContent?.trim(),
              },
            };
          } catch (err) {
            results.push({
              strategy: "href_pattern",
              selector,
              error: "Click failed: " + err.message,
            });
          }
        }
      }

      // Strategy 2: Look for text content in all links
      const allLinks = document.querySelectorAll("a");
      const textPatterns = [
        /^my\s*list$/i,
        /^mylist$/i,
        /^saved$/i,
        /^favorites$/i,
        /^wishlist$/i,
        /saved\s*vehicles/i,
        /my\s*saved/i,
      ];

      for (const link of allLinks) {
        const text = link.textContent?.trim() || "";
        for (const pattern of textPatterns) {
          if (pattern.test(text)) {
            results.push({
              strategy: "text_pattern",
              pattern: pattern.toString(),
              found: text,
              href: link.href,
            });

            try {
              link.click();
              return {
                success: true,
                strategy: "text_pattern",
                pattern: pattern.toString(),
                clickedElement: {
                  href: link.href,
                  text: text,
                },
              };
            } catch (err) {
              results.push({
                strategy: "text_pattern",
                error: "Click failed: " + err.message,
              });
            }
          }
        }
      }

      // Strategy 3: Look in navigation containers
      const navContainers = document.querySelectorAll(
        [
          ".sub-header-container-lZOAt",
          ".MuiContainer-root",
          "nav",
          '[class*="nav"]',
          '[class*="header"]',
          '[class*="menu"]',
          '[role="navigation"]',
        ].join(", ")
      );

      for (const container of navContainers) {
        const containerLinks = container.querySelectorAll("a");
        for (const link of containerLinks) {
          const text = link.textContent?.trim().toLowerCase() || "";
          if (
            text.includes("my list") ||
            text.includes("mylist") ||
            text.includes("saved")
          ) {
            results.push({
              strategy: "nav_container",
              container:
                typeof container.className === "string"
                  ? container.className
                  : container.className?.toString() || "",
              found: text,
              href: link.href,
            });

            try {
              link.click();
              return {
                success: true,
                strategy: "nav_container",
                clickedElement: {
                  href: link.href,
                  text: text,
                },
              };
            } catch (err) {
              results.push({
                strategy: "nav_container",
                error: "Click failed: " + err.message,
              });
            }
          }
        }
      }

      return {
        success: false,
        attempts: results,
      };
    });

    console.log("🎯 Navigation attempt result:", navigationResult);

    if (navigationResult.success) {
      console.log(
        `✅ Successfully clicked My List using ${navigationResult.strategy}`
      );
      console.log(
        `   Clicked element: "${navigationResult.clickedElement.text}" -> ${navigationResult.clickedElement.href}`
      );

      // Wait for navigation to complete
      try {
        await page.waitForNavigation({
          waitUntil: "networkidle2",
          timeout: 15000,
        });
        console.log("🔄 Navigation to My List completed");
      } catch (navError) {
        console.log(
          "⚠️ Navigation wait failed, but click may have worked. Continuing..."
        );
      }
    } else {
      console.log(
        '❌ "My List" link not found in any strategy, trying direct URLs...'
      );
      console.log("🔍 Attempted strategies:", navigationResult.attempts);

      // Get current URL for proper navigation
      const currentUrl = page.url();
      const baseUrl = new URL(currentUrl).origin;

      // Try multiple possible My List URLs
      const possibleUrls = [
        `${baseUrl}/mylist`,
        `${baseUrl}/my-list`,
        `${baseUrl}/saved`,
        `${baseUrl}/favorites`,
        `${baseUrl}/saved-vehicles`,
        `${baseUrl}/wishlist`,
        `${baseUrl}/mylist.html`,
        `${baseUrl}/user/mylist`,
        `${baseUrl}/account/mylist`,
        `${baseUrl}/dashboard/mylist`,
      ];

      let directNavSuccess = false;

      for (const testUrl of possibleUrls) {
        try {
          console.log(`🔗 Trying direct navigation to: ${testUrl}`);
          await page.goto(testUrl, {
            waitUntil: "networkidle2",
            timeout: 15000,
          });

          // Check if we successfully loaded a My List page
          const isMyListPage = await page.evaluate(() => {
            const pageText = document.body?.textContent?.toLowerCase() || "";
            const url = window.location.href.toLowerCase();
            const title = document.title.toLowerCase();

            return (
              url.includes("/mylist") ||
              url.includes("/my-list") ||
              url.includes("/saved") ||
              url.includes("/favorites") ||
              pageText.includes("my list") ||
              pageText.includes("saved vehicles") ||
              pageText.includes("favorites") ||
              pageText.includes("wishlist") ||
              title.includes("my list") ||
              title.includes("saved") ||
              title.includes("favorites")
            );
          });

          if (isMyListPage) {
            console.log(`✅ Successfully navigated to My List: ${testUrl}`);
            directNavSuccess = true;
            break;
          } else {
            console.log(
              `❌ ${testUrl} did not load a My List page, trying next URL...`
            );
          }
        } catch (error) {
          console.log(`❌ Failed to navigate to ${testUrl}: ${error.message}`);
        }
      }

      if (!directNavSuccess) {
        // Final fallback: try to find any page that might contain saved vehicles
        console.log(
          "🔍 Final attempt: looking for any saved vehicles functionality..."
        );

        const finalAttempt = await page.evaluate(() => {
          // Look for any element that might trigger My List functionality
          const clickableElements = document.querySelectorAll(
            [
              "button",
              '[role="button"]',
              ".btn",
              '[class*="btn"]',
              "[onclick]",
              '[class*="clickable"]',
            ].join(", ")
          );

          for (const element of clickableElements) {
            const text = element.textContent?.trim().toLowerCase() || "";
            const className = (
              typeof element.className === "string"
                ? element.className
                : element.className?.toString() || ""
            ).toLowerCase();
            const onClick = element.onclick?.toString().toLowerCase() || "";

            if (
              text.includes("my list") ||
              text.includes("saved") ||
              text.includes("favorites") ||
              className.includes("mylist") ||
              className.includes("saved") ||
              onClick.includes("mylist") ||
              onClick.includes("saved")
            ) {
              try {
                element.click();
                return {
                  success: true,
                  element: {
                    text: text,
                    className: className,
                    tagName: element.tagName,
                  },
                };
              } catch (err) {
                return {
                  success: false,
                  error: err.message,
                  element: {
                    text: text,
                    className: className,
                    tagName: element.tagName,
                  },
                };
              }
            }
          }

          return {
            success: false,
            message: "No clickable My List elements found",
          };
        });

        if (finalAttempt.success) {
          console.log(
            "✅ Final attempt successful - clicked element:",
            finalAttempt.element
          );
          await new Promise((resolve) => setTimeout(resolve, 3000));
        } else {
          console.log("❌ Final attempt failed:", finalAttempt);
          throw new Error(
            "Could not navigate to My List using any method. " +
              "Please ensure you have vehicles saved in your list and that the My List feature is accessible. " +
              "The page may have changed its structure or the My List feature may not be available for your account."
          );
        }
      }
    }
  } catch (error) {
    console.log("⚠️ Error in navigateToMyList:", error.message);
    throw new Error(
      "Could not navigate to My List. Please ensure you have vehicles saved in your list and that the My List feature is accessible. " +
        "Error details: " +
        error.message
    );
  }

  // Wait for page to fully load
  console.log("⏳ Waiting for My List page to fully load...");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Final verification that we're on a My List page
  const finalVerification = await page.evaluate(() => {
    const url = window.location.href.toLowerCase();
    const title = document.title.toLowerCase();
    const bodyText = document.body?.textContent?.toLowerCase() || "";

    return {
      url,
      title,
      isMyListPage:
        url.includes("mylist") ||
        url.includes("saved") ||
        url.includes("favorites") ||
        title.includes("my list") ||
        title.includes("saved") ||
        bodyText.includes("my list") ||
        bodyText.includes("saved vehicles"),
      hasVehicleElements:
        document.querySelectorAll(
          [
            ".vehicle-Tixca",
            ".vehicle-list-item",
            ".saved-vehicle-item",
            '[class*="vehicle"]',
          ].join(", ")
        ).length > 0,
    };
  });

  console.log("🔍 Final verification:", finalVerification);

  if (!finalVerification.isMyListPage) {
    console.log("⚠️ Warning: May not be on My List page, but continuing...");
  }
}

// Helper function to extract vehicles from My List
async function extractMyListVehicles(page) {
  console.log("🔍 Extracting vehicle data from My List...");

  return await page.evaluate(() => {
    const vehicles = [];
    const seenVINs = new Set(); // Track unique VINs to prevent duplicates

    // Find vehicle elements - My List has specific structure with .vehicle-Tixca
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
            // Use the
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
          console.log("amount of vehicles", vehicles.length);
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
            const progress = (((i + 1) / vehicleElements.length) * 100).toFixed(
              1
            );
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
}

// Function to scrape vehicles from My List
async function scrapeMyList(jobId = null) {
  const browser = await launchPuppeteer({
    headless: config.headless,
    protocolTimeout: 120000, // 2 minutes protocol timeout
    args: [
      "--disable-dev-shm-usage",
      "--disable-web-security",
      "--disable-features=VizDisplayCompositor",
    ],
  });
  const page = await browser.newPage();

  // Set longer timeouts for page operations
  page.setDefaultTimeout(60000); // 60 seconds default timeout
  page.setDefaultNavigationTimeout(60000); // 60 seconds navigation timeout

  // Add extra headers to help with HTTP/2 issues
  await page.setExtraHTTPHeaders({
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    DNT: "1",
    Connection: "keep-alive",
    "Upgrade-Insecure-Requests": "1",
  });

  // Utility function to check for cancellation
  const checkCancellation = () => {
    if (jobId && global.jobCancellation && global.jobCancellation[jobId]) {
      throw new Error("Job was cancelled by user request");
    }
  };

  let vehicles = [];

  try {
    checkCancellation(); // Check before starting

    await loginWithRetry(page);
    console.log("✅ Login completed");

    checkCancellation(); // Check after login

    await navigateToMyList(page);
    console.log("✅ Navigated to My List");

    checkCancellation(); // Check after navigation

    // Wait for My List content to load
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Check if My List is empty
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

    // Load all vehicles in My List (similar to auction loading)
    console.log("🔄 Loading all vehicles from My List...");
    await loadAllVehicles(page);

    // Extract vehicle data from My List
    console.log("🔍 Extracting vehicle data from My List...");
    const vehicleData = await extractMyListVehicles(page);

    vehicles.push(...vehicleData);
    console.log(`✅ Extracted ${vehicleData.length} vehicles from My List`);

    if (vehicles.length > 0) {
      const filename = generateDateFilename("mylist_vehicles");
      saveJSON(filename, vehicles);
      console.log(`📁 My List data saved to: ${filename}`);

      // Call vAuto annotator to enrich the data
      console.log("🔄 Starting vAuto annotation for My List vehicles...");
      try {
        // Create user object for vAuto annotation
        const userForAnnotation = {
          email: "mylist@carmax.com", // Placeholder email for My List vehicles
          vins: vehicles
            .map((v) => v.vin)
            .filter((vin) => vin && vin !== "Unknown"),
        };

        if (userForAnnotation.vins.length === 0) {
          console.log("⚠️ No valid VINs found for vAuto annotation");
          return {
            vehicles,
            filename,
            summary: {
              total: vehicles.length,
              successful: vehicles.length,
              failed: 0,
              annotated: 0,
            },
          };
        }

        console.log(
          `🔍 Annotating ${userForAnnotation.vins.length} VINs with vAuto...`
        );
        const annotationResults = await annotateUser(userForAnnotation);

        // Merge annotation results back into vehicle data
        const annotatedVehicles = vehicles.map((vehicle) => {
          const annotation = annotationResults.find(
            (result) => result.vin === vehicle.vin && result.success
          );

          if (annotation && annotation.evaluation) {
            return {
              ...vehicle,
              vautoData: annotation.evaluation,
              vautoAnnotated: true,
              vautoTimestamp: new Date().toISOString(),
            };
          }

          return {
            ...vehicle,
            vautoAnnotated: false,
            vautoError:
              annotationResults.find((r) => r.vin === vehicle.vin)?.error ||
              "No annotation available",
          };
        });

        // Save the annotated data back to the same file
        saveJSON(filename, annotatedVehicles);

        const successfulAnnotations = annotationResults.filter(
          (r) => r.success
        ).length;
        console.log(
          `✅ vAuto annotation completed. ${successfulAnnotations}/${annotationResults.length} vehicles annotated`
        );

        return {
          vehicles: annotatedVehicles,
          filename,
          summary: {
            total: vehicles.length,
            successful: vehicles.length,
            failed: 0,
            annotated: successfulAnnotations,
            annotationFailed: annotationResults.length - successfulAnnotations,
          },
        };
      } catch (annotationError) {
        console.log(`❌ vAuto annotation failed: ${annotationError.message}`);
        // Return the original data even if annotation fails
        return {
          vehicles,
          filename,
          annotationError: annotationError.message,
          summary: {
            total: vehicles.length,
            successful: vehicles.length,
            failed: 0,
            annotated: 0,
            annotationFailed: vehicles.length,
          },
        };
      }
    } else {
      console.log("⚠️ No valid vehicles found in My List");
      return {
        vehicles: [],
        filename: null,
        summary: {
          total: 0,
          successful: 0,
          failed: 0,
          annotated: 0,
        },
      };
    }
  } catch (error) {
    // Check if this was a cancellation
    if (error.message && error.message.includes("cancelled")) {
      console.log("🛑 My List scraping was cancelled");

      // Save whatever we got so far if we have any vehicles
      if (vehicles && vehicles.length > 0) {
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
            annotated: 0,
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
            annotated: 0,
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
  scrapeAuctions,
  scrapeMyList,
};
