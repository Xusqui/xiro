FROM node:20-alpine



# Actualizar npm e instalar PM2 globalmente (solo una vez durante build)
RUN npm install -g npm@latest && \
    npm install -g pm2 && \
    npm cache clean --force

# Establecer directorio de trabajo
WORKDIR /usr/src/app

# Copiar package.json y package-lock.json
COPY app/package*.json ./

# Instalar dependencias
RUN npm ci --only=production && \
    npm cache clean --force

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
