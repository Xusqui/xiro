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

- A **Linux** server or a **NAS** with **Docker** and **Docker Compose**
- A **domain** pointing to it (Xiro! must be accessed via `https://`)

### Which installation?

| | **A. Public server with Caddy** | **B. Your own reverse proxy** |
|---|---|---|
| For | A VPS or server with nothing in front of it | A NAS (Synology, QNAP…), a home or office server, or a server that already runs nginx or Nginx Proxy Manager |
| Template | `docker-compose.deploy.yml` | `docker-compose.deploy.nas.yml` |
| HTTPS | The `caddy` container gets the certificate by itself | Your proxy serves HTTPS and forwards to `127.0.0.1:3000` |
| Ports | **80** and **443** free and open | Only the ones your proxy already uses |

Both use the same images and update the same way. To build the images yourself, see [install from source](#install-from-source) at the end.

### Step 1 — Prepare the folder

Copy your template (renamed to `docker-compose.yml`) and `.env.example` (renamed to `.env`) from this repository into a new folder:

```bash
mkdir -p /opt/xiro && cd /opt/xiro
cp /path/to/repo/docker-compose.deploy.yml docker-compose.yml          # A. with Caddy
# cp /path/to/repo/docker-compose.deploy.nas.yml docker-compose.yml  # B. your own proxy
cp /path/to/repo/.env.example .env

mkdir -p public/uploads public/images/personalizations logs config backups
echo '{}' > config/ui-overrides.json
echo '{}' > config/runtime-overrides.json
echo '{}' > config/groq-key.json

sudo chown -R 1001:1001 public logs config
sudo chown 1001:1001 config/*
```

On a NAS, use a folder on a data volume, e.g. `/volume1/docker/xiro` (Synology) or `/share/Container/xiro` (QNAP), and run these commands over SSH.

### Step 2A — Set your domain in Caddy

*Installation A only.* In `docker-compose.yml`, `caddy` service, replace `xiro.pro` with your domain:

```yaml
    command: caddy reverse-proxy --from https://quiz.example.com --to http://backend:3000
```

### Step 2B — Configure your reverse proxy

*Installation B only.* The backend listens on `127.0.0.1:3000` (change the port with `APP_PORT` in `.env`). Create a proxy entry for your domain that:

- serves **HTTPS** with a valid certificate (e.g. Let's Encrypt);
- forwards to `http://127.0.0.1:3000`;
- passes **WebSocket** (`Upgrade` and `Connection` headers). Without it, players cannot join;
- sends `X-Forwarded-For` and `X-Forwarded-Proto`.

If the proxy runs on another machine, or in a container that cannot reach the host's `127.0.0.1` (Nginx Proxy Manager in Docker, for instance), add `APP_BIND=0.0.0.0` (or the LAN IP) to `.env`. Never open port 3000 on the router: only the proxy's 80/443.

<details>
<summary><strong>Synology DSM 7</strong></summary>

<br>

DSM already uses ports 80 and 443, which is why Caddy is not needed here.

1. **Start Xiro!** Run step 1 in `/volume1/docker/xiro` over SSH with template **B**, fill in `.env` (step 3) and start it, either with `sudo docker compose up -d` in that folder or from **Container Manager → Project → Create**: path `/volume1/docker/xiro`, source *Use existing docker-compose.yml*.
2. **Certificate.** **Control Panel → Security → Certificate → Add → Add a new certificate → Get a certificate from Let's Encrypt**, with your domain.
3. **Reverse proxy.** **Control Panel → Login Portal → Advanced → Reverse Proxy → Create**:
   - **Source:** protocol `HTTPS`, hostname `quiz.example.com`, port `443`, *Enable HSTS*.
   - **Destination:** protocol `HTTP`, hostname `localhost`, port `3000`.
   - **Custom Header** tab → **Create → WebSocket** (adds `Upgrade` and `Connection`).
4. **Assign the certificate.** **Control Panel → Security → Certificate → Settings**: pick the new certificate for the `quiz.example.com` entry.
5. **Router.** Forward ports 80 and 443 to the NAS (80 is only needed to renew Let's Encrypt).

</details>

<details>
<summary><strong>QNAP (QTS 5 / QuTS hero)</strong></summary>

<br>

1. **Start Xiro!** Run step 1 in `/share/Container/xiro` over SSH with template **B**, fill in `.env` and start it with `docker compose up -d` in that folder. A Container Station app created by pasting the YAML does not see the `.env` or the folders of step 1.
2. **Certificate.** **Control Panel → Security → SSL Certificate & Private Key → Replace Certificate → Get from Let's Encrypt**, with your domain.
3. **Reverse proxy.** **Control Panel → Network & File Services → Network Access → Reverse Proxy → Add**: source `HTTPS`, your domain, port `443`; destination `HTTP`, `localhost`, port `3000`.
4. **Router.** Forward ports 80 and 443 to the NAS.

If players get stuck on "connecting", the QTS proxy is not passing WebSocket: use Nginx Proxy Manager instead (next example).

</details>

<details>
<summary><strong>Nginx Proxy Manager</strong> (Unraid, OpenMediaVault, any server)</summary>

<br>

1. In `.env`, add `APP_BIND=0.0.0.0` (NPM runs in its own container, where `127.0.0.1` is NPM itself) and run `docker compose up -d`.
2. **Proxy Hosts → Add Proxy Host:**
   - **Details:** domain `quiz.example.com`, scheme `http`, forward hostname/IP the server's LAN IP, port `3000`, and enable **Websockets Support**.
   - **SSL:** *Request a new SSL Certificate*, **Force SSL** and **HTTP/2 Support**.
3. **Router.** Forward ports 80 and 443 to NPM, never 3000.

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

    client_max_body_size 30m;  # image and slide uploads

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;  # AI generation can take a while
    }
}
```

</details>

### Step 3 — Edit `.env`

| Variable | Value |
|----------|-------|
| `DB_PASSWORD`, `REDIS_PASSWORD` | Random passwords, no spaces |
| `JWT_SECRET` | Random string, at least 32 characters |
| `UPDATER_TOKEN` | Another random string of at least 32 characters (enables the **Update** button of the admin panel) |
| `CORS_ORIGIN`, `ALLOWED_ORIGINS` | Your public URL, e.g. `https://quiz.example.com` |
| `SERVER_HOST` | Your domain without `https://`, e.g. `quiz.example.com` |

Leave the rest as it is. Generate random values with `openssl rand -hex 32`.

### Step 4 — Start

```bash
docker compose up -d
docker compose ps     # every container "Up"; db and redis "healthy"
```

With installation B, check the backend first with `curl -I http://127.0.0.1:3000/ready` (it should answer `200`), then open `https://<your-domain>`.

### Step 5 — Create the admin account

Open `https://<your-domain>/admin.html`. **The first account you register becomes admin.** Later accounts are editors and need email confirmation.

### Updating

**From the admin panel (recommended).** Xiro! checks Docker Hub once an hour. When a new version is out, a **New version** badge appears in the admin sidebar. In **Config → Updates**, **Update now** backs up the database, downloads the new images, restarts `backend` and `backup` and checks that the new version starts; if it doesn't, it goes back to the previous one by itself. Games in progress are cut, so the panel warns you first.

The button is handled by the `updater` container. It has access to the Docker socket (it can manage the server's containers), so it publishes no ports and only accepts requests from the backend signed with `UPDATER_TOKEN`.

**By hand:**

```bash
cd /opt/xiro
docker compose pull
docker compose up -d
```

Data lives in the folder's subdirectories (`postgres_data/`, `redis_data/`, `public/`, `config/`, `backups/`), so updates don't lose it.

`docker compose pull` updates the images, not `docker-compose.yml`. When a release changes your template (`docker-compose.deploy.yml` or `docker-compose.deploy.nas.yml`), copy it again over your `docker-compose.yml` (with A, set your domain in the `caddy` service again, step 2A) before `docker compose up -d`.

**Switching from A to B** (e.g. you put the server behind your own proxy): run `docker compose down`, copy `docker-compose.deploy.nas.yml` over `docker-compose.yml`, set up the proxy (step 2B) and run `docker compose up -d`. The data stays in the subdirectories.

**Installed before the update button existed?** Copy your current template over your `docker-compose.yml` (with A, set your domain again, step 2A), add `UPDATER_TOKEN=<openssl rand -hex 32>` to `.env` and run `docker compose pull && docker compose up -d`. From then on, updates can be installed from the panel.

> **PDF export fails with "Error al generar el PDF":** the backend can't reach the `chrome` container. Check that `docker compose exec backend printenv CHROME_WS_ENDPOINT` prints `ws://chrome:3000` and that the `xiro_chrome` container is running. If it is empty, copy your current template again (it sets this variable) or add `CHROME_WS_ENDPOINT=ws://chrome:3000` to `.env`, then run `docker compose up -d`.

> **Troubleshooting:** if one of the JSON files from step 1 is missing, Docker creates a **directory** with that name and the app won't start. Stop the services, delete that directory, create the file and start again.

<a id="install-from-source"></a>

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

The app listens only on `127.0.0.1:3000`. Set up your reverse proxy as in [step 2B](#step-2b--configure-your-reverse-proxy).

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
- **Update** Xiro! with one click when a new version is published (**Config → Updates**)
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
