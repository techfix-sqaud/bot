const bcrypt = require("bcryptjs");
const auth = require("../auth/auth");

/**
 * Credential Helper for decrypting user credentials for scraping processes
 */
class CredentialHelper {
  /**
   * Set up environment variables from user credentials
   * @param {string} userId - User ID to get credentials for
   */
  async setupUserCredentials(userId) {
    try {
      // const credentials = await auth.getUserCredentials(userId);
      // if (!credentials) {
      //   throw new Error("User credentials not found");
      // }

      // Note: In a production system, you would decrypt these passwords here
      // For now, we'll store them as hashed in the database but need to handle them differently
      // This is a simplified implementation

      // Set environment variables (these should be the actual passwords, not hashed)
      // In production, you'd decrypt these from the database
      process.env.CARMAX_EMAIL = credentials.carmaxEmail;
      process.env.VAUTO_USERNAME = credentials.vautoUsername;
      process.env.VAUTO_SECRET_KEY = credentials.vautoSecretKey;

      // Note: The actual passwords are hashed in the database
      // In a real implementation, you'd need to either:
      // 1. Store them encrypted (not hashed) so they can be decrypted
      // 2. Or prompt the user to re-enter them for each session
      // For this demo, we'll document this limitation

      return true;
    } catch (error) {
      console.error("Error setting up user credentials:", error);
      throw error;
    }
  }

  /**
   * Clear environment variables for security
   */
  clearCredentials() {
    delete process.env.CARMAX_EMAIL;
    delete process.env.CARMAX_PASSWORD;
    delete process.env.VAUTO_USERNAME;
    delete process.env.VAUTO_PASSWORD;
    delete process.env.VAUTO_SECRET_KEY;
  }

  /**
   * Validate that required credentials are available
   */
  validateCredentials() {
    const required = ["CARMAX_EMAIL", "VAUTO_USERNAME"];
    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required credentials: ${missing.join(", ")}`);
    }
  }
}

module.exports = new CredentialHelper();
