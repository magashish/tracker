# 4. API Specification

Base URL: `https://api.tracker.example.com/api/v1`
All requests/responses are `application/json` (except screenshot binary
PUTs, which go directly to object storage via pre-signed URL, not through
this API). All endpoints require `Content-Type: application/json` and
respond with a consistent envelope (§4.4). A full machine-readable OpenAPI
3.0 document will be generated from the Fastify JSON schemas during
implementation (Fastify schemas are the single source of truth — this
document is the human-readable index of that contract).

## 4.1 Auth model

Two independent principal types, two independent token pairs — an admin
token must never be accepted on an employee/agent endpoint and vice versa
(enforced by a `principal_type` claim in the JWT checked by
`authenticate.middleware.ts`).

| Token | Lifetime | Contains | Storage (client side) |
|---|---|---|---|
| Access token (JWT, RS256) | 15 min | `sub`, `principal_type`, `role` (admin only), `device_id` (employee only), `exp` | Memory only |
| Refresh token (opaque, random 256-bit) | 30 days (agent), 7 days (dashboard) | n/a — looked up via hash in `refresh_tokens` | Agent: OS-protected local storage (DPAPI / kernel keyring). Dashboard: `httpOnly` secure cookie |

Refresh is **rotating**: every use invalidates the old token and issues a
new one (`replaced_by` chain in the schema), so a stolen-but-unused refresh
token is detected the moment the legitimate client tries to use its
now-invalid token (triggers full session revocation).

## 4.2 Endpoint catalog

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/employee/login` | none | Employee email+password login. Returns access+refresh token. Body also carries `deviceUuid`, `hostname`, `os`, `agentVersion` → triggers device registration/update (§4.3). |
| POST | `/auth/employee/refresh` | refresh token | Rotates and returns a new token pair. |
| POST | `/auth/employee/logout` | access token | Revokes the current refresh token, ends the open session. |
| POST | `/auth/admin/login` | none | Admin/manager login (rate-limited harder than employee login). |
| POST | `/auth/admin/refresh` | refresh token | Rotates admin token pair. |
| POST | `/auth/admin/logout` | access token | Revokes admin refresh token. |

### Devices

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/devices/register` | employee access token | Idempotent upsert by `deviceUuid`; called by the agent on first login and on every subsequent login to refresh `agentVersion`/`osVersion`/`lastSeenAt`. |
| GET | `/devices/:deviceId` | employee (own) or admin | Device detail. |
| GET | `/devices` | admin | List all devices, filterable by `employeeId`, `status`. |
| PATCH | `/devices/:deviceId/revoke` | admin | Revokes a device (forces re-login, invalidates its refresh tokens) — e.g. lost laptop. |

### Sessions & Tracking

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/sessions/start` | employee access token | Opens a session for the current device (called right after login). |
| POST | `/sessions/:sessionId/heartbeat` | employee access token | Every 30s. Body: `idleSeconds`, `systemUptimeSeconds`, `activeApp`, `activeWindowTitle`, `capturedAt`. Response includes the **effective configuration** (§4.3) so the agent doesn't need a separate poll. |
| POST | `/sessions/:sessionId/end` | employee access token | Graceful logout/shutdown. |
| POST | `/activity/batch` | employee access token | Bulk-upload queued activity samples (used by the offline-sync drain — accepts an array so a reconnecting agent doesn't need N round trips). |
| GET | `/activity` | admin | Query activity by `employeeId`, date range — powers timeline/reports. |

### Screenshots

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/screenshots/upload-url` | employee access token | Requests a pre-signed PUT URL + `storageKey`. Body: `capturedAt`, `activityPercent`, `appName`, `windowTitle`, `fileSizeBytes`. |
| POST | `/screenshots/:screenshotId/confirm` | employee access token | Confirms the PUT succeeded (sets `uploadedAt`); if never confirmed within a TTL, a cleanup job deletes the orphaned object-storage key. |
| GET | `/screenshots` | admin | List/query by `employeeId`, date range, paginated. Returns short-lived pre-signed **GET** URLs, never permanent public URLs. |
| GET | `/screenshots/:screenshotId` | admin | Single screenshot metadata + pre-signed GET URL. Every call is audit-logged (viewing a screenshot is a sensitive read). |
| PATCH | `/screenshots/:screenshotId/blur` | admin | Marks a screenshot as blurred (privacy request handling). |

### Configuration

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/config/device/:deviceId` | employee (own) or admin | Effective config for a device (device override → employee override → global default). |
| PUT | `/config/global` | admin | Update the org-wide default config. |
| PUT | `/config/employee/:employeeId` | admin | Set/clear an employee-level override. |
| PUT | `/config/device/:deviceId` | admin | Set/clear a device-level override. |

### Version / Auto-update

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/version/latest?platform=windows\|linux` | employee access token or none | Latest `app_versions` row for the platform; agent compares against its own build version. |
| POST | `/version` | admin | Publish a new version (uploads go through object storage; this registers the metadata). |
| GET | `/version` | admin | List version history per platform. |

