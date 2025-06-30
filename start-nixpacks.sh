#!/bin/bash

# Production startup script for Nixpacks deployment
echo "🚀 Starting application in production environment..."

# Ensure required directories exist
mkdir -p data
mkdir -p user_data
mkdir -p logs

# Set proper permissions
chmod 755 data user_data logs

# Set up environment variables for headless Chrome
export NODE_ENV=production
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
export PUPPETEER_EXECUTABLE_PATH=chromium

# Check if chromium is available
if command -v chromium >/dev/null 2>&1; then
    echo "✅ Chromium found: $(which chromium)"
    export CHROME_BIN=$(which chromium)
else
    echo "⚠️  Chromium not found in PATH, checking alternatives..."
    if command -v google-chrome >/dev/null 2>&1; then
        echo "✅ Google Chrome found: $(which google-chrome)"
        export CHROME_BIN=$(which google-chrome)
        export PUPPETEER_EXECUTABLE_PATH=$(which google-chrome)
    else
        echo "❌ No Chrome/Chromium found, Puppeteer will use bundled version"
    fi
fi

# Check if we're in a containerized environment without display
if [ -z "$DISPLAY" ]; then
    echo "🖥️  No display found, starting virtual framebuffer..."
    
    # Try to start D-Bus if available (suppress errors if not)
    if command -v dbus-daemon >/dev/null 2>&1; then
        echo "🔌 Starting D-Bus..."
        mkdir -p /tmp/dbus
        dbus-daemon --system --fork --print-pid > /tmp/dbus/dbus.pid 2>/dev/null || echo "⚠️  D-Bus not available (normal in some containers)"
    fi
    
    # Start with xvfb-run if available, otherwise rely on headless mode
    if command -v xvfb-run >/dev/null 2>&1; then
        echo "✅ Starting with virtual display (Xvfb)..."
        exec xvfb-run -a -s '-screen 0 1024x768x24 -dpi 96' npm start
    else
        echo "⚠️  Xvfb not available, relying on headless mode..."
        npm start
    fi
else
    echo "✅ Display available: $DISPLAY"
    npm start
fi
