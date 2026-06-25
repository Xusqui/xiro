FROM node:20-alpine

# Instalar Chromium y dependencias necesarias para Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-emoji

# Configurar variables de entorno para Puppeteer
# PUPPETEER_SKIP_DOWNLOAD es el nombre correcto desde puppeteer v20+
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Actualizar npm e instalar PM2 globalmente (solo una vez durante build)
RUN npm install -g npm@latest && \
    npm install -g pm2

# Establecer directorio de trabajo
WORKDIR /usr/src/app

# Copiar package.json y package-lock.json
COPY app/package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar el código fuente
COPY app/ ./

# Usuario no-root: PM2 redirigido a /tmp para evitar escribir en /root
RUN addgroup -g 1001 -S xiro && \
    adduser -u 1001 -S xiro -G xiro && \
    chown -R xiro:xiro /usr/src/app

ENV PM2_HOME=/tmp/.pm2

USER xiro

# Exponer el puerto
EXPOSE 3000

# Iniciar la aplicación
CMD ["sh", "-c", "pm2-runtime start ecosystem.config.js --env ${NODE_ENV:-production}"]
