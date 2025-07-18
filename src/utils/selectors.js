// Selector arrays for CarMax My List scraper
// Exported for reuse in other files

// Vehicle container selectors
const vehicleSelectors = [
  ".vehicle-Tixca",
  ".vehicle-list-item",
  ".saved-vehicle-item",
  ".mylist-vehicle",
  '[class*="vehicle-list"]',
  '[class*="vehicle-row"]',
  '[class*="vehicle-card"]',
  '[class*="vehicle"]',
  '[class*="saved-vehicle"]',
  '[class*="mylist"]',
  "tbody tr",
  ".MuiTableBody-root tr",
  '[role="row"]',
  '[data-testid*="vehicle"]',
  '[data-testid*="saved"]',
  ".vehicle-item",
  ".list-item",
];

// VIN selectors
const vinSelectors = [
  ".vehicle-vin-VvhMG span",
  ".vehicle-vin-Mc8Le",
  ".vehicle-vin",
  '[class*="vehicle-vin"] span',
  '[class*="vehicle-vin"]',
  '[class*="vin"] span',
  '[class*="vin"]',
  '[data-testid*="vin"]',
  ".vin",
];

// YM/MT selectors
const ymmtSelectors = [
  ".vehicle-heading-irWa8 span",
  ".vehicle-heading-irWa8",
  ".vehicle-ymmt-I4Jge",
  ".vehicle-ymmt",
  '[class*="vehicle-heading"] span',
  '[class*="vehicle-heading"]',
  '[class*="ymmt"]',
  '[class*="vehicle-title"]',
  '[class*="vehicle-name"]',
  ".vehicle-details",
  "h2",
  "h3",
  "h4",
];

// Run number selectors
const runNumberSelectors = [
  ".vehicle-run-number-TOWny",
  ".vehicle-run-number-yx1uJ",
  ".vehicle-run-number",
  '[class*="run-number"]',
  '[class*="lot-number"]',
  '[data-testid*="run"]',
  '[data-testid*="lot"]',
];

// Mileage selectors
const mileageSelectors = [
  ".vehicle-info-n4bAH span",
  ".vehicle-mileage-aQs6j",
  ".vehicle-mileage",
  '[class*="vehicle-info"] span',
  '[class*="mileage"]',
  '[class*="miles"]',
  '[data-testid*="mileage"]',
  '[data-testid*="miles"]',
];

// Additional info selectors (for extra vehicle info)
const additionalInfoSelectors = [".vehicle-info-n4bAH span"];

// Scroll container selectors
const scrollContainerSelectors = [
  ".vehicle-list-container",
  ".search-results",
  ".vehicles-container",
  '[class*="scroll"]',
  '[role="main"]',
  "main",
  "body",
];

// Vehicle count selectors
const vehicleCountSelectors = [
  ".vehicle-list-item",
  '[class*="vehicle-list"]',
  '[class*="vehicle-row"]',
  "tbody tr",
  ".MuiTableBody-root tr",
  '[role="row"]',
];

module.exports = {
  vehicleSelectors,
  vinSelectors,
  ymmtSelectors,
  runNumberSelectors,
  mileageSelectors,
  additionalInfoSelectors,
  scrollContainerSelectors,
  vehicleCountSelectors,
};
