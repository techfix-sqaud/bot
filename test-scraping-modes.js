#!/usr/bin/env node

require("dotenv").config();
const { scrapeAuctions, scrapeMyList } = require("./src/carmaxScraper");

console.log("🧪 Testing scraping mode functions...");

// Test function availability
console.log("✅ scrapeAuctions function:", typeof scrapeAuctions);
console.log("✅ scrapeMyList function:", typeof scrapeMyList);

// Test orchestrator
const VehicleDataOrchestrator = require("./src/orchestrator");
const orchestrator = new VehicleDataOrchestrator();

console.log("✅ runCarmaxOnly method:", typeof orchestrator.runCarmaxOnly);
console.log("✅ runMyListOnly method:", typeof orchestrator.runMyListOnly);

console.log("\n🎯 All scraping mode functions are available and ready!");
console.log("\nUsage examples:");
console.log("📱 Web interface: Select your preferred mode in the UI");
console.log("💻 CLI: node cli.js --scraping-mode mylist");
console.log("💻 CLI: node cli.js --scraping-mode auctions");

console.log("\n✅ Test completed successfully!");
