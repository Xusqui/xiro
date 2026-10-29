<div align="center">

  <img src="https://xiro.pro/images/banner-readme.svg" alt="XIRO! — Juego de preguntas en tiempo real" width="100%">

  <br>

  <img src="https://xiro.pro/images/chamaleon/chamaleon.svg" alt="Mascota Xiro" width="130">

  <br>

  <img src="https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/PostgreSQL-15-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Redis-8-DC382D?style=flat-square&logo=redis&logoColor=white" alt="Redis">
  <img src="https://img.shields.io/badge/Socket.IO-4-010101?style=flat-square&logo=socketdotio&logoColor=white" alt="Socket.IO">
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker">

  <br>

  > Plataforma self-hosted para partidas de preguntas en tiempo real · 7 tipos de pregunta · 4 modos de juego

  <br>

  <a href="https://xiro.pro">
    <img src="https://img.shields.io/badge/%F0%9F%8E%AE_%20PRU%C3%89BAME_EN_XIRO.PRO_%F0%9F%8E%AE-8AB817?style=for-the-badge&labelColor=8AB817&logoColor=white" alt="Pruébame en xiro.pro" height="55">
  </a>

  <sub>👆 <strong>Demo en vivo</strong> — ¡entra y juega ahora!</sub>

  <br><br>

  **[🚀 Instalación](#-instalación)** · [Características](#características) · [Tipos de pregunta](#tipos-de-pregunta) · [Modos de juego](#modos-de-juego) · [Administración](#administración) · [Copias de seguridad](#copias-de-seguridad)

</div>

> 📖 [Read in English](README.md)

---

## 🚀 Instalación

<img src="https://xiro.pro/images/chamaleon/worker.svg" alt="mascota trabajando" width="100" align="right">

### Requisitos

- Un servidor **Linux** o un **NAS** con **Docker** y **Docker Compose**
- Un **dominio** que apunte a él (a Xiro! hay que entrar por `https://`)

### ¿Qué instalación elijo?

| | **A. Servidor público con Caddy** | **B. Tu propio proxy inverso** |
|---|---|---|
| Para | Un VPS o servidor sin nada delante | Un NAS (Synology, QNAP…), un servidor de casa u oficina, o un servidor que ya tiene nginx o Nginx Proxy Manager |
| Plantilla | `docker-compose.deploy.yml` | `docker-compose.deploy.nas.yml` |
| HTTPS | El contenedor `caddy` consigue el certificado él solo | Tu proxy sirve HTTPS y reenvía a `127.0.0.1:3000` |
| Puertos | **80** y **443** libres y abiertos | Solo los que ya usa tu proxy |

Las dos usan las mismas imágenes y se actualizan igual. Para construir tú las imágenes, mira [instalar desde el código fuente](#instalar-desde-el-codigo-fuente) al final.

### Paso 1 — Preparar la carpeta

Copia tu plantilla (renombrada a `docker-compose.yml`) y `.env.example` (renombrado a `.env`) de este repositorio a una carpeta nueva:

```bash
mkdir -p /opt/xiro && cd /opt/xiro
cp /ruta/al/repo/docker-compose.deploy.yml docker-compose.yml          # A. con Caddy
# cp /ruta/al/repo/docker-compose.deploy.nas.yml docker-compose.yml  # B. tu propio proxy
cp /ruta/al/repo/.env.example .env

mkdir -p public/uploads public/images/personalizations logs config backups
echo '{}' > config/ui-overrides.json
echo '{}' > config/runtime-overrides.json
echo '{}' > config/groq-key.json

sudo chown -R 1001:1001 public logs config
sudo chown 1001:1001 config/*
```

En un NAS, usa una carpeta de un volumen de datos, p. ej. `/volume1/docker/xiro` (Synology) o `/share/Container/xiro` (QNAP), y ejecuta estos comandos por SSH.

### Paso 2A — Poner tu dominio en Caddy

*Solo instalación A.* En `docker-compose.yml`, servicio `caddy`, sustituye `xiro.pro` por tu dominio:

```yaml
    command: caddy reverse-proxy --from https://quiz.example.com --to http://backend:3000
```

### Paso 2B — Configurar tu proxy inverso

*Solo instalación B.* El backend escucha en `127.0.0.1:3000` (el puerto se cambia con `APP_PORT` en `.env`). Crea en tu proxy una entrada para tu dominio que:

- sirva **HTTPS** con un certificado válido (p. ej. Let's Encrypt);
- reenvíe a `http://127.0.0.1:3000`;
- deje pasar **WebSocket** (cabeceras `Upgrade` y `Connection`). Sin esto, los jugadores no pueden unirse;
- envíe `X-Forwarded-For` y `X-Forwarded-Proto`.

Si el proxy está en otra máquina, o en un contenedor que no llega al `127.0.0.1` del host (por ejemplo, Nginx Proxy Manager en Docker), añade `APP_BIND=0.0.0.0` (o la IP de la LAN) al `.env`. No abras nunca el puerto 3000 en el router: solo el 80 y el 443 del proxy.

<details>
<summary><strong>Synology DSM 7</strong></summary>

<br>

DSM ya usa los puertos 80 y 443; por eso aquí no hace falta Caddy.

1. **Arrancar Xiro!** Haz el paso 1 en `/volume1/docker/xiro` por SSH con la plantilla **B**, rellena el `.env` (paso 3) y arranca, con `sudo docker compose up -d` en esa carpeta o desde **Container Manager → Proyecto → Crear**: ruta `/volume1/docker/xiro`, origen *Usar el docker-compose.yml existente*.
2. **Certificado.** **Panel de control → Seguridad → Certificado → Añadir → Añadir un certificado nuevo → Obtener un certificado de Let's Encrypt**, con tu dominio.
3. **Proxy inverso.** **Panel de control → Portal de inicio de sesión → Avanzado → Proxy inverso → Crear**:
   - **Origen:** protocolo `HTTPS`, nombre de host `quiz.example.com`, puerto `443`, *Habilitar HSTS*.
   - **Destino:** protocolo `HTTP`, nombre de host `localhost`, puerto `3000`.
   - Pestaña **Encabezado personalizado** → **Crear → WebSocket** (añade `Upgrade` y `Connection`).
4. **Asignar el certificado.** **Panel de control → Seguridad → Certificado → Configuración**: elige el certificado nuevo para la entrada `quiz.example.com`.
5. **Router.** Redirige los puertos 80 y 443 al NAS (el 80 solo hace falta para renovar Let's Encrypt).

</details>

<details>
<summary><strong>QNAP (QTS 5 / QuTS hero)</strong></summary>

<br>

1. **Arrancar Xiro!** Haz el paso 1 en `/share/Container/xiro` por SSH con la plantilla **B**, rellena el `.env` y arranca con `docker compose up -d` en esa carpeta. Una aplicación de Container Station creada pegando el YAML no ve el `.env` ni las carpetas del paso 1.
2. **Certificado.** **Panel de control → Seguridad → Certificado SSL y clave privada → Reemplazar certificado → Obtener de Let's Encrypt**, con tu dominio.
3. **Proxy inverso.** **Panel de control → Red y servicios de archivos → Acceso de red → Proxy inverso → Añadir**: origen `HTTPS`, tu dominio, puerto `443`; destino `HTTP`, `localhost`, puerto `3000`.
4. **Router.** Redirige los puertos 80 y 443 al NAS.

Si los jugadores se quedan en «conectando», el proxy de QTS no está dejando pasar WebSocket: usa Nginx Proxy Manager (siguiente ejemplo).

</details>

<details>
<summary><strong>Nginx Proxy Manager</strong> (Unraid, OpenMediaVault, cualquier servidor)</summary>

<br>

1. En `.env`, añade `APP_BIND=0.0.0.0` (NPM va en su propio contenedor, donde `127.0.0.1` es el propio NPM) y ejecuta `docker compose up -d`.
2. **Proxy Hosts → Add Proxy Host:**
   - **Details:** dominio `quiz.example.com`, scheme `http`, forward hostname/IP la IP de la LAN del servidor, puerto `3000`, y activa **Websockets Support**.
   - **SSL:** *Request a new SSL Certificate*, **Force SSL** y **HTTP/2 Support**.
3. **Router.** Redirige los puertos 80 y 443 a NPM, nunca el 3000.

</details>

<details>
<summary><strong>Nginx</strong></summary>

<br>

```nginx
server {
    listen 443 ssl;
    http2 on;
    server_name quiz.example.com;

    ssl_certificate     /etc/letsencrypt/live/quiz.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/quiz.example.com/privkey.pem;

    client_max_body_size 30m;  # subida de imágenes y diapositivas

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;  # la generación con IA puede tardar
    }
}
```

</details>

### Paso 3 — Editar `.env`

| Variable | Valor |
|----------|-------|
| `DB_PASSWORD`, `REDIS_PASSWORD` | Contraseñas aleatorias, sin espacios |
| `JWT_SECRET` | Cadena aleatoria de al menos 32 caracteres |
| `UPDATER_TOKEN` | Otra cadena aleatoria de al menos 32 caracteres (activa el botón **Actualizar** del panel) |
| `CORS_ORIGIN`, `ALLOWED_ORIGINS` | Tu URL pública, p. ej. `https://quiz.example.com` |
| `SERVER_HOST` | Tu dominio sin `https://`, p. ej. `quiz.example.com` |

Deja el resto como está. Puedes generar valores aleatorios con `openssl rand -hex 32`.

### Paso 4 — Arrancar

```bash
docker compose up -d
docker compose ps     # todos los contenedores "Up"; db y redis "healthy"
```

En la instalación B, comprueba primero el backend con `curl -I http://127.0.0.1:3000/ready` (debe responder `200`) y después abre `https://<tu-dominio>`.

### Paso 5 — Crear la cuenta de administrador

Abre `https://<tu-dominio>/admin.html`. **La primera cuenta que registres será admin.** Las siguientes son editores y requieren confirmación por email.

### Actualizar

**Desde el panel de administración (recomendado).** Xiro! consulta Docker Hub una vez por hora. Cuando sale una versión nueva, aparece el aviso **Nueva versión** en la barra lateral del panel. En **Config → Actualizaciones**, **Actualizar ahora** hace una copia de la base de datos, descarga las imágenes nuevas, reinicia `backend` y `backup` y comprueba que la versión nueva arranca; si no arranca, vuelve sola a la anterior. Las partidas en curso se cortan, así que el panel avisa antes.

El botón lo atiende el contenedor `updater`. Tiene acceso al socket de Docker (puede gestionar los contenedores del servidor), por eso no publica ningún puerto y solo acepta peticiones del backend firmadas con `UPDATER_TOKEN`.

**A mano:**

```bash
cd /opt/xiro
docker compose pull
docker compose up -d
```

Los datos viven en las subcarpetas (`postgres_data/`, `redis_data/`, `public/`, `config/`, `backups/`), así que actualizar no los borra.

`docker compose pull` actualiza las imágenes, no `docker-compose.yml`. Cuando una versión cambie tu plantilla (`docker-compose.deploy.yml` o `docker-compose.deploy.nas.yml`), vuelve a copiarla encima de tu `docker-compose.yml` (en A, pon otra vez tu dominio en el servicio `caddy`, paso 2A) antes de `docker compose up -d`.

**Pasar de A a B** (p. ej. pones el servidor detrás de tu propio proxy): ejecuta `docker compose down`, copia `docker-compose.deploy.nas.yml` encima de `docker-compose.yml`, configura el proxy (paso 2B) y ejecuta `docker compose up -d`. Los datos siguen en las subcarpetas.

**¿Instalaste Xiro! antes de que existiera el botón?** Copia tu plantilla actual encima de tu `docker-compose.yml` (en A, vuelve a poner tu dominio, paso 2A), añade `UPDATER_TOKEN=<openssl rand -hex 32>` al `.env` y ejecuta `docker compose pull && docker compose up -d`. A partir de ahí, las actualizaciones se instalan desde el panel.

> **La exportación a PDF falla con "Error al generar el PDF":** el backend no llega al contenedor `chrome`. Comprueba que `docker compose exec backend printenv CHROME_WS_ENDPOINT` devuelve `ws://chrome:3000` y que el contenedor `xiro_chrome` está en marcha. Si sale vacío, vuelve a copiar tu plantilla actual (ya fija esta variable) o añade `CHROME_WS_ENDPOINT=ws://chrome:3000` a `.env`, y ejecuta `docker compose up -d`.

> **Si algo falla:** si falta alguno de los ficheros JSON del paso 1, Docker crea un **directorio** con ese nombre y la app no arranca. Para los servicios, borra ese directorio, crea el fichero y vuelve a arrancar.

<a id="instalar-desde-el-codigo-fuente"></a>

<details>
<summary><strong>Alternativa: instalar desde el código fuente</strong> (imágenes construidas en local, proxy inverso propio)</summary>

<br>

```bash
git clone https://github.com/Xusqui/xiro.git && cd xiro
cp .env.example .env
```

En `.env`, pon las mismas variables de arriba y además `XIRO_ROOT` (ruta absoluta del repositorio, lo que devuelve `pwd`) y `DB_PORT=5439`.

```bash
mkdir -p logs backups
for f in app/config/ui-overrides.json app/config/runtime-overrides.json app/ai-generator/groq-key.json; do
  [ -f "$f" ] || echo '{}' > "$f"
done
sudo chown -R 1001:1001 logs app/public/uploads app/public/images/personalizations \
  app/config/ui-overrides.json app/config/runtime-overrides.json \
  app/config/instance-id.json app/ai-generator/groq-key.json

docker compose up -d --build
```

La app solo escucha en `127.0.0.1:3000`. Configura tu proxy inverso como en el [paso 2B](#paso-2b--configurar-tu-proxy-inverso).

Gestión con `./manage.sh start | stop | restart | status | logs | backup | restore | update | health`. Para actualizar: `git pull && ./manage.sh update`.

</details>

<br clear="right">

---

## Características

<img src="https://xiro.pro/images/chamaleon/party.svg" alt="mascota de fiesta" width="110" align="right">

- Juego en **tiempo real**: los jugadores entran desde el móvil con un código QR o PIN
- **7 tipos de pregunta** y **4 modos de juego**, incluido un tablero estilo Trivial Pursuit
- **Modo por equipos** con revelado de respuestas sincronizado
- **Rachas configurables** con bonificaciones progresivas
- **Reconexión transparente** para jugadores y presentadores
- **Generador de preguntas con IA** (Groq o Gemini) a partir de un documento o un tema
- **Exportación a PDF** de juegos personalizados e **importación/exportación JSON** de bancos
- **Control remoto del presentador** desde el móvil
- **Historial de partidas** con exportación CSV/JSON y visor gráfico de resultados
- **Modo solitario** (`standalone.html`) para practicar sin presentador
- Interfaz en **10 idiomas**
- **Self-hosted** con Docker Compose

---

## Tipos de pregunta

<img src="https://xiro.pro/images/chamaleon/thinking.svg" alt="mascota pensando" width="100" align="right">

| Tipo | Descripción | Puntuación |
|------|-------------|------------|
| `quiz` | 2–6 opciones, una correcta | Base + bonus por rapidez |
| `survey` | Encuesta, sin respuesta correcta | No puntúa |
| `multiple_choice` | Varias respuestas correctas | Puntos por acierto, penalización por fallo, bonus si es perfecta |
| `order` | Ordenar una lista | Puntos por posición correcta |
| `numeric_approximation` | Escribir un número | Por cercanía (tolerancia exacta, %, absoluta o relativa) |
| `word_scramble` | Formar la palabra oculta con letras desordenadas | Base + bonus por rapidez |
| `matching` | Emparejar elementos de dos columnas | Puntos por pareja correcta |

---

## Modos de juego

<img src="https://xiro.pro/images/chamaleon/gaming.svg" alt="mascota jugando" width="110" align="right">

- **Banco de preguntas** — preguntas aleatorias de uno o varios bancos.
- **Mezcla de preguntas** — eliges cuántas preguntas aleatorias sacar de cada banco.
- **Juego personalizado** — preguntas elegidas una a una y en tu orden, con diapositivas de texto, imagen y actividad. Exportable a PDF.
- **Trivial** — tablero con categorías, dado, quesitos y casillas sede. Todos responden cada pregunta; gana el primero que consiga todos los quesitos.

Todos los modos admiten **juego por equipos**.

---

## Vistas

| Página | Quién la usa |
|--------|--------------|
| `/` | Selector de rol |
| `/jugador.html` | Jugadores (móvil) |
| `/presentador.html` | Presentador: sala de espera, QR, temporizador, revelado, podio |
| `/tv.html` | Pantallas grandes y televisores antiguos |
| `/standalone.html` | Jugar solo, sin presentador |
| `/admin.html` | Panel de administración |

---

## Administración

<img src="https://xiro.pro/images/chamaleon/albanil.svg" alt="mascota albañil" width="100" align="right">

Dos roles: **admin** (acceso total) y **editor** (solo edita lo que ha creado).

Desde `/admin.html` puedes:

- Crear y editar **bancos de preguntas**, **mezclas**, **juegos personalizados** y tableros de **Trivial**
- Generar preguntas con **IA** (introduce la API key de Groq o de Gemini, y elige el proveedor activo, en la sección Config)
- Ajustar parámetros de juego, puntuación, fuegos artificiales, interfaz y backups sin reiniciar
- Consultar el **historial de partidas** y descargar resultados
- **Actualizar** Xiro! con un clic cuando se publica una versión nueva (**Config → Actualizaciones**)
- Controlar una partida en curso desde el móvil (**Config → Juegos en Curso → Controlar**)
- Gestionar la **licencia** (Config → Licencia). Sin licencia válida, las partidas se limitan a 5 participantes.

---

## Copias de seguridad

<img src="https://xiro.pro/images/chamaleon/pirata.svg" alt="mascota pirata" width="100" align="right">

El contenedor `xiro_backup` guarda cada día (2:00 AM) una copia de la base de datos en `backups/` y conserva 7 días. La programación y la retención se cambian desde **Admin → Config → Backup**.

```bash
# Hacer un backup ahora
docker exec xiro_backup sh /scripts/docker-backup-run.sh

# Restaurar (sustituye toda la base de datos; usa DB_USER/DB_NAME de tu .env si los cambiaste)
docker compose stop backend
docker exec xiro_postgres psql -U postgres -d postgres \
  -c 'DROP DATABASE IF EXISTS xiro_db WITH (FORCE);' -c 'CREATE DATABASE xiro_db;'
gunzip -c backups/<fichero>.sql.gz \
  | docker exec -i xiro_postgres psql -U postgres -d xiro_db -v ON_ERROR_STOP=1 -q
docker compose start backend
```

Si instalaste desde el código fuente: `./manage.sh backup` y `./manage.sh restore backups/<fichero>.sql.gz`.

---

## Privacidad

En el primer arranque, Xiro! envía **un único ping anónimo** a [ntfy.sh](https://ntfy.sh) con el texto "Xiro! instalado" y el número de versión, para que el autor sepa cuántas instalaciones hay. Sin datos personales, sin identificadores, sin cookies y sin ninguna otra telemetría. Se desactiva con `XIRO_TELEMETRY=false` en `.env`.

---

## Documentación

La documentación técnica para desarrolladores está en [`docs/`](docs/): [arquitectura](docs/ARCHITECTURE.md), [CQRS](docs/CQRS_PATTERN.md), [eventos](docs/EVENT_DRIVEN_PATTERN.md), [generador IA](docs/AI_SETUP.md) y [estilos CSS](docs/CSS_GUIDE.md). Todas las variables de entorno están documentadas en [`.env.example`](.env.example).

---

<div align="center">
  <img src="https://xiro.pro/images/chamaleon/thumbs_up.svg" alt="mascota thumbs up" width="80">
  <br><br>
  <em>XIRO! © Familia Fernández Villatoro</em>
</div>
