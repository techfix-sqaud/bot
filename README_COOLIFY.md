# 🚗 Vehicle Data Bot - Coolify Deployment Ready

A Node.js application for scraping and enriching vehicle data from CarMax and vAuto, now optimized for deployment on Coolify.

## 🚀 Quick Deploy to Coolify

This project is ready for deployment on Coolify with minimal configuration.

### Prerequisites
- Coolify instance
- GitHub repository
- Node.js 18+ (handled automatically by Coolify)

### 1-Click Deployment Steps

1. **Fork/Clone this repository** to your GitHub account
2. **Create new application** in Coolify dashboard
3. **Connect your GitHub repository**
4. **Set environment variables** (see below)
5. **Deploy!**

## 🔧 Environment Configuration

### Required Variables (set in Coolify):
```env
NODE_ENV=production
MODE=web
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
```

### Optional Variables:
```env
# Credentials (if using scraping features)
CARMAX_EMAIL=your-email@example.com
CARMAX_PASSWORD=your-password
VAUTO_USERNAME=your-username
VAUTO_PASSWORD=your-password

# Custom port (Coolify sets this automatically)
PORT=3000
```

## 🎯 Application Modes

The app can run in different modes via the `MODE` environment variable:

- **`web`** (recommended): Web interface for managing vehicle data
- **`scrape`**: One-time scraping job (exits after completion)  
- **`cli`**: Command-line interface mode

## 🌐 Web Interface Features

When deployed in `web` mode, the application provides:

- **Dashboard**: Status and health monitoring
- **File Management**: Upload, download, and manage vehicle data
- **Data Export**: Multiple formats (JSON, CSV, XLSX)
- **vAuto Integration**: Annotate vehicles with market evaluations
- **API Endpoints**: RESTful API for programmatic access

### Available Endpoints:
- `GET /` - Main dashboard
- `GET /health` - Health check for monitoring
- `GET /api/files` - List available data files
- `GET /api/download/:filename` - Download files with format conversion

## 📁 Project Structure

```
bot/
├── src/
│   ├── app.js              # Main entry point (mode selector)
│   ├── webInterface.js     # Web UI and API
│   ├── orchestrator.js     # Data processing orchestrator
│   ├── config.js           # Configuration (deployment-ready)
│   └── ...
├── data/                   # Vehicle data files
├── nixpacks.toml          # Coolify build configuration
├── Procfile               # Process definitions
├── .env.example           # Environment template
└── COOLIFY_DEPLOYMENT.md  # Detailed deployment guide
```

## 🛠️ Local Development

```bash
# Clone repository
git clone <your-repo>
cd bot

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Run in development mode
npm run dev

# Run web interface
npm run web
```

## 🐳 Migration from Docker

This project was originally Docker-based but is now optimized for Coolify's native Node.js deployment:

- ✅ Faster builds (no Docker layer)
- ✅ Better resource utilization
- ✅ Automatic dependency management via Nixpacks
- ✅ Built-in health monitoring
- ✅ Easy environment variable management

The original Docker files are preserved for reference but not needed for Coolify deployment.

## 🔍 Monitoring & Health Checks

The application includes built-in health monitoring:

- **Health Endpoint**: `GET /health` returns application status
- **Startup Logs**: Detailed logging for deployment troubleshooting
- **Error Handling**: Graceful error handling with proper exit codes

## 🚨 Troubleshooting

### Common Issues:

1. **Build Failures**: Check nixpacks.toml configuration
2. **Puppeteer Issues**: Ensure `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true`
3. **Memory Issues**: Consider upgrading Coolify resource limits
4. **Environment Variables**: Double-check all required vars are set

### Debug Mode:
Set `DEBUG=true` in environment variables for verbose logging.

## 📚 Documentation

- [`COOLIFY_DEPLOYMENT.md`](./COOLIFY_DEPLOYMENT.md) - Detailed deployment guide
- [`IMPLEMENTATION_SUMMARY.md`](./IMPLEMENTATION_SUMMARY.md) - Technical implementation details

## 🔐 Security

- Credentials stored as environment variables
- Headless browser mode in production
- No sensitive data committed to repository
- Secure default configurations

## 📄 License

ISC License - see package.json for details.

---

**Ready to deploy?** Follow the [detailed deployment guide](./COOLIFY_DEPLOYMENT.md) for step-by-step instructions.
