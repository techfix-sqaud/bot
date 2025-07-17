# CarMax vAuto Bot - My List Vehicle Enrichment

> **Clean, focused automation tool** for scraping CarMax My List vehicles and enriching them with vAuto evaluation data.

## 🌟 Features

### 🚗 CarMax My List Integration
- **Automated Login**: Secure authentication using environment credentials
- **My List Scraping**: Extract vehicle data from your saved CarMax vehicles
- **Smart Data Extraction**: Comprehensive vehicle information including VIN, mileage, YMMT
- **Duplicate Detection**: Prevents duplicate entries by VIN validation

### 💎 vAuto Enrichment
- **Market Analysis**: Automatic vAuto evaluation for each vehicle
- **KBB Values**: Kelley Blue Book pricing information
- **MMR Data**: Market Make Ready average pricing
- **History Reports**: Vehicle history and accident data
- **2FA Support**: Handles two-factor authentication when required

### 🎮 Modern Web Interface
- **Real-time Dashboard**: Live job progress and status updates
- **Interactive Controls**: Start, stop, and monitor scraping jobs
- **Data Export**: Download vehicle data as JSON
- **Responsive Design**: Works on desktop and mobile devices

### 🔧 Clean Architecture
- **Modular Design**: Organized into focused services and scrapers
- **CLI Tools**: Command-line interface for automation
- **Environment Config**: Secure credential management
- **Docker Support**: Containerized deployment ready

## 🚀 Quick Start

### 1. Installation
```bash
git clone <repository-url>
cd bot
npm install
```

### 2. Environment Setup
Create a `.env` file with your credentials:
```bash
cp .env.example .env
```

Edit `.env` and add your credentials:
```env
# CarMax Credentials
CARMAX_EMAIL=your-carmax-email@example.com
CARMAX_PASSWORD=your-carmax-password

# vAuto Credentials  
VAUTO_USERNAME=your-vauto-username
VAUTO_PASSWORD=your-vauto-password

# Optional Settings
NODE_ENV=development
SHOW_BROWSER=false
```

### 3. Quick Start Options

#### Web Interface (Recommended)
```bash
npm start
```
Open `http://localhost:3000` in your browser.

#### Command Line Interface
```bash
# Complete workflow (My List + vAuto enrichment)
npm run scrape

# Individual steps
npm run mylist    # Scrape My List only
npm run vauto     # vAuto enrichment only
npm run status    # Show current status
```

## 📁 Project Structure

```
src/
├── scrapers/           # CarMax scraping modules
│   ├── carmax-login.js
│   ├── carmax-navigation.js
│   ├── vehicle-extractor.js
│   └── carmax-mylist-scraper.js
├── services/           # Business logic services
│   ├── vauto-login.js
│   ├── vauto-evaluation.js
│   ├── vauto-enrichment.js
│   └── workflow.js
├── lib/               # Utility libraries
├── database/          # Database schemas
├── config.js          # Configuration settings
├── utils.js           # Common utilities
├── webServer.js       # Express web server
└── index.js           # Main entry point
```

## 🔧 Configuration

### Environment Variables
- `CARMAX_EMAIL` - Your CarMax Auctions email
- `CARMAX_PASSWORD` - Your CarMax Auctions password
- `VAUTO_USERNAME` - Your vAuto platform username
- `VAUTO_PASSWORD` - Your vAuto platform password
- `NODE_ENV` - Environment (development/production)
- `SHOW_BROWSER` - Show browser during scraping (true/false)
- `PORT` - Web server port (default: 3000)

### Browser Settings
- Headless mode is automatically enabled in production
- 2FA support is disabled in server environments
- User data is persisted in `./user_data` directory

## 🚀 Deployment

### Docker
```bash
docker build -t carmax-vauto-bot .
docker run -d -p 3000:3000 --env-file .env carmax-vauto-bot
```

### Docker Compose
```bash
docker-compose up -d
```

## 📊 Data Output

### Vehicle Data Structure
```json
{
  "vin": "1HGBH41JXMN109186",
  "runNumber": "12345",
  "year": "2023",
  "make": "Honda",
  "model": "Civic",
  "trim": "EX",
  "mileage": "15,000",
  "ymmt": "2023 Honda Civic EX",
  "source": "CarMax My List",
  "scrapedAt": "2024-01-15T10:30:00.000Z",
  "vautoData": {
    "kbb": "$22,500",
    "mmr": "$21,800",
    "ownerHistory": [...],
    "accidentDamage": [...],
    "evaluatedAt": "2024-01-15T10:35:00.000Z"
  }
}
```

### Output Files
- `data/vehicles.json` - Main vehicle database
- `data/mylist_vehicles_YYYY-MM-DD_HH-mm-ss.json` - Timestamped backups

## � Enhanced Scraper Features

### Improved Vehicle Collection
The bot now includes an enhanced scraper that ensures all vehicles from your My List are collected:

- **Smart Vehicle Detection**: Automatically detects total vehicle count from page
- **Progressive Scrolling**: Gradually scrolls through the page to load all vehicles
- **Duplicate Prevention**: Uses VIN tracking to prevent duplicate entries
- **Enhanced Selectors**: Multiple CSS selectors for robust vehicle element detection
- **Real-time Progress**: Shows collection progress as vehicles are found

### Testing Browser Mode
For debugging and validation, you can run the scraper with a visible browser window:

```bash
# Run scraper with visible browser
npm run test-browser

# Or use the CLI directly
node cli.js carmax --testing-browser
node cli.js complete --testing-browser

# Test the enhanced scraper specifically
npm run test-enhanced
```

When testing browser mode is enabled:
- Browser window will be visible during scraping
- You can watch the scraper in action
- Useful for debugging selector issues
- Helps validate the scraping process

## �🔧 CLI Commands

```bash
# Core commands
node cli.js carmax     # Scrape CarMax My List
node cli.js vauto      # Enrich with vAuto data
node cli.js complete   # Complete workflow
node cli.js status     # Show status and statistics

# Testing/Debugging commands
node cli.js carmax --testing-browser     # Scrape with visible browser
node cli.js complete --testing-browser   # Complete workflow with visible browser

# NPM shortcuts
npm run mylist         # Same as: node cli.js carmax
npm run vauto         # Same as: node cli.js vauto
npm run scrape        # Same as: node cli.js complete
npm run status        # Same as: node cli.js status

# Testing shortcuts
npm run test-browser   # Scrape with visible browser
npm run test-complete  # Complete workflow with visible browser
npm run test-enhanced  # Test enhanced scraper functionality
```

## 🛠️ Development

### Project Philosophy
This project has been cleaned up and simplified to focus solely on CarMax My List functionality. The architecture emphasizes:

- **Single Responsibility**: Each module has a clear, focused purpose
- **Separation of Concerns**: Login, navigation, extraction, and enrichment are separate
- **Maintainability**: Small, focused files instead of large monoliths
- **Testability**: Modular design makes testing easier

### Contributing
1. Keep modules small and focused
2. Use descriptive function and variable names
3. Add proper error handling and logging
4. Update documentation for any changes

## 📝 License

ISC License - see LICENSE file for details.

## 🔗 Support

For issues or questions:
1. Check the logs in the web interface
2. Run `npm run status` to verify configuration
3. Ensure your CarMax My List has vehicles saved
4. Verify your vAuto credentials are correct
