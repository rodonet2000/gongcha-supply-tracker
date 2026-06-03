FROM node:20

WORKDIR /app

# Instalar dependencias del sistema para Playwright/Chromium
RUN apt-get update -qq && apt-get install -y -qq \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libpango-1.0-0 libasound2 libx11-6 \
    fonts-liberation ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Dependencias Node.js (sin playwright browser para no sobrecargar)
COPY package*.json ./
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci --legacy-peer-deps

# Instalar Chromium por separado (más controlado)
RUN npx playwright install chromium 2>/dev/null || true

# Build de la app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=1024"
RUN npm run build

# Runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000
CMD ["npm", "start"]
