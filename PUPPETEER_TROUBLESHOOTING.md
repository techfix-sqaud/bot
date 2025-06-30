# Puppeteer Docker Troubleshooting Guide

This guide helps resolve common Puppeteer issues when running in Docker containers.

## Common Error: `libgbm.so.1: cannot open shared object file`

This error occurs when the Chrome/Chromium browser cannot find required graphics libraries.

### Solution 1: Alpine Linux (Current Setup)

The Dockerfile has been updated to include the necessary dependencies:

```dockerfile
RUN apk add --no-cache \
    chromium \
    mesa-gbm \
    mesa-dri-gallium \
    libx11 libxcomposite libxcursor libxdamage \
    libxext libxfixes libxi libxrandr libxrender \
    libxss libxtst \
    # ... other dependencies
```

### Solution 2: Use Debian-based Image

If Alpine continues to have issues, use the provided `Dockerfile.debian`:

```bash
# Build with Debian-based image
docker build -f Dockerfile.debian -t bot-debian .

# Update docker-compose to use the Debian image
# Change the build context in docker-compose.yml
```

## Testing the Fix

1. **Test Puppeteer locally:**
   ```bash
   node test-puppeteer.js
   ```

2. **Test in Docker:**
   ```bash
   docker build -t bot-test .
   docker run --rm bot-test node test-puppeteer.js
   ```

3. **Test with Docker Compose:**
   ```bash
   docker-compose build
   docker-compose run --rm bot node test-puppeteer.js
   ```

## Configuration Changes Made

### Dockerfile Updates
- Added `mesa-gbm` and related graphics libraries
- Set `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser`
- Created symlinks for Chrome executable names

### Docker Compose Updates
- Added `/dev/shm` volume mount for shared memory
- Added `seccomp:unconfined` security option
- Set environment variable for Chromium path

### Puppeteer Configuration Updates
- Updated browser detection to prioritize Alpine Chromium paths
- Enhanced Chrome arguments for better Docker compatibility
- Added more robust error handling

## Alternative Solutions

### If still experiencing issues:

1. **Use the Debian Dockerfile:**
   ```bash
   cp Dockerfile.debian Dockerfile
   docker-compose build
   ```

2. **Disable GPU acceleration completely:**
   Add these flags to Puppeteer options:
   ```javascript
   '--disable-gpu',
   '--disable-dev-shm-usage',
   '--disable-software-rasterizer',
   '--no-sandbox'
   ```

3. **Increase shared memory:**
   ```yaml
   # In docker-compose.yml
   shm_size: '2gb'
   ```

4. **Use host networking (for testing only):**
   ```yaml
   # In docker-compose.yml
   network_mode: host
   ```

## Verification Commands

```bash
# Check if chromium is installed
docker run --rm bot-test which chromium-browser

# Check libraries
docker run --rm bot-test ldd /usr/bin/chromium-browser | grep gbm

# Test basic Chrome launch
docker run --rm bot-test chromium-browser --version

# Test Puppeteer configuration
docker run --rm bot-test node -e "console.log(require('./src/config').getPuppeteerOptions())"
```

## Environment Variables

The following environment variables affect Puppeteer behavior:

- `PUPPETEER_EXECUTABLE_PATH` - Path to Chrome/Chromium executable
- `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` - Skip downloading Chromium
- `NODE_ENV` - Affects headless mode and arguments
- `DISPLAY` - X11 display (if using GUI mode)

## Next Steps

1. Rebuild the Docker image: `docker-compose build`
2. Test with: `docker-compose run --rm bot node test-puppeteer.js`
3. If successful, start the application: `docker-compose up`

If you continue to experience issues, consider using the Debian-based image or running the application directly on the host system for development.
