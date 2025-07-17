#!/usr/bin/env node

/**
 * Main entry point for CarMax-vAuto Vehicle Enrichment Bot
 * Production-ready automation tool
 */

require("dotenv").config();

// Validate required environment variables
const requiredEnvs = [
  "CARMAX_EMAIL",
  "CARMAX_PASSWORD",
  "VAUTO_USERNAME",
  "VAUTO_PASSWORD",
];
const missingEnvs = requiredEnvs.filter((env) => !process.env[env]);

if (missingEnvs.length > 0) {
  console.error(
    "❌ Missing required environment variables:",
    missingEnvs.join(", ")
  );
  console.error("Please check your .env file");
  process.exit(1);
}

// Check if we're being called directly or imported
if (require.main === module) {
  console.log("🚀 Starting CarMax-vAuto Vehicle Enrichment Bot...");
  console.log("🌐 Starting web interface...");
  console.log("");

  const WebServer = require("./webServer");
  const server = new WebServer();

  const port = process.env.PORT || 3000;
  server.start(port);
  console.log(`📱 Web interface available at: http://localhost:${port}`);
  console.log("");
  console.log("Available CLI commands:");
  console.log(
    "  npm run scrape           # Complete workflow (My List + vAuto)"
  );
  console.log("  npm run mylist           # Scrape My List only");
  console.log("  npm run vauto            # vAuto enrichment only");
  console.log("  npm run status           # Show current status");
}
