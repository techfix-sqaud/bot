const {
  vehicleSelectors,
  vinSelectors,
  ymmtSelectors,
  runNumberSelectors,
  mileageSelectors,
  additionalInfoSelectors,
  scrollContainerSelectors,
  vehicleCountSelectors,
} = require("../utils/selectors");

// Helper: scroll/load all vehicles in My List
async function loadAllVehicles(page) {
  await page.evaluate(
    async (scrollContainerSelectors, vehicleCountSelectors) => {
      const findScrollContainer = () => {
        for (const sel of scrollContainerSelectors) {
          const el = document.querySelector(sel);
          if (el && el.scrollHeight > el.clientHeight) return el;
        }
        return document.documentElement;
      };
      const countVehicles = () =>
        Math.max(
          ...vehicleCountSelectors.map(
            (sel) => document.querySelectorAll(sel).length
          )
        );
      const scrollContainer = findScrollContainer();
      for (let attempts = 0; attempts < 15; attempts++) {
        const initialCount = countVehicles();
        const loadMoreBtn = Array.from(
          document.querySelectorAll("button")
        ).find((btn) =>
          btn.textContent?.trim().toUpperCase().includes("SEE MORE")
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
    },
    scrollContainerSelectors,
    vehicleCountSelectors
  );
}

// Helper function to extract the total vehicle count from the page
async function extractTotalVehicleCount(page) {
  const totalCountText = await page.$eval(
    ".search-bar-title-STpuhW span",
    (el) => el.innerText
  );
  const match = totalCountText.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

// Helper function to extract vehicle data specifically for My List
async function extractMyListVehicleData(page, limit = 1000) {
  const totalVehiclesExpected = await extractTotalVehicleCount(page);
  console.log(totalVehiclesExpected);

  const seenVINs = new Set();
  let allVehicles = [];
  let scrollTries = 0;

  while (seenVINs.size < totalVehiclesExpected && scrollTries < 50) {
    await page.evaluate(() => window.scrollBy(0, 300));
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const newData = await page.evaluate(
      (
        vehicleSelectors,
        vinSelectors,
        ymmtSelectors,
        runNumberSelectors,
        mileageSelectors,
        additionalInfoSelectors
      ) => {
        const vehicles = [];
        const seenVINs = new Set();

        let vehicleElements = [];
        for (const selector of vehicleSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > vehicleElements.length) {
            vehicleElements = elements;
          }
        }

        for (let i = 0; i < vehicleElements.length; i++) {
          try {
            const element = vehicleElements[i];

            let vin = null;
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

            if (!vin || vin.length !== 17) {
              const textContent = element.textContent || "";
              const vinMatches = textContent.match(/[A-HJ-NPR-Z0-9]{17}/gi);
              if (vinMatches && vinMatches.length > 0) {
                vin = vinMatches[0];
              }
            }

            if (
              vin &&
              vin.length === 17 &&
              /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)
            ) {
              if (seenVINs.has(vin)) {
                continue;
              }

              seenVINs.add(vin);

              let ymmt = null;
              for (const ymmtSelector of ymmtSelectors) {
                const ymmtElement = element.querySelector(ymmtSelector);
                if (ymmtElement && ymmtElement.textContent) {
                  ymmt = ymmtElement.textContent.trim();
                  if (ymmt && ymmt.length > 5) break;
                }
              }

              let runNumber = null;
              for (const runSelector of runNumberSelectors) {
                const runElement = element.querySelector(runSelector);
                if (runElement && runElement.textContent) {
                  runNumber = runElement.textContent.trim();
                  if (runNumber) break;
                }
              }

              let mileage = null;
              for (const mileageSelector of mileageSelectors) {
                const mileageElements =
                  element.querySelectorAll(mileageSelector);
                for (const mileageElement of mileageElements) {
                  if (mileageElement && mileageElement.textContent) {
                    const text = mileageElement.textContent.trim();
                    if (
                      text &&
                      (text.includes("mi") || text.includes("mile"))
                    ) {
                      mileage = text;
                      break;
                    }
                  }
                }
                if (mileage) break;
              }

              let additionalInfo = null;
              for (const infoSelector of additionalInfoSelectors) {
                const additionalInfoElements =
                  element.querySelectorAll(infoSelector);
                if (
                  additionalInfoElements.length > 1 &&
                  additionalInfoElements[1] &&
                  additionalInfoElements[1].textContent
                ) {
                  additionalInfo = additionalInfoElements[1].textContent.trim();
                  break;
                }
              }

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
                additionalInfo: additionalInfo || "Unknown",
                auctionLocation: "My List",
                auctionIndex: 1,
                scrapedAt: new Date().toISOString(),
                source: "MyList",
              });
            }
          } catch (err) {
            console.log(`⚠️ Error processing vehicle:`, err.message);
          }
        }

        return vehicles;
      },
      vehicleSelectors,
      vinSelectors,
      ymmtSelectors,
      runNumberSelectors,
      mileageSelectors,
      additionalInfoSelectors
    );

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
  }

  return allVehicles;
}

module.exports = {
  loadAllVehicles,
  extractTotalVehicleCount,
  extractMyListVehicleData,
};
