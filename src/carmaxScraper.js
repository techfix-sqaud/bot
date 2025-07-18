// Minimal, production-ready CarMax My List scraper

const config = require("./config");
require("dotenv").config();
const { setupBrowser } = require("./utils/setUpBrowser");
const { saveJSON, generateDateFilename } = require("./utils");
const { annotateUser } = require("./vautoAnnotator");

const {
  loadAllVehicles,
  extractTotalVehicleCount,
  extractMyListVehicleData,
} = require("./helpers/scraperVehicleHelpers");

const { login } = require("./helpers/scraperLoginHelper");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function navigateToMyList(page) {
  await page.waitForSelector("body", { timeout: 10000 });
  await sleep(3000);
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
        return url.includes("/mylist") || pageText.includes("my list");
      });
      if (isMyListPage) {
        console.log(`✔️ Successfully navigated to My List: ${testUrl}`);
        directNavSuccess = true;
        break;
      }
    } catch (error) {
      console.warn(`⚠️ Navigation failed for ${testUrl}: ${error.message}`);
    }
  }

  if (!directNavSuccess) {
    throw new Error("Could not navigate to My List using any method");
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
    checkCancellation();
    await login(page);
    checkCancellation();
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
    const vehicleData = await extractMyListVehicleData(page);
    vehicles.push(...vehicleData);

    console.log(`✅ Extracted ${vehicleData.length} vehicles from My List`);

    if (vehicles.length > 0) {
      const filename = generateDateFilename("mylist_vehicles");
      saveJSON(filename, vehicles);
      console.log(`📁 My List data saved to: ${filename}`);

      // Annotate with vAuto
      const userForAnnotation = {
        email: process.env.VAUTO_ANNOTATION_EMAIL || "mylist@carmax.com",
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

        if (!Array.isArray(annotationResults)) {
          throw new Error("Invalid response from vAuto annotator");
        }

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

        const annotatedFilename = filename.replace(
          /\.json$/,
          "_annotated.json"
        );
        saveJSON(annotatedFilename, annotatedVehicles);

        const successfulAnnotations = annotationResults.filter(
          (r) => r.success
        ).length;

        console.log(
          `✅ vAuto annotation completed. ${successfulAnnotations}/${annotationResults.length} vehicles annotated`
        );

        return {
          vehicles: annotatedVehicles,
          filename: annotatedFilename,
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
  scrapeMyList,
};
