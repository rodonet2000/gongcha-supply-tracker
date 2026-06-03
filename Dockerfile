FROM node:20-slim

WORKDIR /app

# Instalar dependencias del sistema para Playwright/Chromium
RUN apt-get update && apt-get install -y \
    wget gnupg ca-certificates \
    libglib2.0-0 libnss3 libnspr4 libdbus-1-3 \
    libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
    libasound2 libatspi2.0-0 libx11-6 libxcb1 libxext6 \
    fonts-liberation fonts-noto-color-emoji \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias de la app
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Instalar Chromium para Playwright (sin las dependencias del sistema, ya las tenemos)
RUN npx playwright install chromium

# Copiar código y compilar
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Configuración de producción
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000
CMD ["npm", "start"]
