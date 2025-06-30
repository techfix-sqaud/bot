# vAuto Vehicle Enrichment Bot

A Node.js bot that enriches existing vehicle data with comprehensive evaluation data from vAuto.

## Features

- **CarMax Integration**: Scrapes vehicle data from CarMax auctions or your saved My List
- **Scraping Options**: 
  - **All Auctions**: Scrape vehicles from all available CarMax auctions
  - **My List**: Scrape only vehicles you've saved in your CarMax "My List"
- **vAuto Integration**: Logs into vAuto and evaluates vehicles from your JSON file
- **Comprehensive Data**: Gets detailed vehicle evaluation including:
  - KBB (Kelley Blue Book) values
  - MMR (Market Make Ready) values
  - Vehicle history (accidents, damage, ownership)
  - Odometer verification
- **Smart Processing**: Only processes vehicles that don't already have vAuto data
- **Data Persistence**: Updates vehicles.json with enriched evaluation data
- **Web Interface**: Easy-to-use web interface for managing scraping and data export

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   
   Make sure your `.env` file contains:
   ```
   VAUTO_USERNAME=your_vauto_username
   VAUTO_PASSWORD=your_vauto_password
   CARMAX_EMAIL=your_carmax_email
   CARMAX_PASSWORD=your_carmax_password
   ```

## Usage

### Web Interface (Recommended)
```bash
npm start
```
Then open your browser to `http://localhost:3000` and use the web interface to:
- Choose between "All Auctions" or "My List" scraping
- Monitor scraping progress in real-time
- Cancel running jobs if needed
- View and export scraped data

### Command Line Interface

#### Run Complete Workflow (CarMax + vAuto)
```bash
npm run scrape
```

#### Run Only CarMax Scraping
```bash
# Scrape all auctions
node cli.js carmax --mode=auctions

# Scrape only My List
node cli.js carmax --mode=mylist
```

#### Run Only vAuto Enrichment
```bash
npm run vauto
```

## How It Works

1. **Data Loading**: 
   - Loads existing vehicles from `vehicles.json`
   - Identifies vehicles that need vAuto evaluation (missing vautoData)

2. **vAuto Enrichment**:
   - Logs into vAuto evaluation platform
   - Inputs VIN and mileage for each vehicle
   - Extracts comprehensive evaluation data
   - Processes AutoCheck vehicle history data

3. **Data Enhancement**:
   - Formats evaluation data into structured notes
   - Updates vehicles.json with new vAuto data
   - Maintains all existing vehicle information

## Output Format

Each vehicle in `vehicles.json` will contain:

```json
{
  "vin": "1HGBH41JXMN109186",
  "mileage": "75000",
  "year": "2021",
  "makeModel": "Honda Accord",
  "title": "2021 Honda Accord",
  "href": "/vehicle/12345",
  "vautoData": {
    "odometerCheck": "No Issue",
    "owner": "1 - Own",
    "ownerDateText": "03/23",
    "accidentDamage": [],
    "kbb": "$18,500",
    "mmr": "$17,800"
  },
  "note": "1 - Own\\n03/23\\nk= $18,500\\nm= $17,800",
  "scrapedAt": "2025-06-29T...",
  "enrichedAt": "2025-06-29T..."
}
```

## Configuration

Edit `src/config.js` to modify:
- URLs for CarMax and vAuto
- Headless mode (true/false)
- Other browser settings

## Error Handling

The bot includes comprehensive error handling:
- Retries for network timeouts
- Graceful handling of missing vehicle data
- Detailed logging for debugging
- Continues processing even if individual vehicles fail

## Files

- `src/carmaxVautoScraper.js` - Main scraper combining CarMax and vAuto
- `src/index.js` - Entry point
- `test-scraper.js` - Test runner with detailed logging
- `src/config.js` - Configuration settings
- `src/utils.js` - Utility functions for JSON handling
- `data/vehicles.json` - Output file with vehicle data

## Troubleshooting

1. **Login Issues**: Make sure credentials are correct in `.env` file
2. **Timeout Errors**: Check internet connection and increase timeout values
3. **Missing Elements**: Websites may have changed - check selectors in code
4. **Permission Errors**: Ensure write access to `./data/` directory

## Notes

- The bot uses persistent browser sessions via `userDataDir` for better login handling
- Processing is sequential to avoid rate limiting
- Large datasets may take considerable time to process
- The bot respects website rate limits with built-in delays
