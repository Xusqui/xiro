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

- Un servidor **Linux** con **Docker** y **Docker Compose**
- Un **dominio** que apunte al servidor (a Xiro! hay que entrar por `https://`)
- Puertos **80** y **443** abiertos

### Paso 1 — Preparar la carpeta

Copia `docker-compose.deploy.yml` (renombrado a `docker-compose.yml`) y `.env.example` (renombrado a `.env`) de este repositorio a una carpeta nueva:

```bash
mkdir -p /opt/xiro && cd /opt/xiro
cp /ruta/al/repo/docker-compose.deploy.yml docker-compose.yml
cp /ruta/al/repo/.env.example .env

mkdir -p public/uploads public/images/personalizations logs config backups
echo '{}' > config/ui-overrides.json
echo '{}' > config/runtime-overrides.json
echo '{}' > config/groq-key.json
sudo chown -R 1001:1001 public logs config
```

### Paso 2 — Poner tu dominio

En `docker-compose.yml`, servicio `caddy`, sustituye `xiro.pro` por tu dominio:

```yaml
    command: caddy reverse-proxy --from https://quiz.example.com --to http://backend:3000
```

### Paso 3 — Editar `.env`

| Variable | Valor |
|----------|-------|
| `DB_PASSWORD`, `REDIS_PASSWORD` | Contraseñas aleatorias, sin espacios |
| `JWT_SECRET` | Cadena aleatoria de al menos 32 caracteres |
| `CORS_ORIGIN`, `ALLOWED_ORIGINS` | Tu URL pública, p. ej. `https://quiz.example.com` |
| `SERVER_HOST` | Tu dominio sin `https://`, p. ej. `quiz.example.com` |

Deja el resto como está. Puedes generar valores aleatorios con `openssl rand -hex 32`.

### Paso 4 — Arrancar

```bash
docker compose up -d
docker compose ps     # todos los contenedores "Up"; db y redis "healthy"
```

### Paso 5 — Crear la cuenta de administrador

Abre `https://<tu-dominio>/admin.html`. **La primera cuenta que registres será admin.** Las siguientes son editores y requieren confirmación por email.

### Actualizar

```bash
cd /opt/xiro
docker compose pull
docker compose up -d
```

Los datos viven en las subcarpetas (`postgres_data/`, `redis_data/`, `public/`, `config/`, `backups/`), así que actualizar no los borra.

> **Si algo falla:** si falta alguno de los ficheros JSON del paso 1, Docker crea un **directorio** con ese nombre y la app no arranca. Para los servicios, borra ese directorio, crea el fichero y vuelve a arrancar.

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

La app solo escucha en `127.0.0.1:3000`. Apunta ahí tu proxy inverso HTTPS con soporte de **WebSocket**. Ejemplo para Nginx:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

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
- **Generador de preguntas con IA** (Groq) a partir de un documento o un tema
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
- Generar preguntas con **IA** (introduce la API key de Groq en la sección Config)
- Ajustar parámetros de juego, puntuación, fuegos artificiales, interfaz y backups sin reiniciar
- Consultar el **historial de partidas** y descargar resultados
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

La documentación técnica para desarrolladores está en [`docs/`](docs/): [arquitectura](docs/ARCHITECTURE.md), [CQRS](docs/CQRS_PATTERN.md), [eventos](docs/EVENT_DRIVEN_PATTERN.md), [generador IA](docs/GROQ_SETUP.md) y [estilos CSS](docs/CSS_GUIDE.md). Todas las variables de entorno están documentadas en [`.env.example`](.env.example).

---

<div align="center">
  <img src="https://xiro.pro/images/chamaleon/thumbs_up.svg" alt="mascota thumbs up" width="80">
  <br><br>
  <em>XIRO! © Familia Fernández Villatoro</em>
</div>
