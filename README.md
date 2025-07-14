# CarMax vAuto Bot - Vehicle Enrichment System

A comprehensive Node.js application that automates CarMax vehicle data scraping and enrichment with vAuto evaluation data. Features a modern web interface with secure user authentication and credential management.

## 🌟 Features

### 🔐 Secure Authentication System
- **User Registration & Login**: Secure account creation with encrypted credential storage
- **Multi-Platform Credentials**: Manage CarMax, vAuto, and API credentials in one place
- **Session Management**: Persistent login sessions with automatic logout
- **Encrypted Storage**: Service passwords encrypted using AES-256-CBC

### 🚗 Vehicle Data Processing
- **CarMax Integration**: Automated scraping of auctions and My List data
- **vAuto Enrichment**: Comprehensive vehicle evaluation including:
  - KBB (Kelley Blue Book) values
  - MMR (Market Make Ready) values
  - Vehicle history (accidents, damage, ownership)
  - Odometer verification
- **Smart Processing**: Only processes vehicles without existing vAuto data
- **Data Export**: Download enriched vehicle data in JSON format

### 🎮 Modern Web Interface
- **Real-time Dashboard**: Live job progress and status updates
- **Interactive Controls**: Start, stop, and monitor scraping jobs
- **Vehicle Grid View**: Browse and preview scraped vehicle data
- **Responsive Design**: Works on desktop and mobile devices

## 🚀 Quick Start

### 1. Installation
```bash
npm install
```

### 2. First Time Setup
1. Start the application:
   ```bash
   npm start
   ```

2. Open your browser and navigate to `http://localhost:3000`

3. Click "Create one here" to register a new account

4. Fill in the registration form with:
   - **Your Email & Password**: For logging into the bot
   - **CarMax Credentials**: Your CarMax Auctions login details
   - **vAuto Credentials**: Your vAuto platform access credentials
   - **vAuto Secret Key**: Your vAuto API secret key

### 3. Using the Dashboard
Once logged in, you can:
- **Scrape Auctions**: Get all vehicles from CarMax auctions
- **Scrape My List**: Get vehicles from your CarMax saved list
- **vAuto Enrichment**: Enhance vehicle data with vAuto evaluations
- **Complete Workflow**: Run scraping + enrichment in sequence

## 🔧 Configuration

### Environment Variables (Optional)
Create a `.env` file for additional configuration:
```env
# Security (recommended for production)
JWT_SECRET=your-jwt-secret-key-here
ENCRYPTION_KEY=your-32-character-encryption-key
SESSION_SECRET=your-session-secret-key

# Database (optional)
DB_HOST=localhost
DB_USER=postgres
DB_NAME=carmax_bot
DB_PASSWORD=your_db_password

# Development
NODE_ENV=development
```

### Production Deployment
For production environments:
1. Set secure environment variables
2. Use HTTPS for encrypted communication
3. Configure a proper database instead of file storage
4. Set `NODE_ENV=production`

## 📱 Web Interface

### Authentication Pages
- **Login** (`/login`): Secure user authentication
- **Signup** (`/signup`): New user registration with credential setup

### Dashboard Features
- **Control Panel**: Start/stop jobs with real-time feedback
- **Progress Monitor**: Live console output and job status
- **Vehicle Data Grid**: Preview scraped vehicles
- **Export Tools**: Download data in various formats

## 🛡️ Security Features

- **Password Hashing**: User passwords hashed with bcrypt
- **Credential Encryption**: Service passwords encrypted, not hashed
- **Session Security**: Secure session management with expiration
- **Input Validation**: Server-side validation for all user inputs
- **CSRF Protection**: Built-in protection against common attacks

## 📋 API Endpoints

### Authentication
- `GET /login` - Login page
- `GET /signup` - Registration page
- `POST /auth/login` - User login
- `POST /auth/signup` - User registration
- `GET /auth/logout` - User logout

### Dashboard & Data
- `GET /` - Main dashboard (requires auth)
- `GET /api/status` - Job and vehicle status
- `GET /api/vehicles` - Vehicle data
- `GET /api/vehicles/export` - Export vehicle data

### Job Control
- `POST /api/scrape/carmax` - Start CarMax scraping
- `POST /api/scrape/vauto` - Start vAuto enrichment
- `POST /api/scrape/complete` - Start complete workflow
- `POST /api/cancel/:jobType` - Cancel running job

## 🔄 Workflow Options
node test-scraper.js
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
