require("dotenv").config();
const annotateUser = require("./src/vautoAnnotator");

// Test data - using actual VINs from your vehicles.json file
const testUser = {
  email: "Omar Dahbour",
  vins: [
    "3FA6P0K97DR341490", // 2016 Ford Explorer Limited
    "3N1CE2CP4HL359341", // 2017 Toyota Corolla
  ],
};

async function runTest() {
  console.log("🧪 Starting vAuto Annotator Test...\n");

  try {
    // Check if required environment variables are set
    if (!process.env.VAUTO_USERNAME || !process.env.VAUTO_PASSWORD) {
      throw new Error(
        "❌ Missing required environment variables: VAUTO_USERNAME and VAUTO_PASSWORD"
      );
    }

    console.log("✅ Environment variables found");
    console.log(`📧 Testing with user: ${testUser.email}`);
    console.log(`🔢 VINs to process: ${testUser.vins.length}`);
    console.log(`📋 VINs: ${testUser.vins.join(", ")}\n`);

    // Run the annotation
    const results = await annotateUser(testUser);

    // Display results
    console.log("\n" + "=".repeat(50));
    console.log("📊 DETAILED TEST RESULTS");
    console.log("=".repeat(50));

    if (results && results.length > 0) {
      results.forEach((result, index) => {
        console.log(`\n${index + 1}. VIN: ${result.vin}`);
        console.log(`   Title: ${result.title || "N/A"}`);
        console.log(
          `   Status: ${result.success ? "✅ Success" : "❌ Failed"}`
        );

        if (result.success) {
          console.log(`   Generated Note:`);
          console.log(`   ${result.note.split("\n").join("\n   ")}`);

          if (result.evaluationData) {
            console.log(`   Raw Data:`);
            console.log(`   - KBB: ${result.evaluationData.kbb || "N/A"}`);
            console.log(`   - MMR: ${result.evaluationData.mmr || "N/A"}`);
            console.log(`   - Owner: ${result.evaluationData.owner || "N/A"}`);
            console.log(
              `   - Odometer Check: ${
                result.evaluationData.odometerCheck || "N/A"
              }`
            );
          }
        } else {
          console.log(`   Error: ${result.error || "Unknown error"}`);
        }
      });
    } else {
      console.log("⚠️ No results returned");
    }
  } catch (error) {
    console.error("\n❌ Test failed with error:");
    console.error(error.message);
    console.error("\n🔧 Troubleshooting tips:");
    console.error(
      "1. Make sure your .env file contains VAUTO_USERNAME and VAUTO_PASSWORD"
    );
    console.error(
      "2. Check that vehicles.json exists and contains valid vehicle data"
    );
    console.error("3. Ensure you have a stable internet connection");
    console.error(
      "4. Make sure the VINs in testUser.vins exist in your vehicles.json file"
    );
  }
}

// Run the test
runTest();
