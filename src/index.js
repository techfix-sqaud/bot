require("dotenv").config();
const enrichVehiclesWithVAuto = require("./carmaxVautoScraper");

(async () => {
  console.log("🚀 Starting vAuto enrichment for existing vehicles...");
  await enrichVehiclesWithVAuto();
  console.log("✅ Job completed!");
})();
