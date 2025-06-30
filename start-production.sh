#!/bin/bash

echo "🔍 Setting up browser environment..."

# Set environment variables for production
export NODE_ENV=production
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Try to find chromium executable
if command -v chromium >/dev/null 2>&1; then
    export PUPPETEER_EXECUTABLE_PATH=$(which chromium)
    export CHROME_BIN=$(which chromium)
    echo "✅ Found chromium at: $PUPPETEER_EXECUTABLE_PATH"
elif command -v chromium-browser >/dev/null 2>&1; then
    export PUPPETEER_EXECUTABLE_PATH=$(which chromium-browser)
    export CHROME_BIN=$(which chromium-browser)
    echo "✅ Found chromium-browser at: $PUPPETEER_EXECUTABLE_PATH"
elif command -v google-chrome >/dev/null 2>&1; then
    export PUPPETEER_EXECUTABLE_PATH=$(which google-chrome)
    export CHROME_BIN=$(which google-chrome)
    echo "✅ Found google-chrome at: $PUPPETEER_EXECUTABLE_PATH"
else
    echo "⚠️  No system browser found, will use Puppeteer's bundled Chromium"
    unset PUPPETEER_EXECUTABLE_PATH
fi

# Ensure required directories exist
mkdir -p data
mkdir -p user_data
mkdir -p logs

# Set proper permissions
chmod 755 data user_data logs

# Check if we're in a containerized environment without display
if [ -z "$DISPLAY" ]; then
    echo "🖥️  No display found, setting up virtual environment..."
    
    # Try to start D-Bus if available (suppress errors if not)
    if command -v dbus-daemon >/dev/null 2>&1; then
        echo "� Starting D-Bus..."
        mkdir -p /tmp/dbus
        dbus-daemon --system --fork --print-pid > /tmp/dbus/dbus.pid 2>/dev/null || echo "⚠️  D-Bus not available (normal in some containers)"
    fi
    
    # Start with xvfb-run if available
    if command -v xvfb-run >/dev/null 2>&1; then
        echo "✅ Starting with virtual display (Xvfb)..."
        exec xvfb-run -a -s '-screen 0 1024x768x24 -dpi 96' node src/app.js
    else
        echo "⚠️  Xvfb not available, relying on headless mode..."
        exec node src/app.js
    fi
else
    echo "✅ Display available: $DISPLAY"
    exec node src/app.js
fi
