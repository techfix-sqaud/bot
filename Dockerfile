# Multi-stage build for faster builds and smaller images
FROM node:18-alpine AS base

# Install chromium and required dependencies in Alpine
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    # Additional dependencies for graphics and shared libraries
    mesa-gbm \
    mesa-dri-gallium \
    udev \
    ttf-liberation \
    # X11 and graphics libraries available in Alpine
    libx11 \
    libxcomposite \
    libxcursor \
    libxdamage \
    libxext \
    libxfixes \
    libxi \
    libxrandr \
    libxrender \
    libxss \
    libxtst \
    # Additional libraries that might be needed
    glib \
    gtk+3.0 \
    pango \
    atk \
    cairo \
    gdk-pixbuf \
    && ln -s /usr/bin/chromium-browser /usr/bin/google-chrome-stable \
    && ln -s /usr/bin/chromium-browser /usr/bin/google-chrome

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production --silent --no-audit --no-fund && \
    npm cache clean --force

# Production stage
FROM base AS runner
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy application code (use .dockerignore to exclude unnecessary files)
COPY --chown=nodejs:nodejs src/ ./src/
COPY --chown=nodejs:nodejs package*.json ./
COPY --chown=nodejs:nodejs *.js ./
COPY --chown=nodejs:nodejs *.sql ./

# Create necessary directories
RUN mkdir -p data user_data && \
    chown -R nodejs:nodejs /app

# Set environment variables
ENV NODE_ENV=production \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('Health check passed')" || exit 1

CMD ["node", "src/app.js"]
