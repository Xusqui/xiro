# 🏠 Configuración Específica para Synology DS723+

## 📋 Checklist Previo al Lanzamiento

### 1. ✅ Configuración del Sistema
- [ ] **Container Manager** instalado y actualizado
- [ ] **Puerto 3000** abierto en el firewall de Synology
- [ ] **Reverse Proxy** configurado (si usas HTTPS)
- [ ] **Certificado SSL** instalado (recomendado para producción)

### 2. ✅ Optimización de Volúmenes
Tu proyecto está en un NVMe de 2TB, que es excelente para rendimiento. Asegúrate de:

```bash
# Verificar que postgres_data está en el NVMe
ls -la /Volumes/docker/xiro/postgres_data/

# El NVMe proporciona:
# - Baja latencia para consultas de BD
# - Alto IOPS para múltiples jugadores simultáneos
# - Mejor durabilidad que HDDs
```

### 3. ✅ Configuración de Red en Synology

#### Opción A: Bridge Network (Recomendado)
Configuración actual en `docker-compose.yml`:
```yaml
ports:
  - "3000:3000"  # Backend
  - "5435:5432"  # PostgreSQL (opcional, solo para admin)
```

#### Opción B: Host Network (Mejor rendimiento)
Para máximo rendimiento en WebSockets:
```yaml
network_mode: host
```

### 4. ✅ Configuración de Reverse Proxy en Synology

Si usas el reverse proxy de Synology para HTTPS:

**Panel de Control → Aplicación → Reverse Proxy → Crear**

```
Descripción: Xiro!
Protocolo origen: HTTP
Hostname origen: localhost
Puerto origen: 3000

Protocolo destino: HTTPS
Hostname destino: xiro.pro (o xiro.xusqui.com)
Puerto destino: 443
```

**Configuración personalizada (WebSocket support):**
```nginx
# En la pestaña "Reglas personalizadas"
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;

# Timeouts para WebSocket
proxy_connect_timeout 7d;
proxy_send_timeout 7d;
proxy_read_timeout 7d;
```

### 5. ✅ Optimización de Memoria en Synology

Con 32GB de RAM disponibles, esta es la distribución recomendada:

```
Sistema Operativo DSM:     ~2-4 GB
Otros contenedores:        ~4-6 GB
Xiro! PostgreSQL:        8 GB (límite)
Xiro! Backend:           2 GB (límite)
Cache del sistema:         ~16 GB
```

**Monitorear uso de memoria:**
```bash
# Desde SSH en Synology
free -h

# O desde Resource Monitor en DSM
```

### 6. ✅ Tareas Programadas en Synology

**Panel de Control → Programador de Tareas**

#### Tarea 1: Backup Diario
```bash
Tarea: Backup Xiro!
Horario: Diario a las 03:00
Usuario: root
Script:
cd /volume1/docker/xiro
./backup.sh
```

#### Tarea 2: Limpieza de Logs
```bash
Tarea: Limpiar logs Docker
Horario: Semanal (Domingo 04:00)
Usuario: root
Script:
docker system prune -f
find /var/log/docker -name "*.log" -type f -mtime +7 -delete
```

#### Tarea 3: Reinicio Semanal (Opcional)
```bash
Tarea: Reinicio contenedores
Horario: Semanal (Lunes 04:00)
Usuario: root
Script:
cd /volume1/docker/xiro
docker-compose restart
```

### 7. ✅ Monitoreo y Alertas

#### Configurar notificaciones en Synology
**Panel de Control → Notificación → Reglas avanzadas**

```
Regla: Uso alto de CPU
Condición: CPU > 80% por 10 minutos
Acción: Enviar email

Regla: Uso alto de memoria
Condición: Memoria > 90% por 5 minutos
Acción: Enviar email
```

### 8. ✅ Firewall en Synology

**Panel de Control → Seguridad → Firewall**

```
Crear regla:
Nombre: Xiro!
Puertos: 3000
Protocolo: TCP
Origen: Todos (o tu red específica)
Acción: Permitir
```

### 9. ✅ Configuración de HTTPS (Producción)

Dominios configurados: `xiro.pro`, `www.xiro.pro`, `test.xiro.pro`, `xiro.xusqui.com`, `test.xusqui.com`

1. **Certificado SSL:**
   - Panel de Control → Seguridad → Certificado
   - Añadir → Obtener certificado de Let's Encrypt
   - Dominios: xiro.pro, www.xiro.pro, test.xiro.pro (y opcionalmente xiro.xusqui.com, test.xusqui.com)

