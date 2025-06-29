require("dotenv").config();

console.log("🔍 Environment Variable Check\n");

const requiredVars = ["VAUTO_USERNAME", "VAUTO_PASSWORD"];

let allPresent = true;

requiredVars.forEach((varName) => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value.substring(0, 3)}***`);
  } else {
    console.log(`❌ ${varName}: NOT SET`);
    allPresent = false;
  }
});

if (allPresent) {
  console.log("\n🎉 All required environment variables are set!");
  console.log("You can now run: node test-vauto.js");
} else {
  console.log(
    "\n❌ Please set the missing environment variables in your .env file"
  );
  console.log("Example .env file content:");
  console.log("VAUTO_USERNAME=your_username");
  console.log("VAUTO_PASSWORD=your_password");
}
