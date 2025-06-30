#!/bin/bash

# Ensure required directories exist
mkdir -p data
mkdir -p user_data
mkdir -p logs

# Set proper permissions
chmod 755 data user_data logs

echo "✅ Directory structure initialized"
echo "🚀 Starting application..."

# Start the application
npm start
