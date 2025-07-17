/**
 * CarMax My List Navigation Module
 * Handles navigation to the My List page
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Navigate to CarMax My List page
 * @param {Page} page - Puppeteer page instance
 */
async function navigateToMyList(page) {
  console.log("🔍 Navigating to My List...");

  try {
    await page.waitForSelector("body", { timeout: 10000 });
    await sleep(3000);

    const navigationResult = await page.evaluate(() => {
      // Try href patterns first
      const hrefSelectors = [
        'a[href="/mylist"]',
        'a[href*="/mylist"]',
        'a[href*="mylist"]',
        'a[href*="saved"]',
      ];

      for (const selector of hrefSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          try {
            elements[0].click();
            return { success: true, strategy: "href_pattern" };
          } catch (err) {
            // continue
          }
        }
      }

      // Try text content patterns
      const allLinks = document.querySelectorAll(
        "a, nav a, [class*='nav'] a, [class*='header'] a, [class*='menu'] a"
      );
      const textPatterns = [
        /^my\s*list$/i,
        /^mylist$/i,
        /^saved$/i,
        /saved\s*vehicles/i,
      ];

      for (const link of allLinks) {
        const text = link.textContent?.trim() || "";
        for (const pattern of textPatterns) {
          if (
            pattern.test(text) ||
            text.toLowerCase().includes("my list") ||
            text.toLowerCase().includes("saved")
          ) {
            try {
              link.click();
              return { success: true, strategy: "text_pattern" };
            } catch (err) {
              // continue
            }
          }
        }
      }
      return { success: false };
    });

    if (navigationResult.success) {
      console.log(
        `✅ Successfully clicked My List using ${navigationResult.strategy}`
      );
      try {
        await page.waitForNavigation({
          waitUntil: "networkidle2",
          timeout: 15000,
        });
      } catch {
        console.log(
          "⚠️ Navigation wait failed, but click may have worked. Continuing..."
        );
      }
    } else {
      console.log('❌ "My List" link not found, trying direct URLs...');
      const currentUrl = page.url();
      const baseUrl = new URL(currentUrl).origin;
      const possibleUrls = [
        `${baseUrl}/mylist`,
        `${baseUrl}/saved`,
        `${baseUrl}/favorites`,
      ];

      let directNavSuccess = false;
      for (const testUrl of possibleUrls) {
        try {
          await page.goto(testUrl, {
            waitUntil: "networkidle2",
            timeout: 15000,
          });
          const isMyListPage = await page.evaluate(() => {
            const pageText = document.body?.textContent?.toLowerCase() || "";
            const url = window.location.href.toLowerCase();
            return (
              url.includes("/mylist") ||
              url.includes("/saved") ||
              pageText.includes("my list") ||
              pageText.includes("saved vehicles")
            );
          });

          if (isMyListPage) {
            console.log(`✅ Successfully navigated to My List: ${testUrl}`);
            directNavSuccess = true;
            break;
          }
        } catch (error) {
          // Continue to next URL
        }
      }

      if (!directNavSuccess) {
        throw new Error("Could not navigate to My List using any method");
      }
    }

    await sleep(3000);
    console.log("✅ Successfully navigated to My List");
  } catch (error) {
    console.error("❌ Failed to navigate to My List:", error.message);
    throw error;
  }
}

module.exports = {
  navigateToMyList,
};
