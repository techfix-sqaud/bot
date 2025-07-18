#!/usr/bin/env node

/**
 * Migration Script for CarMax vAuto Bot
 * Helps existing users set up the new authentication system
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const auth = require("./src/auth");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function hiddenQuestion(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    let input = "";
    process.stdin.on("data", function (char) {
      char = char + "";

      switch (char) {
        case "\n":
        case "\r":
        case "\u0004":
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write("\n");
          resolve(input);
          break;
        case "\u0003":
          process.exit();
          break;
        case "\b":
        case "\u007f":
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write("\b \b");
          }
          break;
        default:
          input += char;
          process.stdout.write("*");
          break;
      }
    });
  });
}

async function checkExistingEnv() {
  const envPath = path.join(__dirname, ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const carmaxEmail = envContent.match(/CARMAX_EMAIL=(.+)/)?.[1];
    const vautoUsername = envContent.match(/VAUTO_USERNAME=(.+)/)?.[1];

    if (carmaxEmail || vautoUsername) {
      console.log("\n🔍 Found existing credentials in .env file:");
      if (carmaxEmail) console.log(`  CarMax Email: ${carmaxEmail}`);
      if (vautoUsername) console.log(`  vAuto Username: ${vautoUsername}`);

      const migrate = await question(
        "\nWould you like to migrate these credentials to the new system? (y/n): "
      );
      if (migrate.toLowerCase() === "y") {
        return { carmaxEmail, vautoUsername };
      }
    }
  }
  return null;
}

async function createFirstUser() {
  console.log("\n🚀 Welcome to CarMax vAuto Bot Setup!");
  console.log("This script will help you create your first user account.\n");

  const existing = await checkExistingEnv();

  console.log("👤 Account Information");
  console.log("=".repeat(50));

  const email = await question("Email address: ");
  const password = await hiddenQuestion("Password: ");
  const confirmPassword = await hiddenQuestion("Confirm password: ");

  if (password !== confirmPassword) {
    console.log("\n❌ Passwords do not match. Please try again.");
    process.exit(1);
  }

  console.log("\n🏪 CarMax Credentials");
  console.log("=".repeat(50));

  const carmaxEmail =
    existing?.carmaxEmail || (await question("CarMax email: "));
  const carmaxPassword = await hiddenQuestion("CarMax password: ");

  console.log("\n🔧 vAuto Credentials");
  console.log("=".repeat(50));

  const vautoUsername =
    existing?.vautoUsername || (await question("vAuto username: "));
  const vautoPassword = await hiddenQuestion("vAuto password: ");
  const vautoSecretKey = await hiddenQuestion("vAuto secret key: ");

  try {
    const user = await auth.register({
      email,
      password,
      carmaxEmail,
      carmaxPassword,
      vautoUsername,
      vautoPassword,
      vautoSecretKey,
    });

    console.log("\n✅ User account created successfully!");
    console.log(`📧 Email: ${user.email}`);
    console.log(`🏪 CarMax: ${user.carmaxEmail}`);
    console.log(`🔧 vAuto: ${user.vautoUsername}`);
    console.log("\n🌐 You can now start the application with: npm start");
    console.log("📱 Then visit: http://localhost:3000");
  } catch (error) {
    console.log(`\n❌ Error creating user: ${error.message}`);
    process.exit(1);
  }

  rl.close();
}

async function main() {
  try {
    // Check if users already exist
    const usersFile = path.join(__dirname, "data", "users.json");
    if (fs.existsSync(usersFile)) {
      const users = JSON.parse(fs.readFileSync(usersFile, "utf8"));
      if (users.length > 0) {
        console.log("👥 User accounts already exist.");
        console.log("🌐 Start the application with: npm start");
        console.log("📱 Then visit: http://localhost:3000");
        return;
      }
    }

    await createFirstUser();
  } catch (error) {
    console.error("❌ Setup failed:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { createFirstUser };
