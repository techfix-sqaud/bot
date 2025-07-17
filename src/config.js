/**
 * Configuration settings for CarMax vAuto Bot
 */

module.exports = {
  // Service URLs
  carmaxUrl: "https://www.carmaxauctions.com",
  vautoUrl: "https://www2.vauto.com/genius/platform/quickvin",

  // Browser settings
  headless: process.env.NODE_ENV === "production" ? true : false,
  show2FA: process.env.NODE_ENV === "production" ? false : true,

  // Application settings
  maxRetries: 3,
  requestDelay: 2000, // ms between requests to avoid rate limiting

  // File paths
  dataDir: "./data",
  userDataDir: "./user_data",
};
