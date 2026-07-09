# 2. Folder Structure

Monorepo, three top-level apps + shared docs. Each app is independently
buildable/deployable (separate `go.mod`, `package.json`, `package.json`).

```
tracker/
├── agent/                          # Go desktop agent
│   ├── cmd/
│   │   └── agent/
│   │       └── main.go             # composition root: wires DI, starts service
│   ├── internal/
│   │   ├── domain/                 # entities + interfaces, zero external deps
│   │   │   ├── session.go
│   │   │   ├── activity.go
│   │   │   ├── screenshot.go
│   │   │   ├── device.go
│   │   │   ├── config.go
│   │   │   └── ports.go            # repository/gateway interfaces (Go "ports")
│   │   ├── application/            # use cases, orchestration only
│   │   │   ├── auth_usecase.go
│   │   │   ├── heartbeat_usecase.go
│   │   │   ├── activity_tracking_usecase.go
│   │   │   ├── screenshot_usecase.go
│   │   │   ├── sync_usecase.go
│   │   │   └── autoupdate_usecase.go
│   │   ├── infrastructure/
│   │   │   ├── api/                # HTTP client implementing domain ports
│   │   │   │   ├── client.go
│   │   │   │   ├── auth_client.go
│   │   │   │   └── retry_transport.go
│   │   │   ├── storage/            # local durable queue
│   │   │   │   ├── sqlite_queue.go
│   │   │   │   └── migrations/
│   │   │   ├── platform/           # OS-specific implementations
│   │   │   │   ├── windows/
│   │   │   │   │   ├── activewindow_windows.go
│   │   │   │   │   ├── idle_windows.go
│   │   │   │   │   ├── screenshot_windows.go
│   │   │   │   │   └── service_windows.go
│   │   │   │   └── linux/
│   │   │   │       ├── activewindow_linux.go
│   │   │   │       ├── idle_linux.go
│   │   │   │       ├── screenshot_linux.go
│   │   │   │       └── service_linux.go
│   │   │   ├── logging/
│   │   │   │   └── rotating_logger.go
│   │   │   └── updater/
│   │   │       └── selfupdate.go
│   │   ├── interfaces/
│   │   │   ├── loginui/            # minimal native login window
│   │   │   │   └── loginui.go
│   │   │   └── tray/               # optional system tray icon (status only)
│   │   │       └── tray.go
│   │   └── config/
│   │       └── config.go           # local config file + remote overlay
│   ├── pkg/
│   │   └── jpegcompress/           # reusable, side-effect-free helpers
│   ├── build/
│   │   ├── windows/
│   │   │   ├── installer.nsi       # NSIS installer script
│   │   │   └── service_install.ps1
│   │   └── linux/
│   │       ├── tracker-agent.service   # systemd unit
│   │       └── debian/                 # .deb packaging (control, postinst)
│   ├── go.mod
│   └── go.sum
│
├── backend/                         # Node.js Fastify API
│   ├── src/
│   │   ├── domain/                  # entities, value objects, domain errors
│   │   │   ├── entities/
│   │   │   │   ├── employee.ts
│   │   │   │   ├── device.ts
│   │   │   │   ├── session.ts
│   │   │   │   ├── activity.ts
│   │   │   │   ├── screenshot.ts
│   │   │   │   ├── admin.ts
│   │   │   │   └── configuration.ts
│   │   │   └── errors/
│   │   │       └── domain-error.ts
│   │   ├── application/             # services = use cases; framework-agnostic
│   │   │   ├── auth/
│   │   │   │   ├── authenticate-employee.service.ts
│   │   │   │   ├── authenticate-admin.service.ts
│   │   │   │   └── refresh-token.service.ts
│   │   │   ├── devices/
│   │   │   │   └── register-device.service.ts
│   │   │   ├── tracking/
│   │   │   │   ├── record-heartbeat.service.ts
│   │   │   │   └── record-activity.service.ts
│   │   │   ├── screenshots/
│   │   │   │   ├── create-upload-url.service.ts
│   │   │   │   └── confirm-screenshot.service.ts
│   │   │   ├── config/
│   │   │   │   └── get-device-config.service.ts
│   │   │   ├── dashboard/
│   │   │   │   ├── get-live-employees.service.ts
│   │   │   │   └── get-employee-report.service.ts
│   │   │   ├── admin/
│   │   │   │   ├── manage-roles.service.ts
│   │   │   │   └── manage-admins.service.ts
│   │   │   └── ports/                # interfaces the app layer depends on
│   │   │       ├── employee-repository.port.ts
│   │   │       ├── device-repository.port.ts
│   │   │       ├── screenshot-storage.port.ts
│   │   │       ├── token-service.port.ts
│   │   │       └── clock.port.ts
│   │   ├── infrastructure/
│   │   │   ├── db/
│   │   │   │   ├── pool.ts
│   │   │   │   └── repositories/     # port implementations, Postgres-specific
│   │   │   │       ├── employee.repository.ts
│   │   │   │       ├── device.repository.ts
│   │   │   │       ├── session.repository.ts
│   │   │   │       ├── activity.repository.ts
│   │   │   │       ├── screenshot.repository.ts
│   │   │   │       ├── configuration.repository.ts
│   │   │   │       ├── audit-log.repository.ts
│   │   │   │       └── admin.repository.ts
│   │   │   ├── storage/
│   │   │   │   └── s3-screenshot-storage.ts
│   │   │   ├── security/
│   │   │   │   ├── jwt-token.service.ts
│   │   │   │   ├── password-hasher.ts   # argon2id
│   │   │   │   └── rate-limiter.ts      # redis-backed
│   │   │   └── logging/
│   │   │       └── logger.ts            # pino
│   │   ├── interfaces/
│   │   │   └── http/
│   │   │       ├── routes/
│   │   │       │   ├── auth.routes.ts
│   │   │       │   ├── devices.routes.ts
│   │   │       │   ├── activity.routes.ts
│   │   │       │   ├── screenshots.routes.ts
│   │   │       │   ├── config.routes.ts
│   │   │       │   ├── version.routes.ts
│   │   │       │   ├── dashboard.routes.ts
│   │   │       │   ├── admin.routes.ts
│   │   │       │   └── audit-logs.routes.ts
│   │   │       ├── controllers/     # thin: parse → call service → format
│   │   │       │   ├── auth.controller.ts
│   │   │       │   ├── devices.controller.ts
│   │   │       │   ├── activity.controller.ts
│   │   │       │   ├── screenshots.controller.ts
│   │   │       │   ├── config.controller.ts
│   │   │       │   ├── version.controller.ts
│   │   │       │   ├── dashboard.controller.ts
│   │   │       │   └── admin.controller.ts
│   │   │       ├── middlewares/
│   │   │       │   ├── authenticate.middleware.ts
│   │   │       │   ├── authorize-role.middleware.ts
│   │   │       │   ├── rate-limit.middleware.ts
│   │   │       │   ├── error-handler.middleware.ts
│   │   │       │   └── audit-log.middleware.ts
│   │   │       └── validation/
│   │   │           ├── auth.schema.ts       # JSON Schema / Zod, used by Fastify
│   │   │           ├── devices.schema.ts
│   │   │           ├── activity.schema.ts
│   │   │           ├── screenshots.schema.ts
│   │   │           └── config.schema.ts
│   │   ├── container.ts             # composition root / DI wiring
│   │   ├── app.ts                   # fastify() instance + plugin registration
│   │   └── server.ts                # entrypoint: app.listen()
│   ├── migrations/                  # node-pg-migrate, timestamped SQL/JS
│   ├── test/
│   │   ├── unit/                    # application layer, fakes only
│   │   └── integration/             # real Postgres via testcontainers
│   ├── Dockerfile
│   ├── docker-compose.yml           # local dev: postgres, redis, minio, api
│   ├── package.json
│   └── tsconfig.json
│
├── dashboard/                       # React admin/manager dashboard
│   ├── src/
│   │   ├── api/                     # typed API client (fetch wrapper), one file per resource
│   │   │   ├── client.ts
│   │   │   ├── employees.api.ts
│   │   │   ├── devices.api.ts
│   │   │   ├── activity.api.ts
│   │   │   ├── screenshots.api.ts
│   │   │   ├── reports.api.ts
│   │   │   └── admin.api.ts
│   │   ├── features/                # feature-sliced modules
│   │   │   ├── live-employees/
│   │   │   ├── employee-profile/
│   │   │   ├── screenshots-timeline/
│   │   │   ├── reports/
│   │   │   ├── settings/
│   │   │   └── admin-users/
│   │   ├── components/              # shared, dumb, reusable UI
│   │   ├── hooks/                   # shared hooks (useAuth, useTheme, ...)
│   │   ├── routes/                  # React Router route tree
│   │   ├── store/                   # local UI state only (theme, filters)
│   │   ├── styles/                  # tailwind.css, theme tokens
│   │   ├── types/                   # shared TS types mirroring API schema
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── package.json
│   └── tsconfig.json
│
├── docs/
│   └── architecture/                 # this document set
│
├── docker-compose.yml                 # root: orchestrates backend + dashboard + infra for local dev
└── README.md
```

## 2.1 Layering rule (applies to both agent and backend)

```
interfaces  ──depends on──▶  application  ──depends on──▶  domain
infrastructure ──implements──▶  application/domain ports
```

- `domain` never imports from `application`, `infrastructure`, or
  `interfaces`.
- `application` depends only on `domain` and on **interfaces it declares
  itself** (ports) — never on a concrete Postgres/HTTP/OS type.
- `infrastructure` is the only layer allowed to import third-party
  SDKs/drivers (`pg`, `fastify`, `windows/svc`, X11 bindings, AWS SDK).
- `interfaces` (HTTP routes/controllers in the backend; login UI/tray in the
  agent) is the only layer allowed to know about transport concerns
  (HTTP status codes, CLI flags, window events).
- Composition roots (`container.ts`, `cmd/agent/main.go`) are the only
  places where concrete infrastructure classes are instantiated and wired
  into application services — this is where dependency injection happens
  (no DI framework needed at this scale; explicit constructor injection is
  sufficient and stays easy to test).
