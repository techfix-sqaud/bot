module.exports = {
  carmaxUrl: "https://www.carmaxauctions.com",
  vautoUrl: "https://www2.vauto.com/genius/platform/quickvin",
  headless: process.env.NODE_ENV === "production" ? true : false, // Headless in production
  show2FA: process.env.NODE_ENV === "production" ? false : true, // No 2FA display in production

  // Puppeteer configuration for deployment
  puppeteerOptions: {
    headless: process.env.NODE_ENV === "production" ? "new" : false,
    args:
      process.env.NODE_ENV === "production"
        ? [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
            "--single-process",
            "--disable-gpu",
          ]
        : [],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  },
};
