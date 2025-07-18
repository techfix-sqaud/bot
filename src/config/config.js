module.exports = {
  carmaxUrl: "https://www.carmaxauctions.com",
  vautoUrl: "https://www2.vauto.com/genius/platform/quickvin",
  // Force headless mode in production/server environments
  headless: process.env.NODE_ENV === "production" ? true : false,
  // Disable 2FA UI in production environments (server has no display)
  show2FA: process.env.NODE_ENV === "production" ? false : true,
};
