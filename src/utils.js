/**
 * Utility Functions
 * Common utilities and helper functions
 */

// Re-export from modular libraries
const { launchPuppeteer } = require("./lib/browser");
const { saveJSON, loadJSON, generateDateFilename } = require("./lib/files");

/**
 * Sleep utility function
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after the specified time
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Format timestamp for logging
 * @returns {string} Formatted timestamp
 */
function getTimestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Log with timestamp
 * @param {string} message - Message to log
 * @param {string} level - Log level (info, warn, error)
 */
function logWithTimestamp(message, level = 'info') {
  const timestamp = getTimestamp();
  const prefix = level.toUpperCase();
  console.log(`[${timestamp}] [${prefix}] ${message}`);
}

module.exports = {
  // Browser utilities
  launchPuppeteer,
  
  // File utilities
  saveJSON,
  loadJSON,
  generateDateFilename,
  
  // Common utilities
  sleep,
  getTimestamp,
  logWithTimestamp
};
