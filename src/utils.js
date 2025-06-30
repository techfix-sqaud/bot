const fs = require("fs");
const path = require("path");
const _ = require("lodash");
const XLSX = require("xlsx");
const moment = require("moment");

// Generate date-based filename
exports.generateDateFilename = (baseName, extension = "json") => {
  const dateStr = moment().format("YYYY-MM-DD_HH-mm-ss");
  return `./data/${baseName}_${dateStr}.${extension}`;
};

// Get the most recent file matching a pattern
exports.getMostRecentFile = (pattern) => {
  const dataDir = "./data";
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    return null;
  }

  const files = fs
    .readdirSync(dataDir)
    .filter((file) => file.includes(pattern) && file.endsWith(".json"))
    .map((file) => ({
      name: file,
      path: path.join(dataDir, file),
      mtime: fs.statSync(path.join(dataDir, file)).mtime,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  return files.length > 0 ? files[0].path : null;
};

exports.saveJSON = (file, data) => {
  // Ensure data directory exists
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(`💾 Saved JSON data to: ${file}`);
};

exports.loadJSON = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file));
  } catch {
    return [];
  }
};

// Export data to different formats
exports.exportToExcel = (data, filename) => {
  try {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vehicles");

    // Auto-size columns
    const cols = [];
    const headers = Object.keys(data[0] || {});
    headers.forEach(() => cols.push({ wch: 15 }));
    ws["!cols"] = cols;

    XLSX.writeFile(wb, filename);
    console.log(`📊 Exported to Excel: ${filename}`);
    return filename;
  } catch (error) {
    console.error(`❌ Error exporting to Excel: ${error.message}`);
    throw error;
  }
};

exports.exportToCSV = (data, filename) => {
  try {
    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    fs.writeFileSync(filename, csv);
    console.log(`📊 Exported to CSV: ${filename}`);
    return filename;
  } catch (error) {
    console.error(`❌ Error exporting to CSV: ${error.message}`);
    throw error;
  }
};

// Export with user choice of format
exports.exportData = (data, baseName, format = "xlsx") => {
  const dateStr = moment().format("YYYY-MM-DD_HH-mm-ss");
  const filename = `./data/${baseName}_${dateStr}.${format}`;

  switch (format.toLowerCase()) {
    case "xlsx":
    case "xls":
      return exports.exportToExcel(data, filename);
    case "csv":
      return exports.exportToCSV(data, filename);
    case "json":
      exports.saveJSON(filename, data);
      return filename;
    default:
      throw new Error(`Unsupported export format: ${format}`);
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
