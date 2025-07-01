#!/usr/bin/env node

/**
 * Comprehensive test script for vAuto Vehicle Enrichment Bot
 * Tests all major functionality without requiring credentials
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

function test(name, testFunction) {
  try {
    console.log(`🧪 Testing: ${name}...`);
    const result = testFunction();
    if (result === true || result === undefined) {
      console.log(`✅ PASS: ${name}`);
      results.passed++;
      results.tests.push({ name, status: "PASS" });
    } else {
      console.log(`❌ FAIL: ${name} - ${result}`);
      results.failed++;
      results.tests.push({ name, status: "FAIL", error: result });
    }
  } catch (error) {
    console.log(`❌ FAIL: ${name} - ${error.message}`);
    results.failed++;
    results.tests.push({ name, status: "FAIL", error: error.message });
  }
  console.log("");
}

console.log("🚀 Starting vAuto Bot Test Suite\n");

// Test 1: Directory Structure
test("Directory Structure", () => {
  const requiredDirs = ["src", "data", "user_data", "public"];
  const requiredFiles = ["package.json", "cli.js", "start.js", "nixpacks.toml"];

  for (const dir of requiredDirs) {
    if (!fs.existsSync(dir)) {
      return `Missing directory: ${dir}`;
    }
  }

  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      return `Missing file: ${file}`;
    }
  }

  return true;
});

// Test 2: Package.json Scripts
test("Package.json Scripts", () => {
  const pkg = require("./package.json");
  const requiredScripts = [
    "start",
    "scrape",
    "carmax",
    "vauto",
    "status",
    "export",
    "web",
  ];

  for (const script of requiredScripts) {
    if (!pkg.scripts[script]) {
      return `Missing script: ${script}`;
    }
  }

  return true;
});

// Test 3: Dependencies
test("Dependencies Installation", () => {
  const pkg = require("./package.json");
  const requiredDeps = [
    "puppeteer",
    "express",
    "socket.io",
    "commander",
    "dotenv",
  ];

  for (const dep of requiredDeps) {
    if (!pkg.dependencies[dep]) {
      return `Missing dependency: ${dep}`;
    }

    try {
      require(dep);
    } catch (error) {
      return `Cannot load dependency: ${dep}`;
    }
  }

  return true;
});

// Test 4: Configuration Loading
test("Configuration Module", () => {
  const config = require("./src/config.js");
  const requiredKeys = ["carmaxUrl", "vautoUrl", "headless", "show2FA"];

  for (const key of requiredKeys) {
    if (config[key] === undefined) {
      return `Missing config key: ${key}`;
    }
  }

  if (!config.carmaxUrl.includes("carmax")) {
    return "Invalid CarMax URL";
  }

  if (!config.vautoUrl.includes("vauto")) {
    return "Invalid vAuto URL";
  }

  return true;
});

// Test 5: Utils Module
test("Utils Module", () => {
  const utils = require("./src/utils.js");
  const requiredFunctions = [
    "loadJSON",
    "saveJSON",
    "getPuppeteerConfig",
    "launchPuppeteer",
  ];

  for (const func of requiredFunctions) {
    if (typeof utils[func] !== "function") {
      return `Missing or invalid function: ${func}`;
    }
  }

  // Test Puppeteer config generation
  const config = utils.getPuppeteerConfig({ headless: true });
  if (!config.args || !Array.isArray(config.args)) {
    return "Invalid Puppeteer config generation";
  }

  if (!config.userDataDir) {
    return "Missing userDataDir in Puppeteer config";
  }

  return true;
});

// Test 6: Web Server Module
test("Web Server Module", () => {
  const WebServer = require("./src/webServer.js");

  if (typeof WebServer !== "function") {
    return "WebServer is not a constructor function";
  }

  // Test instantiation
  const server = new WebServer();

  if (!server.app || !server.server || !server.io) {
    return "WebServer missing required properties";
  }

  return true;
});

// Test 7: CLI Module
test("CLI Module Structure", () => {
  const cliContent = fs.readFileSync("./cli.js", "utf8");

  const requiredCommands = [
    "carmax",
    "vauto",
    "complete",
    "web",
    "status",
    "export",
  ];

  for (const cmd of requiredCommands) {
    if (
      !cliContent.includes(`command("${cmd}")`) &&
      !cliContent.includes(`command('${cmd}')`)
    ) {
      return `Missing CLI command: ${cmd}`;
    }
  }

  return true;
});

// Test 8: Environment Variables (if available)
test("Environment Variables", () => {
  const requiredVars = ["VAUTO_USERNAME", "VAUTO_PASSWORD"];
  const missingVars = [];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  }

  if (missingVars.length > 0) {
    return `Missing environment variables: ${missingVars.join(
      ", "
    )} (This is expected if not configured)`;
  }

  return true;
});

// Test 9: Data Loading
test("Data Loading", () => {
  const { loadJSON } = require("./src/utils.js");

  try {
    const vehicles = loadJSON("./data/vehicles.json");

    if (!Array.isArray(vehicles)) {
      return "vehicles.json should contain an array";
    }

    if (vehicles.length > 0) {
      const sample = vehicles[0];
      if (!sample.vin && !sample.title) {
        return "Vehicle data missing basic properties";
      }
    }

    return true;
  } catch (error) {
    // If file doesn't exist, that's okay
    if (error.code === "ENOENT") {
      return true;
    }
    return `Error loading vehicles: ${error.message}`;
  }
});

// Test 10: Production Configuration
test("Production Configuration", () => {
  // Temporarily set production mode
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  try {
    // Reload config to test production mode
    delete require.cache[require.resolve("./src/config.js")];
    const config = require("./src/config.js");

    if (config.headless !== true) {
      return "Headless mode should be enabled in production";
    }

    if (config.show2FA !== false) {
      return "2FA UI should be disabled in production";
    }

    return true;
  } finally {
    // Restore original environment
    process.env.NODE_ENV = originalEnv;
    delete require.cache[require.resolve("./src/config.js")];
  }
});

// Test 11: Nixpacks Configuration
test("Nixpacks Configuration", () => {
  const nixpacksContent = fs.readFileSync("./nixpacks.toml", "utf8");

  const requiredSections = [
    "providers",
    "phases.setup",
    "phases.install",
    "start",
    "variables",
  ];

  for (const section of requiredSections) {
    if (!nixpacksContent.includes(`[${section}]`)) {
      return `Missing nixpacks section: ${section}`;
    }
  }

  if (!nixpacksContent.includes("chromium")) {
    return "Chromium not specified in nixpacks config";
  }

  if (!nixpacksContent.includes("PUPPETEER_SKIP_CHROMIUM_DOWNLOAD")) {
    return "Missing Puppeteer configuration in nixpacks";
  }

  return true;
});

// Test 12: File Permissions
test("File Permissions", () => {
  const executableFiles = ["cli.js", "start.js"];

  for (const file of executableFiles) {
    const content = fs.readFileSync(file, "utf8");
    if (!content.startsWith("#!/usr/bin/env node")) {
      return `${file} missing shebang line`;
    }
  }

  return true;
});

// Summary
console.log("🏁 Test Suite Complete!\n");
console.log("📊 Results:");
console.log(`  ✅ Passed: ${results.passed}`);
console.log(`  ❌ Failed: ${results.failed}`);
console.log(`  🎯 Total: ${results.passed + results.failed}`);

if (results.failed > 0) {
  console.log("\n❌ Failed Tests:");
  results.tests
    .filter((t) => t.status === "FAIL")
    .forEach((test) => {
      console.log(`  - ${test.name}: ${test.error}`);
    });
}

console.log("\n📋 Detailed Results:");
results.tests.forEach((test) => {
  const status = test.status === "PASS" ? "✅" : "❌";
  console.log(`  ${status} ${test.name}`);
});

const successRate = Math.round(
  (results.passed / (results.passed + results.failed)) * 100
);
console.log(`\n🎉 Success Rate: ${successRate}%`);

if (successRate >= 90) {
  console.log("🚀 Excellent! The bot is ready for deployment.");
} else if (successRate >= 75) {
  console.log("⚠️ Good, but some issues need attention before deployment.");
} else {
  console.log(
    "🚨 Multiple issues detected. Review failed tests before deployment."
  );
}

process.exit(results.failed > 0 ? 1 : 0);