### Dashboard

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/dashboard/live` | admin | Employees with an open session in the last N minutes, current app/window, online/offline flag (derived from `last_heartbeat_at` vs. `heartbeat_interval * 2`). |
| GET | `/dashboard/employees/:employeeId/summary` | admin | Today's active/idle hours, session list, latest screenshot thumbnail. |
| GET | `/dashboard/employees/:employeeId/timeline` | admin | Chronological activity + screenshot timeline for a given day. |
| GET | `/dashboard/reports` | admin | Aggregated hours/activity, filterable by team/date range, CSV export variant via `Accept: text/csv`. |

### Admin / Roles / Employees management

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/employees` | admin | List/search employees. |
| POST | `/admin/employees` | admin (role: manage_employees) | Create employee. |
| PATCH | `/admin/employees/:employeeId` | admin | Update / suspend / deactivate. |
| GET | `/admin/admins` | admin (role: manage_admins) | List dashboard users. |
| POST | `/admin/admins` | admin (role: manage_admins) | Invite/create a dashboard user. |
| PATCH | `/admin/admins/:adminId` | admin (role: manage_admins) | Update role/status. |
| GET | `/admin/roles` | admin | List roles + permission sets. |

### Audit logs

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/audit-logs` | admin (role: view_audit_logs) | Filter by actor, entity type, date range, paginated. |

### Health

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | none | Liveness — process is up. |
| GET | `/ready` | none | Readiness — DB/Redis reachable. |

## 4.3 Key payload shapes

**`POST /auth/employee/login`**
```json
// Request
{
  "email": "jane@company.com",
  "password": "••••••••",
  "deviceUuid": "b3f1c2a4-...-uuid",
  "hostname": "janes-macbook",
  "os": "linux",
  "osVersion": "Ubuntu 24.04",
  "agentVersion": "1.4.2"
}
// Response 200
{
  "data": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "8f2e1c...",
    "expiresIn": 900,
    "employee": { "id": "...", "fullName": "Jane Doe", "email": "jane@company.com" },
    "device": { "id": "...", "status": "active" }
  }
}
```

**`POST /sessions/:sessionId/heartbeat`**
```json
// Request
{
  "capturedAt": "2026-07-09T10:15:00Z",
  "idleSeconds": 0,
  "systemUptimeSeconds": 41230,
  "activeApp": "code.exe",
  "activeWindowTitle": "main.go — tracker-agent"
}
// Response 200
{
  "data": {
    "acknowledged": true,
    "config": {
      "heartbeatIntervalSeconds": 30,
      "screenshotIntervalSeconds": 600,
      "screenshotQuality": 70,
      "idleThresholdSeconds": 300,
      "apiUrl": "https://api.tracker.example.com"
    }
  }
}
```

**`POST /screenshots/upload-url`**
```json
// Request
{ "capturedAt": "2026-07-09T10:20:00Z", "activityPercent": 82, "appName": "chrome.exe", "windowTitle": "Gmail", "fileSizeBytes": 184320 }
// Response 200
{
  "data": {
    "screenshotId": "6e9a...",
    "uploadUrl": "https://s3.../bucket/employee/.../key.jpg?X-Amz-Signature=...",
    "storageKey": "employee/6e9a.../2026-07-09/1015-abc.jpg",
    "expiresIn": 300
  }
}
```

## 4.4 Conventions

- **Response envelope**: success → `{ "data": ... }`; list endpoints add
  `{ "data": [...], "meta": { "page": 1, "pageSize": 50, "total": 431 } }`.
- **Error envelope** (uniform across the API, produced by
  `error-handler.middleware.ts`):
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "email must be a valid email address", "details": [...] } }
  ```
  Standard `code` values: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401),
  `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409),
  `RATE_LIMITED` (429), `INTERNAL_ERROR` (500).
- **Pagination**: `?page=1&pageSize=50` (max `pageSize=200`), cursor-based
  pagination reserved for `/activity` and `/audit-logs` given their volume
  (`?cursor=...` opaque token) rather than offset pagination.
- **Idempotency**: `/devices/register` and `/screenshots/:id/confirm` are
  idempotent by design (safe to retry after a network drop, which the
  agent's offline queue relies on).
- **Validation**: every route defines a Fastify JSON Schema for
  `body`/`params`/`querystring` — this is both the input-validation layer
  and the source for auto-generated OpenAPI docs (`@fastify/swagger`).
