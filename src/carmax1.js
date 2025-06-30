const puppeteer = require("puppeteer");
const config = require("./config");
const { saveJSON } = require("./utils");

async function login(page) {
  await page.goto(config.carmaxUrl, { waitUntil: "networkidle2" });
  await page.waitForSelector("hzn-button");
  await page.evaluate(() => {
    const btn = document.querySelector("hzn-button");
    btn.shadowRoot.querySelector("button").click();
  });
  await page.waitForSelector("hzn-input#signInName", { visible: true });
  const carmaxEmail = process.env.CARMAX_EMAIL;
  await page.evaluate((email) => {
    const inp = document.querySelector("hzn-input#signInName");
    const i = inp.shadowRoot.querySelector("input");
    i.value = email;
    i.dispatchEvent(new Event("input", { bubbles: true }));
    i.dispatchEvent(new Event("change", { bubbles: true }));
  }, carmaxEmail);
  await page.waitForSelector("hzn-button#continueWithEmail");
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
  await page.waitForSelector("hzn-button#continue");
  await page.evaluate(() => {
    document
      .querySelector("hzn-button#continue")
      .shadowRoot.querySelector("button")
      .click();
  });
  await page.waitForNavigation({ waitUntil: "networkidle2" });
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

    // Switch to detailed table view for better data extraction
    console.log(`🔄 Switching to detailed table view...`);
    await switchToDetailedTableView(page);

    // Load all vehicles with scrolling
    console.log(`🔄 Loading all vehicles (scrolling/clicking load more)...`);
    await loadAllVehicles(page);

    // Extract vehicle data (increase limit to see more results)
    console.log(`🔍 Extracting vehicle data...`);
    const vehicleData = await extractVehicleData(
      page,
      index,
      auctionInfo.location,
      500 // Increased from 100 to capture more vehicles for testing
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
        ".vehicle-Tixca", // Add the new vehicle selector
        ".vehicle-list-item",
        '[class*="vehicle-list"]',
        '[class*="vehicle-row"]',
        "tbody tr",
        ".MuiTableBody-root tr",
        '[role="row"]',
        "[data-index]", // Add data-index selector
      ];

      const counts = selectors.map((sel) => {
        const count = document.querySelectorAll(sel).length;
        console.log(`Selector "${sel}": ${count} elements`);
        return count;
      });

      return Math.max(...counts);
    };

    const scrollContainer = findScrollContainer();
    let attempts = 0;
    const maxAttempts = 30; // Increased from 15 to 30

    console.log(`🔄 Starting vehicle loading loop...`);
    console.log(`Initial vehicle count check:`);
    const initialVehicleCount = countVehicles();

    while (attempts < maxAttempts) {
      const initialCount = countVehicles();

      // Try clicking "SEE MORE MATCHES" button first
      const loadMoreBtn = Array.from(document.querySelectorAll("button")).find(
        (btn) => {
          const btnText = btn.textContent?.trim().toUpperCase();
          return (
            btnText.includes("SEE MORE") ||
            btnText.includes("LOAD MORE") ||
            btnText.includes("SHOW MORE")
          );
        }
      );

      if (
        loadMoreBtn &&
        !loadMoreBtn.disabled &&
        loadMoreBtn.style.display !== "none" &&
        !loadMoreBtn.style.visibility === "hidden"
      ) {
        console.log(
          `📋 Clicking "${loadMoreBtn.textContent?.trim()}" button (attempt ${
            attempts + 1
          })`
        );
        loadMoreBtn.click();
        await new Promise((resolve) => setTimeout(resolve, 3000)); // Increased wait time
      } else {
        // Debug: check what buttons are available
        if (attempts === 0) {
          const allButtons = Array.from(document.querySelectorAll("button"))
            .map((btn) => btn.textContent?.trim())
            .filter((text) => text && text.length > 0)
            .slice(0, 10);
          console.log(`Available buttons: ${JSON.stringify(allButtons)}`);
        }

        // Scroll to bottom
        console.log(
          `📜 Scrolling to load more vehicles (attempt ${attempts + 1})`
        );
        if (scrollContainer === document.documentElement) {
          window.scrollTo(0, document.body.scrollHeight);
        } else {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Increased wait time
      }

      const newCount = countVehicles();
      console.log(
        `📈 Vehicle count: ${initialCount} → ${newCount} (attempt ${
          attempts + 1
        })`
      );

      if (newCount <= initialCount) {
        console.log(
          `⏹️ No new vehicles loaded, stopping after ${attempts + 1} attempts`
        );
        break;
      }
      attempts++;
    }

    console.log(`✅ Completed loading vehicles after ${attempts} attempts`);

    // Final count with all selectors for debugging
    console.log(`🔍 Final vehicle count check:`);
    const finalCount = countVehicles();
    console.log(`📊 Total vehicles found: ${finalCount}`);

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

      // Find vehicle elements - prioritize the new vehicle card format
      const selectors = [
        ".vehicle-Tixca", // Main vehicle container from the HTML you provided
        "[data-index]", // Vehicle containers with data-index
        ".vehicle-main-lLy44", // Vehicle main container
        "tbody tr", // Table rows (detailed view)
        ".MuiTableBody-root tr", // Material UI table rows
        '[role="row"]', // Accessible table rows
        ".vehicle-list-item",
        '[class*="vehicle-list"]',
        '[class*="vehicle-row"]',
        '[data-testid*="vehicle"]',
        '[class*="table-row"]',
        'tr[class*="vehicle"]',
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

      let validVinCount = 0;
      let processedCount = 0;

      // Debug: Log the first few elements to see their structure
      if (vehicleElements.length > 0) {
        console.log(`🔍 Debugging first vehicle element structure:`);
        const firstElement = vehicleElements[0];
        const firstElementInfo = {
          className: firstElement.className,
          innerHTML: firstElement.innerHTML.substring(0, 500),
          vinElements: firstElement.querySelectorAll(
            '.vehicle-vin-VvhMG, .vehicle-vin-VvhMG span, [class*="vin"]'
          ).length,
          headingElements: firstElement.querySelectorAll(
            ".vehicle-heading-irWa8, .vehicle-heading-irWa8 span"
          ).length,
        };
        console.log(
          "First element info:",
          JSON.stringify(firstElementInfo, null, 2)
        );
      }

      for (let i = 0; i < toProcess; i++) {
        try {
          const element = vehicleElements[i];
          processedCount++;

          // Extract VIN with multiple strategies optimized for the new format
          let vin = null;

          // Strategy 1: Look for the specific VIN container class from your HTML
          const vinSelectors = [
            ".vehicle-vin-VvhMG span", // Specific VIN span from your HTML
            ".vehicle-vin-VvhMG", // VIN container
            ".vehicle-vin-Mc8Le",
            ".vehicle-vin",
            '[class*="vehicle-vin"]',
            'td[class*="vin"]',
            'span[class*="vin"]',
            '[data-testid*="vin"]',
            "td:nth-child(7)",
            "td:nth-child(8)",
            "td:nth-child(9)", // Common VIN column positions
          ];

          for (const selector of vinSelectors) {
            const vinElement = element.querySelector(selector);
            if (vinElement) {
              const potentialVin = vinElement.textContent
                ?.trim()
                .replace(/[^A-HJ-NPR-Z0-9]/gi, "");
              if (
                potentialVin &&
                potentialVin.length === 17 &&
                /^[A-HJ-NPR-Z0-9]{17}$/i.test(potentialVin)
              ) {
                vin = potentialVin;
                console.log(
                  `✅ Found VIN using selector "${selector}": ${vin}`
                );
                break;
              }
            }
          }

          // Strategy 2: Look for VIN in all table cells
          if (!vin) {
            const allCells = element.querySelectorAll("td, span, div");
            for (const cell of allCells) {
              const cellText = cell.textContent?.trim() || "";
              const potentialVin = cellText.replace(/[^A-HJ-NPR-Z0-9]/gi, "");
              if (
                potentialVin.length === 17 &&
                /^[A-HJ-NPR-Z0-9]{17}$/i.test(potentialVin)
              ) {
                vin = potentialVin;
                break;
              }
            }
          }

          // Strategy 3: Fallback - search entire element text
          if (!vin) {
            const fullText = element.textContent || "";
            const vinMatches = fullText.match(/[A-HJ-NPR-Z0-9]{17}/g);
            if (vinMatches) {
              for (const match of vinMatches) {
                if (/^[A-HJ-NPR-Z0-9]{17}$/i.test(match)) {
                  vin = match;
                  break;
                }
              }
            }
          }

          // Validate VIN and extract other data
          if (vin && vin.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) {
            validVinCount++;
            console.log(`🎯 Processing vehicle ${i + 1} with VIN: ${vin}`);

            // Extract other data with improved selectors for the new format
            const ymmtSelectors = [
              ".vehicle-heading-irWa8 span", // Year/Make/Model from your HTML
              ".vehicle-heading-irWa8", // Heading container
              ".vehicle-ymmt-I4Jge",
              ".vehicle-ymmt",
              '[class*="ymmt"]',
              "td:nth-child(1)",
              "td:nth-child(2)",
              "td:nth-child(3)",
              '[data-testid*="make"]',
              '[data-testid*="model"]',
            ];

            const runNumberSelectors = [
              ".vehicle-run-number-TOWny", // Run number from your HTML
              ".vehicle-run-number-yx1uJ",
              ".vehicle-run-number",
              '[class*="run-number"]',
              "td:nth-child(4)",
              "td:nth-child(5)",
              '[data-testid*="run"]',
            ];

            const mileageSelectors = [
              ".vehicle-info-n4bAH span:first-child", // Mileage from your HTML
              ".vehicle-mileage-aQs6j",
              ".vehicle-mileage",
              '[class*="mileage"]',
              "td:nth-child(6)",
              '[data-testid*="mileage"]',
              '[class*="odometer"]',
            ];

            // Find YMMT
            let ymmt = null;
            for (const selector of ymmtSelectors) {
              const el = element.querySelector(selector);
              if (el && el.textContent?.trim()) {
                ymmt = el.textContent.trim();
                break;
              }
            }

            // Find run number
            let runNumber = null;
            for (const selector of runNumberSelectors) {
              const el = element.querySelector(selector);
              if (el && el.textContent?.trim()) {
                runNumber = el.textContent.trim();
                break;
              }
            }

            // Find mileage
            let mileage = null;
            for (const selector of mileageSelectors) {
              const el = element.querySelector(selector);
              if (el && el.textContent?.trim()) {
                mileage = el.textContent.trim();
                break;
              }
            }

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
            if (vehicles.length % 25 === 0 && vehicles.length > 0) {
              console.log(`✅ Extracted ${vehicles.length} vehicles so far...`);
            }
          } else {
            // Debug why VIN wasn't found
            if (i < 5) {
              // Only debug first 5 vehicles to avoid spam
              console.log(
                `❌ Vehicle ${i + 1}: No valid VIN found. Element class: ${
                  element.className
                }`
              );
              const vinElements = element.querySelectorAll(
                '[class*="vin"], span'
              );
              console.log(
                `   Found ${vinElements.length} potential VIN elements`
              );
              if (vinElements.length > 0) {
                console.log(
                  `   First potential VIN text: "${vinElements[0].textContent
                    ?.trim()
                    ?.substring(0, 50)}"`
                );
              }
            }
          }
        } catch (err) {
          // Silent error handling for individual vehicles
          console.log(`⚠️ Error processing vehicle ${i + 1}: ${err.message}`);
        }
      }

      console.log(
        `📊 Processing summary: ${processedCount} processed, ${validVinCount} with valid VINs, ${vehicles.length} final vehicles`
      );
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

    // Try going back first
    await page.goBack({ waitUntil: "networkidle2", timeout: 15000 });
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Verify we're back on auctions page
    console.log(`🔍 Verifying auction cards are visible...`);
    await page.waitForSelector(auctionsSelector, { timeout: 10000 });

    const cardCount = await page.$$eval(auctionsSelector, (els) => els.length);
    console.log(
      `✅ Successfully returned to auctions page (${cardCount} cards found)`
    );
  } catch (error) {
    console.log(`⚠️ Navigation back failed: ${error.message}`);
    console.log(`🔄 Attempting to navigate to original URL: ${originalUrl}`);

    try {
      // Try navigating to the original URL instead
      await page.goto(originalUrl, {
        waitUntil: "networkidle2",
        timeout: 15000,
      });
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Wait for auction cards
      await page.waitForSelector(auctionsSelector, { timeout: 10000 });
      const cardCount = await page.$$eval(
        auctionsSelector,
        (els) => els.length
      );
      console.log(
        `✅ Successfully navigated to original URL (${cardCount} cards found)`
      );
    } catch (urlError) {
      console.log(`⚠️ URL navigation failed: ${urlError.message}`);
      console.log(`🔄 Attempting page refresh...`);

      try {
        await page.reload({ waitUntil: "networkidle2", timeout: 15000 });
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await page.waitForSelector(auctionsSelector, { timeout: 10000 });
        console.log(`✅ Page refreshed successfully`);
      } catch (refreshError) {
        console.log(`❌ Page refresh failed: ${refreshError.message}`);
        throw new Error("Unable to return to auctions page");
      }
    }
  }
}

