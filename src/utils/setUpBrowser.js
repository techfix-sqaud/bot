// Launch browser and return { browser, page }
const { launchPuppeteer } = require("./utils");
const config = require("../config/config");
async function setupBrowser() {
  const browser = await launchPuppeteer({
    headless: config.headless,
    protocolTimeout: 120000,
    args: [
      "--disable-dev-shm-usage",
      "--disable-web-security",
      "--disable-features=VizDisplayCompositor",
    ],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(60000);
  await page.setExtraHTTPHeaders({
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    DNT: "1",
    Connection: "keep-alive",
    "Upgrade-Insecure-Requests": "1",
  });
  return { browser, page };
}
module.exports = { setupBrowser };
