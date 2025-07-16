const puppeteer = require("puppeteer");
const config = require("./config");
require("dotenv").config();
const { saveJSON, generateDateFilename, launchPuppeteer } = require("./utils");
const { annotateUser } = require("./vautoAnnotator");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function setupBrowser() {
  const browser = await launchPuppeteer({
    headless: config.headless,
    protocolTimeout: 120000,
    args: [
      "--disable-dev-shm-usage",
      "--disable-web-security",
      "--disable-features=VizDisplayCompositor",
    ],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(60000);
  await page.setExtraHTTPHeaders({
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    DNT: "1",
    Connection: "keep-alive",
    "Upgrade-Insecure-Requests": "1",
  });
  return { browser, page };
}

async function loginWithRetry(page, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await login(page);
      return true;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await sleep(Math.min(5000 * Math.pow(2, attempt - 1), 30000));
      try {
        await page.reload({ waitUntil: "networkidle0", timeout: 15000 });
      } catch {
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
    // Try navigation with fallback
    try {
      await page.goto(config.carmaxUrl, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
    } catch {
      await page.goto(config.carmaxUrl, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
    }

    await sleep(3000);

    // Login flow
    await page.waitForSelector("hzn-button", { timeout: 15000 });
    await page.evaluate(() =>
      document
        .querySelector("hzn-button")
        .shadowRoot.querySelector("button")
        .click()
    );

    const carmaxEmail = process.env.CARMAX_EMAIL;
    if (!carmaxEmail)
      throw new Error("CARMAX_EMAIL environment variable is not set");

    await page.waitForSelector("hzn-input#signInName", {
      visible: true,
      timeout: 15000,
    });
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
    await page.evaluate(() =>
      document
        .querySelector("hzn-button#continueWithEmail")
        .shadowRoot.querySelector("button")
        .click()
    );

    await sleep(4000);
    const carmaxPassword = process.env.CARMAX_PASSWORD;
    if (!carmaxPassword)
      throw new Error(
        "CARMAX_PASSWORD environment variable is not set or is empty"
      );

    await page.type("#password", carmaxPassword, { delay: 100 });
    await page.waitForSelector("hzn-button#continue", { timeout: 10000 });
    await page.evaluate(() =>
      document
        .querySelector("hzn-button#continue")
        .shadowRoot.querySelector("button")
        .click()
    );

    try {
      await page.waitForNavigation({
        waitUntil: "networkidle2",
        timeout: 20000,
      });
    } catch {
      await page.waitForNavigation({
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });
    }
  } catch (error) {
    throw error;
  }
}

async function navigateToAuctions(page) {
  try {
    await page.waitForSelector("hzn-text-link", { timeout: 10000 });
    await page.evaluate(() => {
      const textLinks = document.querySelectorAll("hzn-text-link, a");
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
    });
  } catch (error) {
    /* Continue if link not found */
  }

  await sleep(3000);

  for (const selector of [
    '[data-testid="auction-carousel-card"]',
    ".auction-card-op7J1",
    '[data-testid="auction-card"]',
    ".auction-card",
    '[class*="auction-card"]',
    '[class*="auction"]',
    ".card",
    "article",
    'div[class*="grid"] > div',
  ]) {
    try {
      await page.waitForSelector(selector, { timeout: 3000 });
      const auctionCards = await page.$$(selector);
      if (auctionCards.length > 0) return selector;
    } catch (e) {
      /* Continue to next selector */
    }
  }
  throw new Error("No auction cards found on the page");
}

async function scrapeSingleAuction(page, auctionsSelector, index) {
  const vehicles = [];
  try {
    await page.waitForSelector(auctionsSelector, { timeout: 5000 });
    const auctionCards = await page.$$(auctionsSelector);
    if (!auctionCards[index]) return vehicles;

    const auctionInfo = await page.evaluate(
      (card, idx) => {
        const locationElement =
          card.querySelector(".auction-location, .location, h3, h4, .title") ||
          card.querySelector(
            "[data-testid*='location'], [data-testid*='title']"
          );
        return {
          location:
            locationElement?.textContent?.trim() || `Auction ${idx + 1}`,
          text: card.textContent?.substring(0, 100) || "",
        };
      },
      auctionCards[index],
      index
    );

    const currentUrl = page.url();

    // Click view cars button
    const clickResult = await page.evaluate((card) => {
      const buttons = card.querySelectorAll(
        'hzn-button, button, a, [role="button"]'
      );
      for (const btn of buttons) {
        const btnText = btn.textContent?.trim().toLowerCase();
        if (btnText.includes("view cars")) {
          if (
            btn.disabled ||
            btn.getAttribute("disabled") !== null ||
            btn.hasAttribute("disabled") ||
            btn.getAttribute("aria-disabled") === "true"
          )
            return "disabled";
          try {
            if (btn.tagName.toLowerCase() === "hzn-button") {
              const shadowButton = btn.shadowRoot?.querySelector("button");
              (shadowButton || btn).click();
            } else {
              btn.click();
            }
            return "clicked";
          } catch (err) {}
        }
      }
      return "not_found";
    }, auctionCards[index]);

    if (clickResult !== "clicked") return vehicles;

    await sleep(3000);
    const totalCarsInfo = await page.evaluate(() => {
      const match = document.body?.textContent?.match(
        /(\d+)\s*cars?\s*available/i
      );
      return match
        ? { totalCars: parseInt(match[1]), displayText: match[0] }
        : null;
    });

    if (totalCarsInfo)
      console.log(`📊 Found ${totalCarsInfo.totalCars} total cars available`);

    await loadAllVehicles(page);
    const vehicleData = await extractVehicleData(
      page,
      index,
      auctionInfo.location,
      100
    );
    vehicles.push(...vehicleData);

    if (currentUrl !== page.url()) {
      try {
        await page.goBack({ waitUntil: "networkidle2", timeout: 10000 });
        await sleep(2000);
        await page.waitForSelector(auctionsSelector, { timeout: 8000 });
      } catch (error) {
        await page.reload({ waitUntil: "networkidle2", timeout: 10000 });
        await page.waitForSelector(auctionsSelector, { timeout: 8000 });
      }
    }
  } catch (error) {
    // Continue on error
  }
  return vehicles;
}

async function loadAllVehicles(page) {
  await page.evaluate(async () => {
    const findScrollContainer = () => {
      for (const sel of [
        ".vehicle-list-container",
        ".search-results",
        ".vehicles-container",
        '[class*="scroll"]',
        '[role="main"]',
        "main",
        "body",
      ]) {
        const el = document.querySelector(sel);
        if (el && el.scrollHeight > el.clientHeight) return el;
      }
      return document.documentElement;
    };

    const countVehicles = () =>
      Math.max(
        ...[
          ".vehicle-list-item",
          '[class*="vehicle-list"]',
          '[class*="vehicle-row"]',
          "tbody tr",
          ".MuiTableBody-root tr",
          '[role="row"]',
        ].map((sel) => document.querySelectorAll(sel).length)
      );

    const scrollContainer = findScrollContainer();
    for (let attempts = 0; attempts < 15; attempts++) {
      const initialCount = countVehicles();
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
        scrollContainer === document.documentElement
          ? window.scrollTo(0, document.body.scrollHeight)
          : (scrollContainer.scrollTop = scrollContainer.scrollHeight);
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      if (countVehicles() <= initialCount) break;
    }
    window.scrollTo(0, 0);
  });
}

async function extractVehicleData(
  page,
  auctionIndex,
  auctionLocation,
  limit = 100
) {
  return await page.evaluate(
    (idx, location, maxVehicles, createVehicleObjectStr) => {
      eval(createVehicleObjectStr); // Inject the helper function

      const vehicles = [];
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
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > vehicleElements.length)
          vehicleElements = elements;
      }

      const toProcess = Math.min(vehicleElements.length, maxVehicles);
      for (let i = 0; i < toProcess; i++) {
        try {
          const element = vehicleElements[i];
          let vin = element
            .querySelector(
              '.vehicle-vin-Mc8Le, .vehicle-vin, [class*="vehicle-vin"]'
            )
            ?.textContent?.trim()
            .replace(/[^A-HJ-NPR-Z0-9]/gi, "");

          if (!vin) {
            const vinMatch = element.textContent?.match(
              /[A-HJ-NPR-Z0-9\s\-]{15,20}/
            );
            if (vinMatch) vin = vinMatch[0].replace(/[^A-HJ-NPR-Z0-9]/gi, "");
          }

          if (vin && vin.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) {
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

            vehicles.push(
              createVehicleObject(
                vin,
                runNumber,
                ymmt,
                mileage,
                location,
                idx + 1
              )
            );
          }
        } catch (err) {}
      }
      return vehicles;
    },
    auctionIndex,
    auctionLocation,
    limit,
    createVehicleObject.toString()
  );
}

<<<<<<< Updated upstream
function createVehicleObject(
  vin,
  runNumber,
  ymmt,
  mileage,
  auctionLocation,
  auctionIndex,
  additionalInfo = null,
  source = null
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
    auctionLocation,
    auctionIndex,
    scrapedAt: new Date().toISOString(),
    ...(source && { source }),
  };
}

async function extractMyListVehicles(page) {
  return await page.evaluate((createVehicleObjectStr) => {
    eval(createVehicleObjectStr); // Inject the helper function

    const vehicles = [];
    const seenVINs = new Set();
    const selectors = [
      ".vehicle-Tixca",
      ".vehicle-list-item",
      ".saved-vehicle-item",
      '[class*="vehicle"]',
      "tbody tr",
      ".MuiTableBody-root tr",
    ];
=======
async function extractTotalVehicleCount(page) {
    const totalCountText = await page.$eval('.search-bar-title-STpuhW span', el => el.innerText);
    const match = totalCountText.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
}
// Helper function to extract vehicle data specifically for My List
async function extractMyListVehicleData(page, limit = 1000) {
  const totalVehiclesExpected = await extractTotalVehicleCount(page);
   console.log(totalVehiclesExpected);
   let allVehicles = [];
    let lastCount = 0;
    let retries = 0;
    const seenVINs = new Set();
    let scrollTries = 0;
    while (seenVINs.size < totalVehiclesExpected && scrollTries < 50) {
  await page.evaluate(() => window.scrollBy(0, 300));
    await new Promise(resolve => setTimeout(resolve, 1500));
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
>>>>>>> Stashed changes

    let vehicleElements = [];
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > vehicleElements.length) vehicleElements = elements;
    }

<<<<<<< Updated upstream
=======
    console.log(
      `🔍 Found ${vehicleElements.length} vehicles in My List using "${bestSelector}"`
    );

>>>>>>> Stashed changes
    for (let i = 0; i < vehicleElements.length; i++) {
      try {
        const element = vehicleElements[i];

        // Extract VIN with multiple selectors
        let vin = null;
        const vinSelectors = [
          ".vehicle-vin-VvhMG span",
          ".vehicle-vin-Mc8Le",
          ".vehicle-vin",
          '[class*="vehicle-vin"]',
          '[class*="vin"]',
        ];
        for (const vinSelector of vinSelectors) {
          const vinElement = element.querySelector(vinSelector);
<<<<<<< Updated upstream
          if (vinElement?.textContent) {
=======
          if (vinElement && vinElement.textContent) {
>>>>>>> Stashed changes
            const vinText = vinElement.textContent
              .trim()
              .replace(/[^A-HJ-NPR-Z0-9]/gi, "");
            if (vinText && vinText.length === 17) {
              vin = vinText;
              break;
            }
          }
        }

        // Fallback VIN extraction
        if (!vin || vin.length !== 17) {
<<<<<<< Updated upstream
          const vinMatches =
            element.textContent?.match(/[A-HJ-NPR-Z0-9]{17}/gi);
          if (vinMatches?.length > 0) vin = vinMatches[0];
=======
          const textContent = element.textContent || "";
          const vinMatches = textContent.match(/[A-HJ-NPR-Z0-9]{17}/gi);
          if (vinMatches && vinMatches.length > 0) {
            console.log(`🔍 Fallback VIN extraction found: ${vinMatches[0]}`);
            // Use the
            vin = vinMatches[0];
          }
>>>>>>> Stashed changes
        }

        if (
          vin &&
          vin.length === 17 &&
          /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin) &&
          !seenVINs.has(vin)
        ) {
          seenVINs.add(vin);

<<<<<<< Updated upstream
          // Extract other data
          const ymmt = [
            ".vehicle-heading-irWa8 span",
=======
          // Extract vehicle heading (YMMT) - based on HTML: .vehicle-heading-irWa8 span
          let ymmt = null;
          const ymmtSelectors = [
            ".vehicle-heading-irWa8 span", // Specific selector from provided HTML
>>>>>>> Stashed changes
            ".vehicle-heading-irWa8",
            ".vehicle-ymmt-I4Jge",
            ".vehicle-ymmt",
            '[class*="vehicle-heading"]',
          ]
            .map((sel) => element.querySelector(sel)?.textContent?.trim())
            .find((text) => text && text.length > 5);

<<<<<<< Updated upstream
          const runNumber = [
            ".vehicle-run-number-TOWny",
=======
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
>>>>>>> Stashed changes
            ".vehicle-run-number-yx1uJ",
            ".vehicle-run-number",
            '[class*="run-number"]',
          ]
            .map((sel) => element.querySelector(sel)?.textContent?.trim())
            .find((text) => text);

<<<<<<< Updated upstream
=======
          for (const runSelector of runNumberSelectors) {
            const runElement = element.querySelector(runSelector);
            if (runElement && runElement.textContent) {
              runNumber = runElement.textContent.trim();
              if (runNumber) break;
            }
          }

          // Extract mileage from vehicle-info-n4bAH area
>>>>>>> Stashed changes
          let mileage = null;
          for (const sel of [
            ".vehicle-info-n4bAH span",
            ".vehicle-mileage-aQs6j",
            ".vehicle-mileage",
            '[class*="mileage"]',
<<<<<<< Updated upstream
          ]) {
            const elements = element.querySelectorAll(sel);
            for (const el of elements) {
              const text = el?.textContent?.trim();
              if (text && (text.includes("mi") || text.includes("mile"))) {
                mileage = text;
                break;
=======
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
>>>>>>> Stashed changes
              }
            }
            if (mileage) break;
          }

          const additionalInfo = element
            .querySelectorAll(".vehicle-info-n4bAH span")[1]
            ?.textContent?.trim();

          vehicles.push(
            createVehicleObject(
              vin,
              runNumber,
              ymmt,
              mileage,
              "My List",
              1,
              additionalInfo,
              "MyList"
            )
          );
<<<<<<< Updated upstream
=======
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
>>>>>>> Stashed changes
        }
      } catch (err) {}
    }
    return vehicles;
<<<<<<< Updated upstream
  }, createVehicleObject.toString());
=======
  // });
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

    console.log(`🔄 Total collected: ${allVehicles.length} / ${totalVehiclesExpected}`);

}
return allVehicles;
>>>>>>> Stashed changes
}

async function scrapeAuctions() {
  const { browser, page } = await setupBrowser();

  try {
    await loginWithRetry(page);
    const auctionsSelector = await navigateToAuctions(page);
    await sleep(3000);

    const auctionCards = await page.$$(auctionsSelector);
    console.log(`Found ${auctionCards.length} auction cards to scrape`);

    if (auctionCards.length === 0) {
      console.log("⚠️ No auction cards found.");
      return [];
    }

    const vehicles = [];
    const maxAuctionsToProcess = Math.min(auctionCards.length, 10);

    for (let i = 0; i < maxAuctionsToProcess; i++) {
      console.log(`🔍 Processing auction ${i + 1} of ${maxAuctionsToProcess}`);

      let currentAuctionsSelector = auctionsSelector;
      let auctionProcessed = false;

<<<<<<< Updated upstream
      for (let selectorRetry = 0; selectorRetry < 3; selectorRetry++) {
=======
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
            text.includes("mylist") ||
            text.includes("favorites") ||
            href.includes("mylist") ||
            href.includes("mylist") ||
            className.includes("mylist") ||
            className.includes("mylist")
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
        'a[href*="mylist"]',
        'a[href*="favorites"]',
        'a[href*="mylist"]',
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
            text.includes("mylist")
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
        `${baseUrl}/mylist`,
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
>>>>>>> Stashed changes
        try {
          await page.waitForSelector(currentAuctionsSelector, {
            timeout: 8000,
          });
          const currentCardCount = await page.$$eval(
            currentAuctionsSelector,
            (els) => els.length
          );

<<<<<<< Updated upstream
          if (currentCardCount > i) {
            const vinBatch = await scrapeSingleAuction(
              page,
              currentAuctionsSelector,
              i
=======
          // Check if we successfully loaded a My List page
          const isMyListPage = await page.evaluate(() => {
            const pageText = document.body.textContent.toLowerCase();
            const url = window.location.href.toLowerCase();
            const title = document.title.toLowerCase();

            return (
              url.includes("/mylist") ||
              url.includes("/mylist") ||
              url.includes("/favorites") ||
              pageText.includes("my list") ||
              pageText.includes("saved vehicles") ||
              pageText.includes("favorites") ||
              pageText.includes("wishlist") ||
              title.includes("my list") ||
              title.includes("my list") ||
              title.includes("favorites")
>>>>>>> Stashed changes
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
            `⚠️ Selector retry ${selectorRetry + 1}/3: ${error.message}`
          );

          if (selectorRetry < 2) {
            const possibleSelectors = [
              '[data-testid="auction-carousel-card"]',
              ".auction-card-op7J1",
              '[data-testid="auction-card"]',
              ".auction-card",
              '[class*="auction-card"]',
            ];

            for (const testSelector of possibleSelectors) {
              try {
                await page.waitForSelector(testSelector, { timeout: 3000 });
                const testCards = await page.$$(testSelector);
                if (testCards.length > i) {
                  currentAuctionsSelector = testSelector;
                  break;
                }
              } catch (testError) {
                // Continue to next selector
              }
            }
          }
        }
      }

      if (!auctionProcessed) {
        console.log(
          `❌ Failed to process auction ${i + 1}, skipping remaining auctions`
        );
        break;
      }
      await sleep(2000);
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

async function navigateToMyList(page) {
  await page.waitForSelector("body", { timeout: 10000 });
  await sleep(3000);

  const navigationResult = await page.evaluate(() => {
    // Try href patterns first
    for (const selector of [
      'a[href="/mylist"]',
      'a[href*="/mylist"]',
      'a[href*="mylist"]',
      'a[href*="saved"]',
    ]) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        try {
          elements[0].click();
          return { success: true, strategy: "href_pattern" };
        } catch (err) {
          /* continue */
        }
      }
    }

    // Try text content and navigation containers
    const allLinks = document.querySelectorAll(
      "a, nav a, [class*='nav'] a, [class*='header'] a, [class*='menu'] a"
    );
    const textPatterns = [
      /^my\s*list$/i,
      /^mylist$/i,
      /^saved$/i,
      /saved\s*vehicles/i,
    ];
    for (const link of allLinks) {
      const text = link.textContent?.trim() || "";
      for (const pattern of textPatterns) {
        if (
          pattern.test(text) ||
          text.toLowerCase().includes("my list") ||
          text.toLowerCase().includes("saved")
        ) {
          try {
            link.click();
            return { success: true, strategy: "text_pattern" };
          } catch (err) {
            /* continue */
          }
        }
      }
    }
    return { success: false };
  });

  if (navigationResult.success) {
    console.log(
      `✅ Successfully clicked My List using ${navigationResult.strategy}`
    );
    try {
      await page.waitForNavigation({
        waitUntil: "networkidle2",
        timeout: 15000,
      });
    } catch {
      console.log(
        "⚠️ Navigation wait failed, but click may have worked. Continuing..."
      );
    }
  } else {
    console.log('❌ "My List" link not found, trying direct URLs...');
    const currentUrl = page.url();
    const baseUrl = new URL(currentUrl).origin;
    const possibleUrls = [
      `${baseUrl}/mylist`,
      `${baseUrl}/saved`,
      `${baseUrl}/favorites`,
    ];

    let directNavSuccess = false;
    for (const testUrl of possibleUrls) {
      try {
        await page.goto(testUrl, { waitUntil: "networkidle2", timeout: 15000 });
        const isMyListPage = await page.evaluate(() => {
          const pageText = document.body?.textContent?.toLowerCase() || "";
          const url = window.location.href.toLowerCase();
          return (
            url.includes("/mylist") ||
            url.includes("/saved") ||
            pageText.includes("my list") ||
            pageText.includes("saved vehicles")
          );
        });

        if (isMyListPage) {
          console.log(`✅ Successfully navigated to My List: ${testUrl}`);
          directNavSuccess = true;
          break;
        }
      } catch (error) {
        // Continue to next URL
      }
    }

    if (!directNavSuccess) {
      throw new Error("Could not navigate to My List using any method");
    }
  }
  await sleep(3000);
}
async function scrapeMyList(jobId = null) {
  const { browser, page } = await setupBrowser();
  const checkCancellation = () => {
    if (jobId && global.jobCancellation && global.jobCancellation[jobId]) {
      throw new Error("Job was cancelled by user request");
    }
  };

  let vehicles = [];

  try {
<<<<<<< Updated upstream
    checkCancellation();
    await loginWithRetry(page);
    checkCancellation();
=======
    checkCancellation(); // Check before starting

    await login(page);
    console.log("✅ Login completed");
    console.log("✅ Login completed2");

    checkCancellation(); // Check after login

>>>>>>> Stashed changes
    await navigateToMyList(page);
    await sleep(3000);

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
        summary: { total: 0, successful: 0, failed: 0 },
      };
    }

    await loadAllVehicles(page);
    const vehicleData = await extractMyListVehicles(page);
    vehicles.push(...vehicleData);
    console.log(`✅ Extracted ${vehicleData.length} vehicles from My List`);

    if (vehicles.length > 0) {
      const filename = generateDateFilename("mylist_vehicles");
      saveJSON(filename, vehicles);
      console.log(`📁 My List data saved to: ${filename}`);

      // Attempt vAuto annotation
      const userForAnnotation = {
        email: "mylist@carmax.com",
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

      try {
        console.log(
          `🔍 Annotating ${userForAnnotation.vins.length} VINs with vAuto...`
        );
        const annotationResults = await annotateUser(userForAnnotation);
        const annotatedVehicles = vehicles.map((vehicle) => {
          const annotation = annotationResults.find(
            (result) => result.vin === vehicle.vin && result.success
          );
          return annotation && annotation.evaluation
            ? {
                ...vehicle,
                vautoData: annotation.evaluation,
                vautoAnnotated: true,
                vautoTimestamp: new Date().toISOString(),
              }
            : {
                ...vehicle,
                vautoAnnotated: false,
                vautoError:
                  annotationResults.find((r) => r.vin === vehicle.vin)?.error ||
                  "No annotation available",
              };
        });

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
        summary: { total: 0, successful: 0, failed: 0, annotated: 0 },
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
          summary: { total: 0, successful: 0, failed: 0, annotated: 0 },
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
