FROM node:20-slim

# Install dependencies for browser automation
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    curl \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc-s1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Install Chrome/Chromium based on architecture
RUN ARCH=$(dpkg --print-architecture) && \
    if [ "$ARCH" = "amd64" ]; then \
        # Check if Google Chrome is already installed
        if ! command -v google-chrome-stable >/dev/null 2>&1; then \
            wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - && \
            echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list && \
            apt-get update && \
            apt-get install -y google-chrome-stable && \
            rm -rf /var/lib/apt/lists/*; \
        else \
            echo "Google Chrome is already installed"; \
        fi \
    else \
        # Check if Chromium is already installed
        if ! command -v chromium >/dev/null 2>&1; then \
            apt-get update && \
            apt-get install -y chromium chromium-sandbox && \
            rm -rf /var/lib/apt/lists/*; \
        else \
            echo "Chromium is already installed"; \
        fi \
    fi

# Verify browser installation and show version
RUN if command -v google-chrome-stable >/dev/null 2>&1; then \
        echo "Browser installed: Google Chrome" && \
        google-chrome-stable --version; \
    elif command -v chromium >/dev/null 2>&1; then \
        echo "Browser installed: Chromium" && \
        chromium --version; \
    else \
        echo "Error: No browser found!" && exit 1; \
    fi

# Create app user for security
RUN groupadd --gid 1001 --system nodejs \
    && useradd --uid 1001 --system --gid nodejs --shell /bin/bash --create-home nodejs

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production --silent && npm cache clean --force

# Copy application code (excluding .env for security)
COPY --chown=nodejs:nodejs . .

# Create data directory with proper permissions
RUN mkdir -p data && chown -R nodejs:nodejs /app

# Set production environment variables (browser path will be auto-detected by the app)
ENV NODE_ENV=production \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_HEADLESS=true \
    PUPPETEER_TIMEOUT=30000


# Switch to non-root user
USER nodejs

# Expose the web interface port
EXPOSE 3000

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/status || exit 1

# Start the application
CMD ["node", "src/index.js"]
