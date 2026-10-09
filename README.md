<div align="center">

  <img src="https://xiro.pro/images/banner-readme.svg" alt="XIRO! — Real-Time Quiz Game" width="100%">

  <br>

  <img src="https://xiro.pro/images/chamaleon/chamaleon.svg" alt="Xiro mascot" width="130">

  <br>

  <img src="https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/PostgreSQL-15-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Redis-8-DC382D?style=flat-square&logo=redis&logoColor=white" alt="Redis">
  <img src="https://img.shields.io/badge/Socket.IO-4-010101?style=flat-square&logo=socketdotio&logoColor=white" alt="Socket.IO">
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker">

  <br>

  > Self-hosted platform for real-time quiz sessions · 7 question types · 4 game modes

  <br>

  <a href="https://xiro.pro">
    <img src="https://img.shields.io/badge/%F0%9F%8E%AE_%20TRY_ME_AT_XIRO.PRO_%F0%9F%8E%AE-8AB817?style=for-the-badge&labelColor=8AB817&logoColor=white" alt="Try me at xiro.pro" height="55">
  </a>

  <sub>👆 <strong>Live demo</strong> — jump in and play now!</sub>

  <br><br>

  **[🚀 Installation](#-installation)** · [Features](#features) · [Question types](#question-types) · [Game modes](#game-modes) · [Administration](#administration) · [Backups](#backup-and-restore)

</div>

> 📖 [Leer en español](README_ES.md)

---

## 🚀 Installation

<img src="https://xiro.pro/images/chamaleon/worker.svg" alt="worker mascot" width="100" align="right">

### Requirements

- A **Linux** server with **Docker** and **Docker Compose**
- A **domain** pointing to the server (Xiro! must be accessed via `https://`)
- Ports **80** and **443** open

### Step 1 — Prepare the folder

Copy `docker-compose.deploy.yml` (renamed to `docker-compose.yml`) and `.env.example` (renamed to `.env`) from this repository into a new folder:

```bash
mkdir -p /opt/xiro && cd /opt/xiro
cp /path/to/repo/docker-compose.deploy.yml docker-compose.yml
cp /path/to/repo/.env.example .env

mkdir -p public/uploads public/images/personalizations logs config backups
echo '{}' > config/ui-overrides.json
echo '{}' > config/runtime-overrides.json
echo '{}' > config/groq-key.json

sudo chown -R 1001:1001 public logs config
sudo chown 1001:1001 config/*
```

### Step 2 — Set your domain

In `docker-compose.yml`, `caddy` service, replace `xiro.pro` with your domain:

```yaml
    command: caddy reverse-proxy --from https://quiz.example.com --to http://backend:3000
```

### Step 3 — Edit `.env`

| Variable | Value |
|----------|-------|
| `DB_PASSWORD`, `REDIS_PASSWORD` | Random passwords, no spaces |
| `JWT_SECRET` | Random string, at least 32 characters |
| `CORS_ORIGIN`, `ALLOWED_ORIGINS` | Your public URL, e.g. `https://quiz.example.com` |
| `SERVER_HOST` | Your domain without `https://`, e.g. `quiz.example.com` |

Leave the rest as it is. Generate random values with `openssl rand -hex 32`.

### Step 4 — Start

```bash
docker compose up -d
docker compose ps     # every container "Up"; db and redis "healthy"
```

### Step 5 — Create the admin account

Open `https://<your-domain>/admin.html`. **The first account you register becomes admin.** Later accounts are editors and need email confirmation.

### Updating

```bash
cd /opt/xiro
docker compose pull
docker compose up -d
```

Data lives in the folder's subdirectories (`postgres_data/`, `redis_data/`, `public/`, `config/`, `backups/`), so updates don't lose it.

`docker compose pull` updates the images, not `docker-compose.yml`. When a release changes `docker-compose.deploy.yml`, copy it again over your `docker-compose.yml` and set your domain in the `caddy` service again (step 2) before `docker compose up -d`.

> **PDF export fails with "Error al generar el PDF":** the backend can't reach the `chrome` container. Check that `docker compose exec backend printenv CHROME_WS_ENDPOINT` prints `ws://chrome:3000` and that the `xiro_chrome` container is running. If it is empty, copy the current `docker-compose.deploy.yml` again (it sets this variable) or add `CHROME_WS_ENDPOINT=ws://chrome:3000` to `.env`, then run `docker compose up -d`.

> **Troubleshooting:** if one of the JSON files from step 1 is missing, Docker creates a **directory** with that name and the app won't start. Stop the services, delete that directory, create the file and start again.

<details>
<summary><strong>Alternative: install from source</strong> (build images locally, bring your own reverse proxy)</summary>

<br>

```bash
git clone https://github.com/Xusqui/xiro.git && cd xiro
cp .env.example .env
```

In `.env`, set the same variables as above plus `XIRO_ROOT` (absolute path of the repository, output of `pwd`) and `DB_PORT=5439`.

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

The app listens only on `127.0.0.1:3000`. Point your HTTPS reverse proxy there with **WebSocket** support enabled. Nginx example:

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

Manage it with `./manage.sh start | stop | restart | status | logs | backup | restore | update | health`. To update: `git pull && ./manage.sh update`.

</details>

<br clear="right">

---

## Features

<img src="https://xiro.pro/images/chamaleon/party.svg" alt="party mascot" width="110" align="right">

- **Real-time** play: players join from their phones with a QR code or PIN
- **7 question types** and **4 game modes**, including a Trivial Pursuit-style board
- **Team mode** with synchronized answer reveal
- **Configurable streaks** with progressive bonuses
- **Transparent reconnection** for players and presenters
- **AI question generator** (Groq or Gemini) from a document or a topic
- **PDF export** of custom games and **JSON import/export** of question banks
- **Presenter remote control** from a mobile phone
- **Game history** with CSV/JSON export and a graphical results viewer
- **Solo mode** (`standalone.html`) to practice without a presenter
- **10 languages** in the interface
- **Self-hosted** with Docker Compose

---

## Question types

<img src="https://xiro.pro/images/chamaleon/thinking.svg" alt="thinking mascot" width="100" align="right">

| Type | Description | Scoring |
|------|-------------|---------|
| `quiz` | 2–6 options, one correct | Base + speed bonus |
| `survey` | Opinion poll, no correct answer | None |
| `multiple_choice` | Several correct answers | Points per hit, penalty per miss, perfect bonus |
| `order` | Put a list in the right order | Points per correct position |
| `numeric_approximation` | Enter a number | By proximity (exact, %, absolute or relative tolerance) |
| `word_scramble` | Build the hidden word from scrambled letters | Base + speed bonus |
| `matching` | Match pairs across two columns | Points per correct pair |

---

## Game modes

<img src="https://xiro.pro/images/chamaleon/gaming.svg" alt="gaming mascot" width="110" align="right">

- **Question Bank** — random questions from one or more banks.
- **Question Mix** — choose how many random questions to draw from each bank.
- **Custom Game** — hand-picked questions in your order, with text, image and activity slides. Exportable to PDF.
- **Trivial** — board with categories, die, wedges and headquarters. All players answer every question; the first to collect every wedge wins.

All modes support **team play**.

---

## Views

| Page | Who uses it |
|------|-------------|
| `/` | Role selector |
| `/jugador.html` | Players (phone) |
| `/presentador.html` | Presenter: lobby, QR, timer, reveal, podium |
| `/tv.html` | Large screens and old TVs |
| `/standalone.html` | Solo play without a presenter |
| `/admin.html` | Administration panel |

---

## Administration

<img src="https://xiro.pro/images/chamaleon/albanil.svg" alt="builder mascot" width="100" align="right">

Two roles: **admin** (full access) and **editor** (edits only what they created).

From `/admin.html` you can:

- Create and edit **question banks**, **mixes**, **custom games** and **Trivial** boards
- Generate questions with **AI** (enter the Groq or Gemini API key, and pick the active provider, in the Config section)
- Adjust game parameters, scoring, fireworks, UI and backups without restarting
- See the **game history** and download results
- Take control of a game in progress from your phone (**Config → Games In Progress → Control**)
- Manage the **license** (Config → Licencia). Without a valid license, sessions are limited to 5 participants.

---

## Backup and restore

<img src="https://xiro.pro/images/chamaleon/pirata.svg" alt="pirate mascot" width="100" align="right">

The `xiro_backup` container saves a daily database backup (2:00 AM) in `backups/` and keeps 7 days. Schedule and retention can be changed from **Admin → Config → Backup**.

```bash
# Backup now
docker exec xiro_backup sh /scripts/docker-backup-run.sh

# Restore (replaces the whole database; use DB_USER/DB_NAME from your .env if you changed them)
docker compose stop backend
docker exec xiro_postgres psql -U postgres -d postgres \
  -c 'DROP DATABASE IF EXISTS xiro_db WITH (FORCE);' -c 'CREATE DATABASE xiro_db;'
gunzip -c backups/<file>.sql.gz \
  | docker exec -i xiro_postgres psql -U postgres -d xiro_db -v ON_ERROR_STOP=1 -q
docker compose start backend
```

When installed from source: `./manage.sh backup` and `./manage.sh restore backups/<file>.sql.gz`.

---

## Privacy

On first startup, Xiro! sends **one anonymous ping** to [ntfy.sh](https://ntfy.sh) with the text "Xiro! installed" and the version number, so the author knows how many installations exist. No personal data, no identifiers, no cookies, no other telemetry. Disable it with `XIRO_TELEMETRY=false` in `.env`.

---

## Documentation

Technical documentation for developers is in [`docs/`](docs/): [architecture](docs/ARCHITECTURE.md), [CQRS](docs/CQRS_PATTERN.md), [events](docs/EVENT_DRIVEN_PATTERN.md), [AI generator](docs/AI_SETUP.md) and [CSS styles](docs/CSS_GUIDE.md). Every environment variable is documented in [`.env.example`](.env.example).

---

<div align="center">
  <img src="https://xiro.pro/images/chamaleon/thumbs_up.svg" alt="thumbs up mascot" width="80">
  <br><br>
  <em>XIRO! © Fernández Villatoro Family</em>
</div>
