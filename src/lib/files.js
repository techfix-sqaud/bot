/**
 * File System Utilities
 * Handles JSON file operations and data management
 */

const fs = require("fs");
const path = require("path");
const config = require("../config");

/**
 * Save data to JSON file
 * @param {string} filename - Name of the file (with or without .json)
 * @param {any} data - Data to save
 */
function saveJSON(filename, data) {
  try {
    // Ensure filename has .json extension
    if (!filename.endsWith(".json")) {
      filename += ".json";
    }

    // Ensure data directory exists
    const dataDir = config.dataDir;
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Create full path
    const fullPath = path.resolve(dataDir, filename);

    // Write file
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
    console.log(`💾 Data saved to: ${filename}`);
  } catch (error) {
    console.error(`❌ Failed to save JSON file ${filename}:`, error.message);
    throw error;
  }
}

/**
 * Load data from JSON file
 * @param {string} filename - Name of the file to load
 * @returns {any} Parsed JSON data or empty array if file doesn't exist
 */
function loadJSON(filename) {
  try {
    // Handle both relative and absolute paths
    let fullPath;
    if (path.isAbsolute(filename)) {
      fullPath = filename;
    } else {
      fullPath = path.resolve(filename);
    }

    if (!fs.existsSync(fullPath)) {
      console.log(`📄 File not found: ${filename}, returning empty array`);
      return [];
    }

    const data = fs.readFileSync(fullPath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error(`❌ Failed to load JSON file ${filename}:`, error.message);
    return [];
  }
}

/**
 * Generate timestamped filename
 * @param {string} prefix - Filename prefix
 * @param {string} extension - File extension (default: json)
 * @returns {string} Timestamped filename
 */
function generateDateFilename(prefix, extension = "json") {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\./g, "-")
    .substring(0, 19);

  return `${prefix}_${timestamp}.${extension}`;
}

module.exports = {
  saveJSON,
  loadJSON,
  generateDateFilename,
};
