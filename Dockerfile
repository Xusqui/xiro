FROM node:20-alpine

# Crear usuario no-root al principio
RUN addgroup -g 1001 -S xiro && \
    adduser -u 1001 -S xiro -G xiro

# Actualizar npm e instalar PM2 globalmente (requiere root)
RUN npm install -g npm@latest && \
    npm install -g pm2 && \
    npm cache clean --force

# Establecer directorio de trabajo y darle permisos al usuario xiro
WORKDIR /usr/src/app
RUN chown -R xiro:xiro /usr/src/app

# Cambiar al usuario xiro antes de instalar dependencias
USER xiro

# Copiar package.json y package-lock.json como usuario xiro
COPY --chown=xiro:xiro app/package*.json ./

# Instalar dependencias (se instalan directamente con permisos de xiro en una sola capa)
RUN npm ci --only=production && \
    npm cache clean --force

# Copiar el código fuente como usuario xiro
COPY --chown=xiro:xiro app/ ./

ENV PM2_HOME=/tmp/.pm2

# Exponer el puerto
EXPOSE 3000

# Iniciar la aplicación
CMD ["sh", "-c", "pm2-runtime start ecosystem.config.js --env ${NODE_ENV:-production}"]
