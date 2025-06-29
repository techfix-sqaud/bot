require("dotenv").config();

console.log("🔍 Environment Diagnostics:");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("MODE:", process.env.MODE);
console.log("PORT:", process.env.PORT);
console.log(
  "VAUTO_USERNAME:",
  process.env.VAUTO_USERNAME ? "✅ Set" : "❌ Missing"
);
console.log(
  "VAUTO_PASSWORD:",
  process.env.VAUTO_PASSWORD ? "✅ Set" : "❌ Missing"
);
console.log("Current working directory:", process.cwd());
console.log("Files in current directory:");

const fs = require("fs");
try {
  const files = fs.readdirSync(".");
  files.forEach((file) => console.log("  -", file));
} catch (error) {
  console.log("Error reading directory:", error.message);
}

console.log("\nFiles in src directory:");
try {
  const srcFiles = fs.readdirSync("./src");
  srcFiles.forEach((file) => console.log("  -", file));
} catch (error) {
  console.log("Error reading src directory:", error.message);
}

console.log("\nFiles in data directory:");
try {
  const dataFiles = fs.readdirSync("./data");
  dataFiles.forEach((file) => console.log("  -", file));
} catch (error) {
  console.log("Error reading data directory:", error.message);
}

// Test if webInterface can be loaded
console.log("\n🧪 Testing module imports:");
try {
  const webInterface = require("./src/webInterface");
  console.log("✅ webInterface.js loaded successfully");
} catch (error) {
  console.log("❌ Error loading webInterface.js:", error.message);
}

console.log("\n🚀 Starting application...");

// Run the actual app
require("./src/app.js");
