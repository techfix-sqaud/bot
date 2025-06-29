const fs = require("fs");
const _ = require("lodash");

exports.saveJSON = (file, data) =>
  fs.writeFileSync(file, JSON.stringify(data, null, 2));

exports.loadJSON = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file));
  } catch {
    return [];
  }
};

exports.summarizeVehicle = (v) =>
  `🔥 ${v.title} | ${v.mileage}, ${v.engine} | Auction: ${v.auctionLocation}`;

exports.fuzzyMatchVIN = (str, vinList) => {
  // exact VIN match
  if (vinList.includes(str)) return str;
  // fallback fuzzy (could use string similarity)
  return _.find(vinList, (vin) => str.includes(vin.substring(0, 8))) || null;
};
