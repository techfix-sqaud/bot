#!/usr/bin/env node

/**
 * Production startup script for vAuto Vehicle Enrichment Bot
 * Handles environment detection and graceful startup
 */

require("dotenv").config();

// Environment detection
const isProduction = process.env.NODE_ENV === "production";
const isServerEnvironment =
  !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY;

console.log("🚀 vAuto Vehicle Enrichment Bot Starting...");
console.log(`📊 Environment: ${isProduction ? "Production" : "Development"}`);
console.log(`🖥️  Server Mode: ${isServerEnvironment ? "Headless" : "Desktop"}`);

// Validate required environment variables
const requiredEnvVars = ["VAUTO_USERNAME", "VAUTO_PASSWORD"];
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.error("❌ Missing required environment variables:");
  missingVars.forEach((varName) => console.error(`   - ${varName}`));
  console.error(
    "\n📝 Please set these variables in your .env file or deployment configuration"
  );
  process.exit(1);
}

// Set NODE_ENV to production if we detect a server environment
if (isServerEnvironment && !isProduction) {
  console.log("🔧 Server environment detected, setting NODE_ENV=production");
  process.env.NODE_ENV = "production";
}

// Validate Chromium availability in production
if (isProduction || isServerEnvironment) {
  const { execSync } = require("child_process");

  try {
    // Check if Chromium is available
    const chromiumPath =
      process.env.PUPPETEER_EXECUTABLE_PATH || "/nix/store/*/bin/chromium";
    console.log(`🔍 Checking Chromium availability: ${chromiumPath}`);

    // Try to find chromium binary
    execSync("which chromium || which google-chrome || which chrome", {
      stdio: "pipe",
    });
    console.log("✅ Chromium/Chrome found");
  } catch (error) {
    console.warn(
      "⚠️  Warning: Chromium not found in PATH, relying on PUPPETEER_EXECUTABLE_PATH"
    );
  }
}

// Check data directory
const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "data");
const userDataDir = path.join(__dirname, "user_data");

// Ensure directories exist
[dataDir, userDataDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    console.log(`📁 Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Check for existing vehicle data
const vehiclesFile = path.join(dataDir, "vehicles.json");
if (fs.existsSync(vehiclesFile)) {
  try {
    const vehicles = JSON.parse(fs.readFileSync(vehiclesFile, "utf8"));
    console.log(`📋 Found ${vehicles.length} existing vehicles in database`);
  } catch (error) {
    console.warn("⚠️  Warning: vehicles.json exists but is not valid JSON");
  }
} else {
  console.log(
    "📋 No existing vehicle data found, will create new vehicles.json"
  );
}

// Start the web server
console.log("� Starting web interface...\n");

const WebServer = require("./src/webServer");
const server = new WebServer();
server.start(3000);
