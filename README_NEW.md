# vAuto Vehicle Enrichment Bot

A comprehensive Node.js bot that enriches existing vehicle data with detailed evaluation data from vAuto. Features both web interface and command-line tools for flexible operation.

## 🚀 Features

### 🏪 CarMax Integration
- **All Auctions**: Scrape vehicles from all available CarMax auctions
- **My List**: Scrape only vehicles you've saved in your CarMax "My List"
- **Smart Login**: Persistent browser sessions for improved reliability

### 💎 vAuto Integration
- **Automated Login**: Seamless vAuto platform authentication
- **Comprehensive Evaluation**: Extracts detailed vehicle data including:
  - KBB (Kelley Blue Book) values
  - MMR (Market Make Ready) values
  - Vehicle history (accidents, damage, ownership)
  - Odometer verification
- **Smart Processing**: Only processes vehicles missing vAuto data

### 🌐 Web Interface
- **Real-time Progress**: Live updates during scraping operations
- **Multiple Workflows**: Choose between complete workflow or individual steps
- **Data Management**: View, export, and manage vehicle data
- **Job Control**: Cancel running operations when needed

### 🖥️ Command Line Interface
- **Full Automation**: Complete workflow or individual components
- **Flexible Modes**: Support for both auction and My List scraping
- **Status Monitoring**: Check current data and system status
- **Data Export**: Export vehicle data in JSON format

## 📦 Setup

### Install Dependencies
```bash
npm install
```

### Environment Variables
Create a `.env` file with your credentials:
```bash
# vAuto credentials (required)
VAUTO_USERNAME=your_vauto_username
VAUTO_PASSWORD=your_vauto_password

# CarMax credentials (required for scraping)
CARMAX_EMAIL=your_carmax_email
CARMAX_PASSWORD=your_carmax_password

# Optional: Environment settings
NODE_ENV=development
```

## 🚀 Usage

### Web Interface (Recommended)
Start the web interface for easy management:
```bash
npm start
```
Then open your browser to **http://localhost:3000**

#### Web Interface Features:
- **🔄 Complete Workflow**: Run CarMax scraping + vAuto enrichment
- **🏪 CarMax Scraping**: Scrape auctions or My List independently  
- **💎 vAuto Enrichment**: Enrich existing vehicles with evaluation data
- **📊 Data Management**: View statistics and export data
- **📋 Activity Log**: Real-time progress monitoring
- **🚨 Job Control**: Cancel running operations

### Command Line Interface

#### Complete Workflow (CarMax + vAuto)
```bash
# Scrape all auctions then enrich with vAuto
npm run scrape

# Scrape My List then enrich with vAuto
node cli.js complete --mode=mylist
```

#### CarMax Scraping Only
```bash
# Scrape all auctions
npm run carmax
# or
node cli.js carmax --mode=auctions

# Scrape only My List
node cli.js carmax --mode=mylist
```

#### vAuto Enrichment Only
```bash
# Enrich existing vehicles with vAuto data
npm run vauto
# or
node cli.js vauto
```

#### Data Management
```bash
# Check current status
npm run status

# Export vehicle data
npm run export
```

#### Available CLI Commands
```bash
node cli.js --help                    # Show all commands
node cli.js carmax --mode=auctions    # Scrape all auctions
node cli.js carmax --mode=mylist      # Scrape My List
node cli.js vauto                     # Enrich with vAuto
node cli.js complete --mode=auctions  # Full workflow
node cli.js web                       # Start web interface
node cli.js status                    # Show current status
node cli.js export                    # Export data
```

## 📋 How It Works

### 1. Data Collection
- **CarMax Scraping**: Navigates through auctions or My List to collect vehicle data
- **Data Validation**: Ensures VIN and mileage information is captured
- **Duplicate Prevention**: Avoids duplicate entries by VIN matching

### 2. vAuto Enrichment
- **Automated Login**: Logs into vAuto evaluation platform
- **Vehicle Processing**: Inputs VIN and mileage for each vehicle
- **Data Extraction**: Captures comprehensive evaluation data
- **AutoCheck Integration**: Processes vehicle history information

### 3. Data Enhancement
- **Structured Notes**: Formats evaluation data into readable notes
- **JSON Storage**: Updates vehicles.json with enriched data
- **Timestamp Tracking**: Records scraping and enrichment timestamps

## 📊 Output Format

