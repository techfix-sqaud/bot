#!/usr/bin/env node

console.log("🔍 CHECKING FOR HARDCODED BROWSER PATHS");
console.log("=====================================");

// Check nixpacks.toml
const fs = require("fs");

try {
  const nixpacksContent = fs.readFileSync("nixpacks.toml", "utf8");
  if (nixpacksContent.includes("PUPPETEER_EXECUTABLE_PATH")) {
    console.log("❌ nixpacks.toml still contains PUPPETEER_EXECUTABLE_PATH");
    console.log("   This will override your config.js detection!");
  } else {
    console.log("✅ nixpacks.toml looks good - no hardcoded browser path");
  }
} catch (error) {
  console.log("ℹ️  nixpacks.toml not found - that's fine");
}

// Check all Dockerfiles
const dockerfiles = ["Dockerfile", "Dockerfile.debug", "Dockerfile.optimized"];
dockerfiles.forEach((dockerfile) => {
  try {
    const content = fs.readFileSync(dockerfile, "utf8");
    if (content.includes("PUPPETEER_EXECUTABLE_PATH")) {
      console.log(`❌ ${dockerfile} still contains PUPPETEER_EXECUTABLE_PATH`);
    } else {
      console.log(`✅ ${dockerfile} looks good - no hardcoded browser path`);
    }
  } catch (error) {
    console.log(`ℹ️  ${dockerfile} not found`);
  }
});

// Test current environment
console.log("\n🔍 Current Environment:");
console.log(
  "PUPPETEER_EXECUTABLE_PATH:",
  process.env.PUPPETEER_EXECUTABLE_PATH || "undefined ✅"
);
console.log("NODE_ENV:", process.env.NODE_ENV || "undefined");

// Test config detection
console.log("\n🔍 Testing Browser Detection:");
try {
  const config = require("./src/config");
  const detectedPath = config.findChromiumExecutable();
  console.log(
    "Detected browser:",
    detectedPath || "undefined (Puppeteer will download)"
  );

  console.log("\n⚙️  Generated Puppeteer Options:");
  const options = config.getPuppeteerOptions();
  console.log(
    "executablePath:",
    options.executablePath || "undefined (using Puppeteer's browser)"
  );
} catch (error) {
  console.log("❌ Error testing config:", error.message);
}

console.log("\n🚀 NEXT STEPS:");
console.log("1. Commit and push these changes");
console.log("2. Redeploy in Coolify");
console.log("3. Your app should now work without browser path errors");
