# Tracker — Employee Desktop Monitoring System

A Hubstaff/Time Doctor–style employee monitoring platform composed of three
independently deployable applications sharing one PostgreSQL database and
one REST API contract:

| Application       | Stack                                   | Path         |
|--------------------|------------------------------------------|--------------|
| Desktop Agent       | Go (Windows 10/11 + Ubuntu Linux)        | `agent/`     |
| Backend API         | Node.js, Fastify, PostgreSQL             | `backend/`   |
| Admin/Manager Dashboard | React, TypeScript, Vite, Tailwind, React Query | `dashboard/` |

## Status

All three applications are implemented and have been verified end-to-end
against each other locally (employee login → device registration →
heartbeat → screenshot capture/upload → admin dashboard view, with audit
logging and a 7-day screenshot retention job). See
[`docs/architecture/`](docs/architecture/) for the design this was built
from.

Notable implementation choice: **screenshots are stored on the backend's
local disk**, not S3/object storage as the original architecture doc
proposed — the upload/view flow uses short-lived HMAC-signed URLs served
by the backend itself instead of pre-signed S3 URLs. A daily job deletes
screenshots (file + DB row) older than `SCREENSHOT_RETENTION_DAYS`
(default 7).

## Running it locally

**Backend** (`backend/`): requires PostgreSQL + Redis.
```
cp .env.example .env        # fill in JWT_ACCESS_SECRET / STORAGE_SIGNING_SECRET
npm install
npm run migrate:up
SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD=... npm run seed:admin
npm run dev                 # http://localhost:3000
```
Or `docker compose up` for Postgres + Redis + API together.

**Dashboard** (`dashboard/`):
```
cp .env.example .env
npm install
npm run dev                 # http://localhost:5173
```

**Agent** (`agent/`): requires Go 1.25+. On Linux it shells out to
`xdotool`, `xprintidle`, and ImageMagick's `import` for window/idle/
screenshot capture (X11 session required — see the Wayland caveat in the
agent architecture doc).
```
go build -o tracker-agent ./cmd/agent
./tracker-agent             # prompts for email/password on first run
```

## Start here (architecture docs)

1. [System Architecture](docs/architecture/01-system-architecture.md)
2. [Folder Structure](docs/architecture/02-folder-structure.md)
3. [Database Schema](docs/architecture/03-database-schema.md)
4. [API Specification](docs/architecture/04-api-specification.md)
5. [Desktop Agent Architecture](docs/architecture/05-desktop-agent-architecture.md)
6. [Sequence Diagrams](docs/architecture/06-sequence-diagrams.md)

Or read the [architecture index](docs/architecture/README.md) for a summary
of every document. Note: the docs describe S3-based screenshot storage as
the original proposal; the implementation uses local disk storage instead
(see Status above).
