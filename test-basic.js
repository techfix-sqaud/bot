require("dotenv").config();
const { loadJSON } = require("./src/utils");

// Simple test to verify basic setup
async function basicTest() {
  console.log("🧪 Running Basic Setup Test...\n");

  // 1. Check environment variables
  console.log("1️⃣ Checking environment variables...");
  const vautoUser = process.env.VAUTO_USERNAME;
  const vautoPassword = process.env.VAUTO_PASSWORD;

  if (!vautoUser || !vautoPassword) {
    console.error("❌ Missing environment variables:");
    console.error(`   VAUTO_USER: ${vautoUser ? "✅ Set" : "❌ Missing"}`);
    console.error(
      `   VAUTO_PASSWORD: ${vautoPassword ? "✅ Set" : "❌ Missing"}`
    );
    return;
  }
  console.log("✅ Environment variables are set");

  // 2. Check vehicles.json file
  console.log("\n2️⃣ Checking vehicles.json file...");
  try {
    const vehicles = loadJSON("./data/vehicles.json");
    console.log(`✅ Loaded ${vehicles.length} vehicles from data file`);

    if (vehicles.length > 0) {
      console.log("📋 Sample vehicle data:");
      console.log(`   VIN: ${vehicles[0].vin}`);
      console.log(
        `   Year/Make/Model: ${vehicles[0].year} ${vehicles[0].make} ${vehicles[0].model}`
      );
      console.log(`   Mileage: ${vehicles[0].mileage}`);
    }
  } catch (error) {
    console.error("❌ Failed to load vehicles.json:", error.message);
    return;
  }

  // 3. Check if puppeteer can be imported
  console.log("\n3️⃣ Checking Puppeteer...");
  try {
    const puppeteer = require("puppeteer");
    console.log("✅ Puppeteer is available");
  } catch (error) {
    console.error("❌ Puppeteer not found:", error.message);
    console.error("   Run: npm install puppeteer");
    return;
  }

  // 4. Test module import
  console.log("\n4️⃣ Testing module import...");
  try {
    const annotateUser = require("./src/vautoAnnotator");
    console.log("✅ vautoAnnotator module imported successfully");
  } catch (error) {
    console.error("❌ Failed to import vautoAnnotator:", error.message);
    return;
  }

  console.log("\n🎉 All basic tests passed! Ready to run full test.");
  console.log("\n🚀 To run the full test, use:");
  console.log("   node test-vauto.js");
}

basicTest();