2. **Los dominios ya están configurados en .env:**
```javascript
CORS_ORIGIN=https://xiro.pro,https://www.xiro.pro,https://test.xiro.pro,https://test.xusqui.com,https://xiro.xusqui.com,http://localhost:3000,http://localhost
```

### 10. ✅ Scripts de Inicio Automático

Asegúrate de que los contenedores se inicien automáticamente:

```yaml
# En docker-compose.yml (ya configurado)
restart: unless-stopped
```

### 11. ✅ Monitoreo con Resource Monitor

En DSM, puedes monitorear en tiempo real:
- Resource Monitor → Performance
- Ver uso de CPU, RAM, red y disco
- Identificar picos de uso durante juegos

### 12. ✅ Configuración de UPS (Si tienes uno)

**Panel de Control → Hardware y energía → UPS**
- Configurar apagado seguro
- Tiempo de espera: 5-10 minutos
- Esto protegerá tus datos en caso de corte eléctrico

## 🔥 Optimizaciones Específicas para Producción

### A. Aumentar límites del sistema (SSH)

```bash
# Conectar por SSH a Synology
ssh admin@tu-nas-ip

# Aumentar límites de archivos abiertos
sudo nano /etc/sysctl.conf

# Añadir:
fs.file-max = 100000
net.core.somaxconn = 1024
net.ipv4.tcp_max_syn_backlog = 2048
```

### B. Optimizar Docker en Synology

```bash
# Editar configuración de Docker
sudo nano /var/packages/ContainerManager/etc/dockerd.json

# Añadir:
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2"
}

# Reiniciar Docker
sudo synoservice --restart pkgctl-Docker
```

### C. Configurar Logs Centralizados

Si tienes Log Center instalado:
```bash
# Los logs de Docker se guardarán automáticamente
# Acceder desde: Log Center → Docker
```

## 📊 Métricas de Rendimiento Esperadas

Con tu hardware (DS723+, 32GB RAM, NVMe):

```
Jugadores simultáneos: 500-1000+
Juegos concurrentes: 50-100
Latencia WebSocket: <50ms (LAN), <100ms (WAN)
Queries de BD: <10ms promedio
Uso de CPU: 10-30% en carga normal
Uso de RAM: 3-6GB en carga normal
```

## 🚨 Troubleshooting en Synology

### Problema: Contenedores no inician
```bash
# Ver logs
docker-compose logs

# Verificar permisos
ls -la /volume1/docker/xiro/postgres_data/

# Recrear contenedores
docker-compose down
docker-compose up -d
```

### Problema: Puerto 3000 no accesible
```bash
# Verificar firewall
sudo iptables -L -n | grep 3000

# Verificar que el contenedor escucha
docker exec xiro_backend netstat -tuln | grep 3000
```

### Problema: PostgreSQL lento
```bash
# Ver conexiones activas
docker exec xiro_postgres psql -U postgres -c "SELECT * FROM pg_stat_activity;"

# Revisar queries lentas
docker exec xiro_postgres psql -U postgres -c "SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

## 📱 Acceso Remoto

Si quieres acceder desde fuera de tu red:

1. **QuickConnect** (más fácil):
   - Configurar en Panel de Control → QuickConnect
   - Acceder vía: http://QuickConnect_ID:3000

2. **DDNS + Port Forwarding** (mejor rendimiento):
   - Configurar DDNS en tu router
   - Abrir puerto 3000 en router → IP del NAS
   - Acceder vía: http://tu-dominio.ddns.net:3000

3. **VPN** (más seguro):
   - Configurar VPN Server en Synology
   - Conectar por VPN y usar IP local

## ✅ Lista Final Pre-Producción

- [ ] Cambiar contraseñas por defecto
- [ ] Configurar HTTPS con certificado válido
- [ ] Configurar backup automático diario
- [ ] Probar con 10-20 usuarios simultáneos
- [ ] Configurar monitoreo y alertas
- [ ] Documentar procedimiento de rollback
- [ ] Tener plan de contingencia para caídas
- [ ] Configurar logs centralizados
- [ ] Testear reconexión de WebSockets
- [ ] Verificar que el firewall permite el tráfico

## 🎯 Comando de Despliegue Final

```bash
# Detener servicios actuales
cd /volume1/docker/xiro
docker-compose down

# Hacer backup antes del despliegue
./backup.sh

# Iniciar en modo producción
docker-compose up -d

# Verificar salud
./monitor.sh

# Ver logs en tiempo real
docker-compose logs -f
```

¡Tu Synology DS723+ con NVMe está perfectamente equipado para este proyecto! 🚀
