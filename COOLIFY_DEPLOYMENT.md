# Coolify Deployment Guide

This project is now configured for deployment on Coolify. Follow these steps to deploy your bot application.

## Prerequisites

1. A Coolify instance running
2. GitHub repository with this code
3. Access to Coolify dashboard

## Deployment Steps

### 1. Prepare Your Repository

Make sure your repository is pushed to GitHub with all the latest changes:

```bash
git add .
git commit -m "Configure for Coolify deployment"
git push origin main
```

### 2. Create New Application in Coolify

1. Log into your Coolify dashboard
2. Click "New Application"
3. Select "GitHub" as source
4. Connect your repository
5. Choose the branch (usually `main`)

### 3. Configure Application Settings

In Coolify, set the following configuration:

#### Build Settings:
- **Build Command**: `npm ci`
- **Start Command**: `npm start`
- **Port**: `3000` (or leave auto-detect)

#### Environment Variables:
Add these environment variables in Coolify:

```env
NODE_ENV=production
MODE=web
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

Optional variables (add if needed):
```env
CARMAX_EMAIL=your-email@example.com
CARMAX_PASSWORD=your-password
VAUTO_USERNAME=your-username
VAUTO_PASSWORD=your-password
```

### 4. Configure Nixpacks (if needed)

The project includes a `nixpacks.toml` file that configures:
- Node.js 18
- Chromium browser
- Required system packages for Puppeteer

Coolify should automatically detect and use this configuration.

### 5. Deploy

1. Click "Deploy" in Coolify
2. Monitor the build logs
3. Once deployed, access your application via the provided URL

## Application Modes

The application can run in different modes based on the `MODE` environment variable:

### Web Mode (Default for Deployment)
```env
MODE=web
```
- Starts a web interface on the configured port
- Allows interactive management of vehicle data
- Best for most deployments

### Scrape Mode
```env
MODE=scrape
```
- Runs once and exits
- Performs vehicle data scraping
- Useful for scheduled jobs

### CLI Mode
```env
MODE=cli
```
- Command-line interface mode
- Interactive vehicle data management

## Features Available After Deployment

- **Web Interface**: Access vehicle data management through a web UI
- **File Management**: Upload, download, and manage vehicle data files
- **Data Export**: Export data in various formats (JSON, CSV, XLSX)
- **vAuto Integration**: Annotate vehicle data with vAuto evaluations
- **CarMax Scraping**: Scrape vehicle data from CarMax auctions

## Troubleshooting

### Common Issues:

1. **Puppeteer/Chromium Issues**:
   - Ensure `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true`
   - Verify Chromium is installed via nixpacks.toml

2. **Port Issues**:
   - Coolify automatically assigns ports
   - Ensure your app listens on `0.0.0.0:PORT`

3. **Environment Variables**:
   - Double-check all required env vars are set in Coolify
   - Sensitive credentials should be stored securely

4. **Memory Issues**:
   - Puppeteer can be memory-intensive
   - Consider increasing memory limits in Coolify

### Logs:
Check Coolify deployment logs for detailed error information.

## Updating the Application

To update your deployed application:

1. Push changes to your GitHub repository
2. Coolify will automatically trigger a new deployment (if auto-deploy is enabled)
3. Or manually trigger deployment from Coolify dashboard

## Security Notes

- Never commit sensitive credentials to the repository
- Use environment variables for all secrets
- The application runs in headless mode in production for security
- 2FA handling is disabled in production mode

## Support

For deployment issues:
1. Check Coolify logs
2. Verify environment variables
3. Ensure all dependencies are properly installed
4. Check nixpacks.toml configuration
