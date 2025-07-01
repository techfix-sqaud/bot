#!/usr/bin/env node

/**
 * Main entry point for vAuto Vehicle Enrichment Bot
 * Starts the web interface by default
 */

require("dotenv").config();

// Check if we're being called directly or imported
if (require.main === module) {
  console.log("🚀 Starting vAuto Vehicle Enrichment Bot...");
  console.log("🌐 Starting web interface on port 3000...");
  console.log("💡 Use CLI commands for automation: node cli.js --help");
  console.log("");

  const WebServer = require("./webServer");
  const server = new WebServer();

  server.start(3000);
  console.log("📱 Open your browser to: http://localhost:3000");
  console.log("");
  console.log("Available CLI commands:");
  console.log("  npm run scrape           # Complete workflow");
  console.log("  npm run carmax           # CarMax scraping only");
  console.log("  npm run vauto            # vAuto enrichment only");
  console.log("  npm run status           # Show current status");
  console.log("  npm run export           # Export vehicle data");
}
