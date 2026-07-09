# 6. Sequence Diagrams

## 6.1 Employee login & device registration

```mermaid
sequenceDiagram
    actor Emp as Employee
    participant UI as Agent Login UI
    participant AuthUC as AuthenticateUseCase
    participant API as Backend API
    participant DB as PostgreSQL
    participant Cred as Credential Store (DPAPI/keyring)

    Emp->>UI: Enter email + password
    UI->>AuthUC: Login(email, password)
    AuthUC->>API: POST /auth/employee/login\n{email, password, deviceUuid, hostname, os, agentVersion}
    API->>DB: SELECT employee WHERE email=...
    API->>API: verify argon2id password hash
    API->>DB: UPSERT devices (device_uuid, employee_id, hostname, os, agent_version)
    API->>DB: INSERT refresh_tokens (hash, expires_at)
    API-->>AuthUC: 200 {accessToken, refreshToken, employee, device}
    AuthUC->>Cred: store refreshToken (encrypted)
    AuthUC->>API: POST /sessions/start
    API->>DB: INSERT sessions (started_at=now)
    API-->>AuthUC: 200 {sessionId}
    AuthUC-->>UI: login success
    UI->>UI: hide login window, enter tracking mode
    AuthUC->>AuthUC: trigger immediate "capture on login" screenshot
```

## 6.2 Heartbeat + activity tracking (steady state)

```mermaid
sequenceDiagram
    participant Sched as Scheduler
    participant HB as HeartbeatUseCase
    participant WI as WindowInspector (OS)
    participant ID as IdleDetector (OS)
    participant Queue as Local SQLite Queue
    participant API as Backend API
    participant DB as PostgreSQL

    loop every 30s (heartbeatIntervalSeconds)
        Sched->>HB: tick
        HB->>WI: ActiveWindow()
        WI-->>HB: {appName, windowTitle}
        HB->>ID: IdleSeconds()
        ID-->>HB: idleSeconds
        HB->>API: POST /sessions/:id/heartbeat\n{idleSeconds, activeApp, activeWindowTitle, uptime}
        alt online
            API->>DB: UPDATE sessions SET last_heartbeat_at=now()
            API->>DB: INSERT activity (aggregated window sample)
            API-->>HB: 200 {config: {...effective config...}}
            HB->>Sched: apply any changed intervals (ticker.Reset)
        else network error / timeout
            HB->>Queue: enqueue activity sample (status=pending)
            Note over HB,Queue: see §6.4 Offline sync
        end
    end
```

## 6.3 Screenshot capture & upload (online path)

```mermaid
sequenceDiagram
    participant Sched as Scheduler
    participant SUC as ScreenshotUseCase
    participant Cap as ScreenshotCapturer (OS)
    participant API as Backend API
    participant S3 as Object Storage
    participant DB as PostgreSQL

    Sched->>SUC: tick (every screenshotIntervalSeconds, default 600s)
    SUC->>Cap: Capture()
    Cap-->>SUC: raw bitmap
    SUC->>SUC: downscale + JPEG encode @ screenshotQuality
    SUC->>API: POST /screenshots/upload-url\n{capturedAt, activityPercent, appName, windowTitle, fileSizeBytes}
    API->>DB: INSERT screenshots (storage_key, uploaded_at=NULL)
    API->>S3: generate pre-signed PUT URL
    API-->>SUC: 200 {screenshotId, uploadUrl, storageKey}
    SUC->>S3: PUT uploadUrl (JPEG bytes, TLS)
    S3-->>SUC: 200
    SUC->>API: POST /screenshots/:id/confirm
    API->>DB: UPDATE screenshots SET uploaded_at=now()
    API-->>SUC: 200
    SUC->>SUC: delete local temp JPEG file
```

## 6.4 Offline queueing & auto-sync on reconnect

```mermaid
sequenceDiagram
    participant HB as HeartbeatUseCase
    participant Queue as Local SQLite Queue
    participant Sync as OfflineSyncUseCase
    participant API as Backend API
    participant DB as PostgreSQL

    Note over HB: Network unreachable
    HB->>Queue: INSERT activity_sample (status=pending)
    HB->>HB: continue local idle/window aggregation each tick
    HB->>Queue: INSERT (repeat every 30s while offline)

    Note over Sync: Every heartbeat tick, sync is attempted first
    Sync->>API: GET /health
    alt still offline
        API-->>Sync: timeout / error
        Sync->>Sync: exponential backoff (cap 5 min), retry next tick
    else back online
        API-->>Sync: 200
        Sync->>Queue: SELECT pending activity (oldest N first)
        Sync->>API: POST /activity/batch [ ...N samples ]
        API->>DB: INSERT activity (bulk)
        API-->>Sync: 200 {accepted: N}
        Sync->>Queue: mark N rows synced, delete
        Sync->>Queue: SELECT pending screenshots
        loop each pending screenshot
            Sync->>API: POST /screenshots/upload-url
            API-->>Sync: {uploadUrl, storageKey}
            Sync->>Sync: PUT to object storage (as in §6.3)
            Sync->>API: POST /screenshots/:id/confirm
        end
        Sync->>Queue: purge confirmed rows
    end
```

## 6.5 Auto-update

```mermaid
sequenceDiagram
    participant UUC as AutoUpdateUseCase
    participant API as Backend API
    participant S3 as Artifact Storage
    participant Svc as OS Service Manager

    UUC->>API: GET /version/latest?platform=windows
    API-->>UUC: {version: "1.5.0", downloadUrl, checksumSha256, isMandatory}
    alt remote version > running version
        UUC->>S3: GET downloadUrl
        S3-->>UUC: binary bytes
        UUC->>UUC: verify sha256(binary) == checksumSha256
        alt checksum mismatch
            UUC->>UUC: log error, abort update, keep running current version
        else checksum OK
            UUC->>UUC: write binary to versioned path, wait for quiescent state\n(no upload/capture in flight)
            UUC->>Svc: request service restart pointing at new version
            Svc-->>UUC: service stopped
            Svc->>Svc: service manager starts new binary
            Note over UUC: new process resumes from §6.1\n(valid refresh token → skip login UI)
        end
    else already up to date
        UUC->>UUC: no-op
    end
```

## 6.6 Admin views the live dashboard

```mermaid
sequenceDiagram
    actor Mgr as Manager
    participant Dash as React Dashboard
    participant RQ as React Query
    participant API as Backend API
    participant DB as PostgreSQL
    participant Audit as audit-log.middleware

    Mgr->>Dash: open "Live Employees" page
    Dash->>RQ: useQuery('live-employees', { refetchInterval: 15s })
    RQ->>API: GET /dashboard/live
    API->>DB: SELECT sessions JOIN employees JOIN devices\nWHERE ended_at IS NULL
    API->>API: derive online/offline from now() - last_heartbeat_at\nvs 2 * heartbeat_interval
    API-->>RQ: 200 {data: [{employee, device, status, currentApp, currentWindow, idleSeconds}, ...]}
    RQ-->>Dash: render employee cards
    Mgr->>Dash: click employee -> open screenshot
    Dash->>API: GET /screenshots/:id
    API->>Audit: log {action: 'employee.screenshot.view', actorAdminId, entityId}
    API->>DB: INSERT audit_logs
    API-->>Dash: 200 {data: {..., viewUrl: pre-signed GET, expiresIn: 60}}
    Dash->>Dash: render image from short-lived URL
    Note over RQ,API: React Query re-polls every 15s;\nno WebSocket in MVP (see 01-system-architecture.md §Open Questions)
```