// Helper function to switch to detailed table view
async function switchToDetailedTableView(page) {
  try {
    console.log("🔍 Looking for detailed table view button...");

    const result = await page.evaluate(() => {
      // Look for the detailed table view button with multiple selectors
      const selectors = [
        '[data-testid="detailed"]',
        'button[value="detailed"]',
        'button[aria-label="Detailed table View"]',
        '.MuiToggleButton-root[value="detailed"]',
      ];

      let detailedButton = null;
      let usedSelector = "";

      for (const selector of selectors) {
        detailedButton = document.querySelector(selector);
        if (detailedButton) {
          usedSelector = selector;
          break;
        }
      }

      if (detailedButton) {
        // Check if it's not already selected
        const isSelected =
          detailedButton.getAttribute("aria-pressed") === "true" ||
          detailedButton.classList.contains("Mui-selected");

        console.log(`Found detailed button with selector: ${usedSelector}`);
        console.log(`Button already selected: ${isSelected}`);
        console.log(`Button classes: ${detailedButton.className}`);
        console.log(
          `Button aria-pressed: ${detailedButton.getAttribute("aria-pressed")}`
        );

        if (!isSelected) {
          console.log("🔄 Clicking detailed table view button...");
          detailedButton.click();
          return { success: true, action: "clicked" };
        } else {
          console.log("✅ Already in detailed table view");
          return { success: true, action: "already_selected" };
        }
      } else {
        console.log("⚠️ Detailed table view button not found");

        // Debug: let's see what buttons are available
        const allButtons = document.querySelectorAll("button");
        console.log(`Found ${allButtons.length} buttons on page`);

        const toggleButtons = document.querySelectorAll(
          '.MuiToggleButton-root, [role="group"] button'
        );
        console.log(`Found ${toggleButtons.length} toggle buttons`);

        if (toggleButtons.length > 0) {
          const buttonInfo = Array.from(toggleButtons).map((btn) => ({
            value: btn.getAttribute("value"),
            testId: btn.getAttribute("data-testid"),
            ariPressed: btn.getAttribute("aria-pressed"),
            classes: btn.className,
            text: btn.textContent?.trim().substring(0, 50),
          }));
          console.log(
            "Toggle button info:",
            JSON.stringify(buttonInfo, null, 2)
          );
        }

        return { success: false, action: "not_found" };
      }
    });

    if (result.success) {
      // Wait for view to change
      await new Promise((resolve) => setTimeout(resolve, 3000));

      if (result.action === "clicked") {
        console.log("✅ Successfully clicked detailed table view button");
      } else {
        console.log("✅ Already in detailed table view");
      }

      return true;
    } else {
      console.log("❌ Failed to switch to detailed table view");
      return false;
    }
  } catch (error) {
    console.log(`⚠️ Error switching to detailed view: ${error.message}`);
    return false;
  }
}

async function scrapeAuctions() {
  const browser = await puppeteer.launch(config.getPuppeteerOptions());
  const page = await browser.newPage();

  // Set longer timeouts for page operations
  page.setDefaultTimeout(60000); // 60 seconds default timeout
  page.setDefaultNavigationTimeout(60000); // 60 seconds navigation timeout

  try {
    await login(page);
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

module.exports = scrapeAuctions;
