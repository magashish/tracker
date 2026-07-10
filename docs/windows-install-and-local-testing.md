# Installing the Agent on Windows & Testing the Whole System Locally

This covers two things: getting the desktop agent running on a Windows
10/11 machine, and standing up the full stack (backend + dashboard +
agent) on your own machine to test it end-to-end.

**Known limitation, read first:** the agent's only UI is a **terminal
login prompt** (see `agent/internal/interfaces/loginui`), not a native
window. That's fine when you run the `.exe` from a terminal, but a real
Windows Service has no console to prompt on — so **the NSIS/Windows
Service install path (§3) will start and then hang waiting for input you
can't give it.** For actual local testing, use §2 (run it directly from a
terminal). §3 is included for completeness of the packaging story, but
treat it as not-yet-usable until a native login window or a
"cache-token-then-install-as-service" flow is added.

---

## 1. Get a backend running somewhere reachable from your Windows PC

The agent needs a live Tracker backend to talk to. Easiest: run the whole
backend stack **on the same Windows machine** (via Docker Desktop, or
WSL2), so the agent can just point at `http://localhost:3000`.

### Option A — Docker Desktop (simplest)

1. Install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/).
2. Clone the repo (or copy the `backend/` folder) onto Windows, e.g. via
   `git clone` in PowerShell, or WSL2 if you prefer.
3. In `backend/`, create `.env` from `.env.example` and fill in secrets:
   ```powershell
   copy .env.example .env
   ```
   Generate two random secrets (PowerShell):
   ```powershell
   -join ((48..57)+(97..102)|Get-Random -Count 64|%{[char]$_})
   ```
   Paste the result into `JWT_ACCESS_SECRET` and run it again for
   `STORAGE_SIGNING_SECRET` (they must be different, both ≥32 chars).
4. From `backend/`:
   ```powershell
   docker compose up -d
   ```
   This starts Postgres, Redis, and the API on `http://localhost:3000`.
5. Run migrations and create the first admin login (needs Node.js 20+
   installed locally, or `docker compose exec` into the `api` container):
   ```powershell
   npm install
   npm run migrate:up
   $env:SEED_ADMIN_EMAIL="you@example.com"
   $env:SEED_ADMIN_PASSWORD="ChangeMe123!"
   npm run seed:admin
   ```
6. Confirm it's up: `curl http://localhost:3000/health` → `{"status":"ok"}`.

### Option B — Node + local Postgres/Redis (no Docker)

Install Node.js 20+, PostgreSQL 16, and Redis for Windows (or run
Postgres/Redis in WSL2 and connect from Windows-native Node). Then:
```powershell
cd backend
copy .env.example .env   # edit DATABASE_URL / REDIS_URL / secrets to match your install
npm install
npm run migrate:up
npm run seed:admin        # with SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD set
npm run dev                # http://localhost:3000
```

### Bring up the dashboard too (optional but useful for verifying results)

```powershell
cd dashboard
copy .env.example .env     # VITE_API_URL=http://localhost:3000/api/v1
npm install
npm run dev                 # http://localhost:5173
```
Open `http://localhost:5173`, log in with the admin you seeded, and
you now have a live view to watch the agent's activity show up in.

### Create an employee to log the agent in as

Either through the dashboard (Settings → Add employee), or via curl/
PowerShell:
```powershell
$body = @{ email="jane@example.com"; fullName="Jane Doe"; password="EmployeePass123!" } | ConvertTo-Json
curl -X POST http://localhost:3000/api/v1/admin/employees `
  -H "Authorization: Bearer <admin accessToken from /auth/admin/login>" `
  -H "Content-Type: application/json" -d $body
```

---

## 2. Run the agent on Windows (recommended path for testing)

You have a pre-built binary (`agent/tracker-agent-windows-amd64.exe`,
cross-compiled from this session) or can build your own:

```powershell
# Only if building yourself — needs Go 1.25+ (https://go.dev/dl/)
cd agent
$env:GOOS="windows"; $env:GOARCH="amd64"
go build -o tracker-agent.exe .\cmd\agent
```

**Before first run**, pre-create the config file so the agent points at
your backend instead of the placeholder URL (you only need to set
`apiUrl` — `dataDir` defaults to `%AppData%\tracker-agent` automatically
if omitted):

```powershell
mkdir "$env:AppData\tracker-agent" -Force
'{ "apiUrl": "http://localhost:3000/api/v1" }' | Set-Content -Encoding ascii "$env:AppData\tracker-agent\config.json"
```
(`-Encoding ascii` avoids Windows PowerShell's default UTF-8-with-BOM,
which Go's JSON parser doesn't strip and would fail to load.)

Then just run it from a terminal (PowerShell or cmd — needs a real
console, since the login prompt reads from stdin):

```powershell
.\tracker-agent-windows-amd64.exe
```

You'll see:
```
Tracker Agent — sign in
Email: jane@example.com
Password: ********
```

On success it detaches into background tracking: heartbeats every 30s,
a screenshot on login + every 10 minutes (both via real Win32 GDI/user32
calls — no extra tools needed on Windows, unlike the Linux build which
shells out to xdotool/ImageMagick). Watch it work in the dashboard's
"Live Employees" page, or tail the log:

```powershell
type "$env:AppData\tracker-agent\logs\agent.log"
```

Stop it with Ctrl+C — it ends the session cleanly (`end_reason:
app_closed`) before exiting, same as the Linux smoke test earlier in
this session.

**Second run onward:** the refresh token is cached (AES-GCM encrypted at
`%AppData%\tracker-agent\credentials\`), so it resumes automatically
without re-prompting, unless the token expired/was revoked.

---

## 3. (Not yet usable) Install as a Windows Service via NSIS

`agent/build/windows/installer.nsi` registers the exe as a
`SERVICE_AUTO_START` Windows Service via `sc.exe create`. To build the
installer you need [NSIS](https://nsis.sourceforge.io/) (`makensis`),
either on Windows or cross-compiled on Linux via the `nsis` package:

```powershell
makensis agent\build\windows\installer.nsi
# produces tracker-agent-setup.exe
```

Running the resulting installer will install and start the service — but
as noted above, the service has no console for the login prompt, so it
will start and then effectively do nothing useful until you either:
- run the `.exe` once interactively first so a refresh token gets cached
  (then the service, on next start, could resume from it — this isn't
  wired up yet since the service and the interactive run use the same
  `%AppData%\tracker-agent` cache, so it actually *would* work if you log
  in interactively once, then let the service take over), or
- wait for a native login window / silent-provisioning flow to be built.

For now, prefer §2 for testing.

---

## 4. Verifying it worked end-to-end

1. Dashboard → **Live Employees**: Jane Doe should show "Online" with
   `janes-hostname` shortly after the agent logs in.
2. Click into her profile: today's active/idle seconds should tick up,
   and a screenshot should appear within a few seconds of login (check
   the agent log if not — GDI capture needs an actual interactive desktop
   session, so it'll fail gracefully if run in a headless/RDP-without-
   session context, same as it failed gracefully for missing X11 tools
   in this session's Linux test).
3. Kill your network (disable Wi-Fi) for a minute, then reconnect — the
   agent should queue heartbeats/screenshots locally
   (`%AppData%\tracker-agent\queue.db`) and drain them automatically once
   back online; check the log for `"synced queued activity"` /
   `"synced queued screenshots"` entries.
4. Settings → change the global heartbeat/screenshot interval — the
   agent should pick it up on its next heartbeat response (logged
   implicitly via the ticker reset; no explicit log line today, so watch
   heartbeat timing change instead).
