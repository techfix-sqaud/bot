require("dotenv").config();

const mode = process.env.MODE || "scrape";

if (mode === "web") {
  // Start web interface
  const app = require("./webInterface");
  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    console.log(`🌐 Web interface running on port ${PORT}`);
    console.log(
      `📊 Visit http://localhost:${PORT} to manage your vehicles.json`
    );
  });
} else {
  // Run scraper once
  const enrichVehiclesWithVAuto = require("./carmaxVautoScraper");

  (async () => {
    console.log("🚀 Starting vAuto enrichment for existing vehicles...");
    await enrichVehiclesWithVAuto();
    console.log("✅ Job completed!");
    process.exit(0);
  })();
}
