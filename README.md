# STATUSVAULT

**Premium Self-Hosted WhatsApp Status Manager**

STATUSVAULT is a private, self-hosted full-stack application for connecting your own WhatsApp account via Baileys pairing code, syncing available WhatsApp statuses, previewing media, and downloading status files. It is designed for single-owner use with local SQLite storage and a simple deployment model.

## Key Principles

- **No login / no registration** — private single-owner instance
- **No external database** — SQLite only (`/data/statusvault.db`)
- **One backend service** — Express API + WhatsApp/Baileys + Socket.IO + static frontend
- **One persistent volume** — all important data under `/data`
- **Real functionality** — no dummy dashboard data

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript, Tailwind CSS, Lucide Icons, Framer Motion |
| Backend | Node.js, Express, TypeScript, Socket.IO |
| WhatsApp | [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) |
| Database | SQLite + Prisma ORM |
| Media | Sharp (images), FFmpeg (video thumbnails) |
| Deployment | Docker / Railway |

## Project Structure

```text
statusvault/
├── client/                 # React + Vite frontend
│   ├── src/
│   │   ├── components/     # UI, layout, status viewer
│   │   ├── pages/          # Dashboard, Gallery, Downloads, Connection, Settings, About
│   │   ├── lib/            # API client, socket, utilities
│   │   └── types/
│   └── ...
├── server/                 # Express + TypeScript backend
│   ├── prisma/
│   │   └── schema.prisma   # SQLite schema
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── services/       # WhatsApp/Baileys service
│   │   ├── lib/            # config, prisma, logger, paths
│   │   ├── middleware/
│   │   └── index.ts
│   └── ...
├── Dockerfile
├── railway.json
├── .env.example
└── README.md
```

## Data Storage

All persistent data lives under `DATA_DIR` (default `/data` in production):

```text
/data/
├── statusvault.db      # SQLite database
├── auth/               # WhatsApp/Baileys credentials (sensitive)
├── downloads/          # Downloaded status files
├── media/              # Synced status media cache
├── thumbs/             # Generated thumbnails
└── temp/               # Temporary files
```

> **Important:** Mount a persistent volume to `/data` in production. Without it, WhatsApp sessions and synced data will be lost on restart.

## Environment Variables

Copy `.env.example` and adjust as needed:

```bash
NODE_ENV=production
PORT=3000
DATA_DIR=/data
CORS_ORIGIN=            # optional, comma-separated; leave empty for same-origin
```

## Local Development

### Prerequisites

- Node.js 20+
- npm 10+
- FFmpeg (optional, recommended for video thumbnails)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Create server env (optional for dev)
cp .env.example .env

# 3. Generate Prisma client and sync schema
cd server
npx prisma generate --schema=prisma/schema.prisma
npx prisma db push --schema=prisma/schema.prisma
cd ..

# 4. Run dev servers (frontend + backend)
npm run dev
```

- Frontend: http://localhost:5173 (proxies `/api` and `/socket.io` to backend)
- Backend: http://localhost:3000
- Health check: http://localhost:3000/health

## Production Build

```bash
npm install
npm run build
npm start
```

The backend serves the built frontend from `client/dist` in production.

## Docker

```bash
docker build -t statusvault .
docker run -d \
  --name statusvault \
  -p 3000:3000 \
  -v statusvault_data:/data \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e DATA_DIR=/data \
  statusvault
```

Open `http://localhost:3000`.

## Railway Deployment

1. Create a new Railway project from this repository.
2. Railway will use the included `Dockerfile` (see `railway.json`).
3. Add a **Persistent Volume** and mount it at `/data`.
4. Set environment variables:
   - `NODE_ENV=production`
   - `PORT=3000`
   - `DATA_DIR=/data`
5. Deploy. The health check endpoint is `/health`.

**Do not add** PostgreSQL, Redis, or other external services. STATUSVAULT uses local SQLite only.

## WhatsApp Pairing Flow

1. Open STATUSVAULT and go to **WhatsApp Connection**.
2. Enter your WhatsApp phone number with country code (digits only, e.g. `6281234567890`).
3. Click **Generate Pairing Code**.
4. On your phone: WhatsApp → **Linked Devices** → **Link a device** → **Link with phone number instead**.
5. Enter the pairing code shown in STATUSVAULT.
6. Once connected, STATUSVAULT listens for available status updates.

## Status Sync Notes (Important)

STATUSVAULT uses Baileys to receive WhatsApp events. Status syncing has real-world limitations:

- **Statuses are synced when received** by the connected WhatsApp Web session. Not all historical statuses may be available immediately after linking.
- Status availability depends on **WhatsApp privacy settings**, contact relationships, and what the connected account can see.
- WhatsApp protocol changes can break unofficial libraries. If syncing stops working, check Baileys updates/issues.
- STATUSVAULT **does not bypass** WhatsApp privacy controls and does not access statuses unavailable to the connected account.

## Security Notes

This app has **no authentication** by design. Treat it as a private admin tool:

- Deploy on a **private network**, behind a VPN, Tailscale, Cloudflare Access, or equivalent network-level protection.
- Do **not** expose pairing/session endpoints publicly without access control.
- WhatsApp credentials are stored locally in `/data/auth` and never sent to the frontend.
- The `/data` directory is not served by the web server.
- API routes include Helmet headers, rate limiting, and input validation.

## API Overview

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/whatsapp/status` | Connection status |
| POST | `/api/whatsapp/connect` | Start pairing / request pairing code |
| POST | `/api/whatsapp/reconnect` | Reconnect session |
| POST | `/api/whatsapp/disconnect` | Disconnect session |
| DELETE | `/api/whatsapp/session` | Delete session and local auth |
| GET | `/api/statuses` | List statuses (filter/search/paginate) |
| GET | `/api/statuses/:id` | Status detail |
| POST | `/api/statuses/:id/save` | Toggle saved |
| POST | `/api/statuses/:id/download` | Download status to `/data/downloads` |
| GET | `/api/downloads` | Download history |
| DELETE | `/api/downloads/:id` | Delete one download record |
| DELETE | `/api/downloads` | Clear download history |
| GET | `/api/stats` | Dashboard stats |
| GET | `/api/settings` | Get settings |
| PUT | `/api/settings` | Update settings |

## Known Limitations

- **Baileys is unofficial.** WhatsApp may block or change behavior without notice.
- **Status history** may not be fully backfilled; newly received statuses are captured reliably when the session is active.
- **Video thumbnails** require FFmpeg; if unavailable, video statuses still sync but may lack generated thumbnails.
- **No auth** means network-level protection is required for safe deployment.
- **Single instance** design: one WhatsApp session per STATUSVAULT deployment.

## License

Private/self-hosted use. Review Baileys and WhatsApp terms before deploying.
