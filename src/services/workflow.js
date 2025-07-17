/**
 * Complete Workflow Service
 * Orchestrates the complete CarMax My List + vAuto enrichment workflow
 */

const { scrapeMyList } = require("../scrapers/carmax-mylist-scraper");
const { enrichVehiclesWithVAuto } = require("./vauto-enrichment");

/**
 * Execute the complete workflow: CarMax My List scraping + vAuto enrichment
 * @param {string} jobId - Optional job ID for cancellation tracking
 * @returns {Object} Complete workflow results
 */
async function runCompleteWorkflow(jobId = null) {
  console.log(
    "🚀 Starting complete workflow: CarMax My List + vAuto enrichment"
  );

  const checkCancellation = () => {
    if (jobId && global.jobCancellation && global.jobCancellation[jobId]) {
      throw new Error("Job was cancelled by user request");
    }
  };

  try {
    checkCancellation();

    // Step 1: Scrape CarMax My List
    console.log("\n🏪 Step 1: CarMax My List Scraping");
    const scrapeResults = await scrapeMyList(jobId);

    if (scrapeResults.cancelled) {
      console.log("🛑 Workflow cancelled during CarMax scraping");
      return {
        ...scrapeResults,
        step: "carmax_scraping",
        message: "Workflow cancelled during CarMax My List scraping",
      };
    }

    if (scrapeResults.vehicles.length === 0) {
      console.log("⚠️ No vehicles found in My List, skipping vAuto enrichment");
      return {
        ...scrapeResults,
        step: "carmax_scraping",
        message: "No vehicles found in My List",
      };
    }

    console.log(
      `✅ CarMax scraping completed: ${scrapeResults.vehicles.length} vehicles found`
    );
    checkCancellation();

    // Step 2: vAuto enrichment
    console.log("\n💎 Step 2: vAuto Enrichment");
    const enrichmentResults = await enrichVehiclesWithVAuto(jobId);

    if (enrichmentResults.cancelled) {
      console.log("🛑 Workflow cancelled during vAuto enrichment");
      return {
        vehicles: enrichmentResults.vehicles,
        filename: scrapeResults.filename,
        cancelled: true,
        step: "vauto_enrichment",
        scrapeResults,
        enrichmentResults,
        summary: {
          scraped: scrapeResults.summary,
          enriched: enrichmentResults.summary,
        },
        message: "Workflow cancelled during vAuto enrichment",
      };
    }

    console.log("\n✅ Complete workflow finished successfully!");

    // Final summary
    const totalVehicles = enrichmentResults.vehicles.length;
    const enrichedCount = enrichmentResults.vehicles.filter(
      (v) => v.vautoData
    ).length;

    console.log(`\n📊 Final Summary:`);
    console.log(`   Total vehicles: ${totalVehicles}`);
    console.log(`   Enriched with vAuto: ${enrichedCount}`);
    console.log(`   Pending enrichment: ${totalVehicles - enrichedCount}`);

    return {
      vehicles: enrichmentResults.vehicles,
      filename: scrapeResults.filename,
      scrapeResults,
      enrichmentResults,
      summary: {
        scraped: scrapeResults.summary,
        enriched: enrichmentResults.summary,
        total: totalVehicles,
        enriched: enrichedCount,
        pending: totalVehicles - enrichedCount,
      },
      message: "Complete workflow finished successfully",
    };
  } catch (error) {
    if (error.message && error.message.includes("cancelled")) {
      console.log("🛑 Complete workflow was cancelled");
      return {
        vehicles: [],
        cancelled: true,
        step: "workflow",
        message: "Complete workflow was cancelled by user",
      };
    }

    console.error("❌ Complete workflow failed:", error.message);
    throw error;
  }
}

module.exports = {
  runCompleteWorkflow,
};
