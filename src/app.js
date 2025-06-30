require("dotenv").config();

const mode = process.env.MODE || "web";

console.log(`🚀 Starting bot in ${mode} mode...`);
console.log(`📦 Node version: ${process.version}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);

if (mode === "web") {
  // Start web interface
  const app = require("./webInterface");
  const PORT = process.env.PORT || 3000;

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 Web interface running on port ${PORT}`);
    console.log(`📊 Access the application at http://localhost:${PORT}`);
    console.log(`🔗 External access: http://0.0.0.0:${PORT}`);
  });
} else if (mode === "scrape" || mode === "cli") {
  // Run scraper once or start CLI mode
  const enrichVehiclesWithVAuto = require("./carmaxVautoScraper");

  (async () => {
    console.log("🚀 Starting vAuto enrichment for existing vehicles...");
    try {
      await enrichVehiclesWithVAuto(Date.now().toString());
      console.log("✅ Job completed successfully!");
    } catch (error) {
      console.error("❌ Job failed:", error.message);
      process.exit(1);
    }
    process.exit(0);
  })();
} else {
  console.error(`❌ Invalid MODE: "${mode}". Use "web", "scrape", or "cli"`);
  console.error("💡 Set MODE environment variable to one of: web, scrape, cli");
  process.exit(1);
}
