# Vehicle Data Processing Bot

A comprehensive bot for scraping CarMax auction data and enriching it with vAuto evaluations, with flexible export options.

## 🚀 Features

- **CarMax Scraping**: Automatically scrapes vehicle data from CarMax auctions
- **Date-based Files**: Generates timestamped files for each run
- **vAuto Integration**: Enriches vehicle data with vAuto evaluations
- **Multiple Export Formats**: Export to XLSX, CSV, XLS, or JSON
- **Flexible Workflow**: Run complete workflow or individual steps
- **CLI Interface**: Easy command-line interface for different operations

## 📋 Prerequisites

1. Node.js (v14 or higher)
2. CarMax account credentials
3. vAuto account credentials
4. Environment variables configured

## 🔧 Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd bot

# Install dependencies
npm install

# Create .env file with your credentials
cp .env.example .env
# Edit .env with your credentials
```

## 📝 Environment Variables

Create a `.env` file with the following variables:

```env
# CarMax Credentials
CARMAX_EMAIL=your-carmax-email@example.com
CARMAX_PASSWORD=your-carmax-password

# vAuto Credentials
VAUTO_USERNAME=your-vauto-username
VAUTO_PASSWORD=your-vauto-password
```

## 🎯 Usage

### Method 1: CLI Interface (Recommended)

```bash
# Complete workflow (scrape + annotate + export as Excel)
npm run workflow

# Skip scraping, use existing data, export as CSV
npm run cli -- --skip-scraping --format csv

# Annotate specific VINs and export as Excel
npm run cli -- --vins "1HGBH41JXMN109186,2HGFA16506H000001" --format xlsx

# List available data files
npm run list

# Export latest data as CSV
npm run export -- --format csv

# Run annotation only with specific VINs
npm run annotate -- --vins "1HGBH41JXMN109186"
```

### Method 2: Direct Node.js

```bash
# Run the main workflow
npm start

# Or use the CLI directly
node cli.js --help
```

### Method 3: Programmatic Usage

```javascript
const VehicleDataOrchestrator = require('./src/orchestrator');

const orchestrator = new VehicleDataOrchestrator();

// Complete workflow
const results = await orchestrator.runCompleteWorkflow({
  user: { 
    email: 'user@example.com', 
    vins: ['1HGBH41JXMN109186'] 
  },
  skipScraping: false,
  exportFormat: 'xlsx'
});

// Annotation only
const annotationResults = await orchestrator.runAnnotationOnly(user, {
  exportFormat: 'csv'
});

// Export existing data
const exportResults = await orchestrator.exportExistingData(
  './data/vehicles_2025-06-29_14-30-00.json',
  'xlsx'
);
```

## 📊 Export Formats

| Format | Extension | Description |
|--------|-----------|-------------|
| `xlsx` | `.xlsx` | Excel 2007+ (default, recommended) |
| `xls`  | `.xls`  | Excel 97-2003 |
| `csv`  | `.csv`  | Comma-separated values |
| `json` | `.json` | JavaScript Object Notation |

## 📁 File Structure

```
bot/
├── src/
│   ├── orchestrator.js      # Main workflow coordinator
│   ├── carmaxScraper.js     # CarMax auction scraper
│   ├── vautoAnnotator.js    # vAuto evaluation processor
│   ├── utils.js             # Utility functions and export handlers
│   ├── config.js            # Configuration settings
│   └── index.js             # Main entry point
├── data/                    # Generated data files
│   ├── vehicles_2025-06-29_14-30-00.json
│   ├── vehicles_annotated_2025-06-29_15-45-00.json
│   └── vehicles_annotated_2025-06-29_15-45-00.xlsx
├── cli.js                   # Command-line interface
├── package.json
└── README.md
```

## 🔄 Workflow

1. **Scraping Phase**: 
   - Logs into CarMax
   - Navigates to auctions
   - Extracts vehicle data (VIN, make, model, year, etc.)
   - Saves to timestamped JSON file

2. **Annotation Phase** (optional):
   - Loads vehicle data from JSON
   - Logs into vAuto
   - Processes specified VINs
   - Enriches data with vAuto evaluations
   - Saves annotated data to new timestamped file

3. **Export Phase**:
   - Converts data to requested format
   - Saves to timestamped file

## 📝 CLI Command Reference

```bash
# Show help
node cli.js --help

# Complete workflow commands
node cli.js                                    # Default workflow
node cli.js --skip-scraping                   # Use existing data
node cli.js --format csv                      # Export as CSV
node cli.js --output "my-export.xlsx"         # Custom filename
node cli.js --vins "VIN1,VIN2,VIN3"          # Process specific VINs

# Individual operations
node cli.js list                              # List data files
node cli.js export --format csv              # Export latest data
node cli.js annotate --vins "VIN1,VIN2"      # Annotation only

# Combined options
node cli.js --skip-scraping --format xlsx --vins "1HGBH41JXMN109186,2HGFA16506H000001"
```

## 🛠️ Troubleshooting

### Common Issues

1. **Login Failures**:
   - Verify credentials in `.env` file
   - Check if accounts are locked or require 2FA
   - Ensure network connectivity

2. **Scraping Issues**:
   - Website structure may have changed
   - Update selectors in `carmaxScraper.js`
   - Check if CarMax requires captcha

3. **Export Errors**:
   - Ensure `data/` directory exists
   - Check file permissions
   - Verify data format before export

4. **Memory Issues**:
   - Large datasets may require increased Node.js memory
   - Run: `node --max-old-space-size=4096 cli.js`

### Debug Mode

Enable debug logging by setting the headless mode to false in `config.js`:

```javascript
module.exports = {
  headless: false,  // Set to false to see browser
  // ... other config
};
```

## 📈 Performance Tips

1. **Batch Processing**: Process VINs in smaller batches to avoid rate limiting
2. **Caching**: Use existing data files when possible (`--skip-scraping`)
3. **Format Choice**: CSV files are smaller and faster for large datasets
4. **Parallel Processing**: Future enhancement for concurrent VIN processing

## 🔒 Security Notes

- Never commit `.env` file to version control
- Use strong, unique passwords for accounts
- Consider using application-specific passwords if available
- Regularly rotate credentials

## 📞 Support

For issues and questions:
1. Check the troubleshooting section
2. Review log output for specific error messages
3. Verify environment setup and credentials
4. Check for website changes that may affect scraping

## 🗓️ File Naming Convention

Files are automatically named with timestamps:
- `vehicles_YYYY-MM-DD_HH-mm-ss.json` - Scraped data
- `vehicles_annotated_YYYY-MM-DD_HH-mm-ss.json` - Annotated data
- `vehicles_annotated_YYYY-MM-DD_HH-mm-ss.xlsx` - Exported data

Example: `vehicles_2025-06-29_14-30-00.xlsx`