Each vehicle in `vehicles.json` contains:
```json
{
  "vin": "1HGBH41JXMN109186",
  "mileage": "75000",
  "year": "2021",
  "makeModel": "Honda Accord",
  "title": "2021 Honda Accord",
  "href": "/vehicle/12345",
  "engine": "2.0L 4-Cylinder Turbo",
  "auctionLocation": "Atlanta, GA",
  "scrapedAt": "2025-06-29T14:30:00.000Z",
  "vautoData": {
    "odometerCheck": "No Issue",
    "owner": "1 - Own",
    "ownerDateText": "03/23",
    "accidentDamage": [],
    "kbb": "$18,500",
    "mmr": "$17,800"
  },
  "note": "1 - Own\\n03/23\\nk= $18,500\\nm= $17,800",
  "enrichedAt": "2025-06-29T15:45:00.000Z"
}
```

## ⚙️ Configuration

### Browser Settings
Edit `src/config.js` to modify:
- **URLs**: CarMax and vAuto platform URLs
- **Headless Mode**: Browser visibility settings
- **2FA Handling**: Authentication flow preferences

### Advanced Options
- **Timeout Values**: Adjust network and page timeouts
- **Rate Limiting**: Built-in delays prevent blocking
- **User Data**: Persistent browser sessions in `./user_data/`

## 🔧 Server Deployment

### Production Environment
The bot includes comprehensive server deployment support:

- **Headless Operation**: Automatically detects server environments
- **System Chromium**: Uses system-installed browser for efficiency
- **Environment Detection**: Auto-configures for production deployment
- **Resource Optimization**: Server-specific Chrome flags

### Deployment Files
- **`nixpacks.toml`**: Complete deployment configuration
- **`start.js`**: Production startup script with validation
- **`DEPLOYMENT.md`**: Detailed deployment guide

## 🛠️ Error Handling

### Comprehensive Error Management
- **Network Timeouts**: Automatic retries with exponential backoff
- **Missing Data**: Graceful handling of incomplete vehicle information
- **Login Issues**: Clear error messages for credential problems
- **Rate Limiting**: Built-in delays and respectful scraping

### Troubleshooting
1. **Login Issues**: Verify credentials in `.env` file
2. **Timeout Errors**: Check internet connection and increase timeout values
3. **Missing Elements**: Websites may change - check browser console
4. **Permission Errors**: Ensure write access to `./data/` directory

## 📁 File Structure

```
bot/
├── src/
│   ├── index.js                 # Main entry point (web interface)
│   ├── webServer.js            # Web interface server
│   ├── carmaxScraper.js        # CarMax auction scraping
│   ├── carmaxMyListScraper.js  # CarMax My List scraping
│   ├── carmaxVautoScraper.js   # vAuto enrichment engine
│   ├── config.js               # Configuration settings
│   └── utils.js                # Shared utilities
├── public/
│   └── index.html              # Web interface
├── data/
│   └── vehicles.json           # Vehicle database
├── user_data/                  # Browser session data
├── cli.js                      # Command line interface
├── start.js                    # Production startup script
├── package.json                # Dependencies and scripts
├── nixpacks.toml              # Deployment configuration
└── DEPLOYMENT.md              # Deployment guide
```

## 🔒 Security & Privacy

- **Credential Protection**: Environment variables for sensitive data
- **Session Management**: Secure browser session handling
- **Data Privacy**: Local storage of all vehicle data
- **Rate Limiting**: Respectful scraping practices

## 📈 Performance

- **Optimized Processing**: Sequential processing prevents rate limiting
- **Memory Management**: Efficient browser resource usage
- **Batch Operations**: Process multiple vehicles in single session
- **Progress Tracking**: Real-time status updates

## 🚨 Important Notes

### 2FA Considerations
- **Development**: Manual 2FA handling in browser
- **Production**: Requires IP whitelisting or 2FA-free accounts
- **Session Persistence**: Maintains login state between runs

### Data Persistence
- **Local Storage**: All data stored in `./data/vehicles.json`
- **Backup Recommended**: Regular exports for data safety
- **Version Control**: Consider excluding `user_data/` from git

## 🤝 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review error logs in the web interface
3. Verify environment variables are set correctly
4. Ensure network connectivity to CarMax and vAuto

---

**Note**: This bot is for legitimate vehicle research purposes. Always respect website terms of service and rate limits.
