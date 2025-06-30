#!/bin/bash

echo "🔍 Setting up browser environment..."

# Try to find chromium executable
if command -v chromium >/dev/null 2>&1; then
    export PUPPETEER_EXECUTABLE_PATH=$(which chromium)
    echo "✅ Found chromium at: $PUPPETEER_EXECUTABLE_PATH"
elif command -v chromium-browser >/dev/null 2>&1; then
    export PUPPETEER_EXECUTABLE_PATH=$(which chromium-browser)
    echo "✅ Found chromium-browser at: $PUPPETEER_EXECUTABLE_PATH"
elif command -v google-chrome >/dev/null 2>&1; then
    export PUPPETEER_EXECUTABLE_PATH=$(which google-chrome)
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

echo "🚀 Starting application..."
exec node src/app.js
