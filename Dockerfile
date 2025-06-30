# # Alternative Debian-based Dockerfile for better Puppeteer compatibility
# FROM node:18-slim

# # Install necessary packages for Puppeteer
# RUN apt-get update && apt-get install -y \
#     wget \
#     ca-certificates \
#     fonts-liberation \
#     libasound2 \
#     libatk-bridge2.0-0 \
#     libatk1.0-0 \
#     libc6 \
#     libcairo2 \
#     libcups2 \
#     libdbus-1-3 \
#     libexpat1 \
#     libfontconfig1 \
#     libgbm1 \
#     libgcc1 \
#     libglib2.0-0 \
#     libgtk-3-0 \
#     libnspr4 \
#     libnss3 \
#     libpango-1.0-0 \
#     libpangocairo-1.0-0 \
#     libstdc++6 \
#     libx11-6 \
#     libx11-xcb1 \
#     libxcb1 \
#     libxcomposite1 \
#     libxcursor1 \
#     libxdamage1 \
#     libxext6 \
#     libxfixes3 \
#     libxi6 \
#     libxrandr2 \
#     libxrender1 \
#     libxss1 \
#     libxtst6 \
#     lsb-release \
#     xdg-utils \
#     && rm -rf /var/lib/apt/lists/*

# # Create app user
# RUN groupadd --gid 1001 --system nodejs \
#     && useradd --uid 1001 --system --gid nodejs --shell /bin/bash --create-home nodejs

# WORKDIR /app

# # Copy package files
# COPY package*.json ./

# # Install dependencies
# RUN npm ci --only=production --silent --no-audit --no-fund && \
#     npm cache clean --force

# # Copy application code
# COPY --chown=nodejs:nodejs src/ ./src/
# COPY --chown=nodejs:nodejs *.js ./
# COPY --chown=nodejs:nodejs *.sql ./

# # Create necessary directories
# RUN mkdir -p data user_data && \
#     chown -R nodejs:nodejs /app

# # Set environment variables
# ENV NODE_ENV=production \
#     PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false

# USER nodejs

# EXPOSE 3000

# HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
#   CMD node -e "console.log('Health check passed')" || exit 1

# CMD ["node", "src/app.js"]

FROM node:18-slim

# Install Chromium and all needed libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
  chromium \
  fonts-liberation \
  libasound2 libatk-bridge2.0-0 libatk1.0-0 libcairo2 libcups2 \
  libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libglib2.0-0 \
  libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 \
  libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 \
  libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 \
  libxss1 libxtst6 xdg-utils && \
  rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production --silent && npm cache clean --force
COPY --chown=nodejs:nodejs . .

ENV NODE_ENV=production \ 
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium"

USER nodejs

EXPOSE 3000
CMD ["node", "src/app.js"]

