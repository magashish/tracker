# Architecture Documentation — Index

This directory is the architecture deliverable requested before any code is
written. It covers the three applications (Go desktop agent, Fastify/Postgres
backend, React dashboard), the shared database, the API contract between
them, and the plan for building it.

| # | Document | Purpose |
|---|----------|---------|
| 1 | [System Architecture](01-system-architecture.md) | Component diagram, data flow, deployment topology, tech stack rationale |
| 2 | [Folder Structure](02-folder-structure.md) | Monorepo layout for all three apps, Clean Architecture layering |
| 3 | [Database Schema](03-database-schema.md) | Full PostgreSQL DDL, ERD, indexing/retention strategy |
| 4 | [API Specification](04-api-specification.md) | REST endpoint catalog, auth model, request/response shapes, error format |
| 5 | [Desktop Agent Architecture](05-desktop-agent-architecture.md) | Go package layout, OS abstraction, scheduler, offline queue, resource budget |
| 6 | [Sequence Diagrams](06-sequence-diagrams.md) | Login, heartbeat, screenshot upload, offline sync, auto-update, live dashboard |
| 7 | [Security & NFRs](07-security-and-nfrs.md) | AuthN/Z, transport security, rate limiting, encryption, performance budgets |
| 8 | [Development Roadmap](08-roadmap.md) | Phased delivery plan, milestones, staffing assumptions |

## Design principles applied throughout

- **Clean Architecture** in both the agent (Go) and backend (Node): domain
  logic has zero import-time dependency on frameworks, transports, or
  drivers. Infrastructure (Postgres, HTTP, OS APIs, filesystem) is injected
  behind interfaces defined by the domain/application layers.
- **Dependency Injection** — constructor injection everywhere; no service
  locators, no global singletons except a logger.
- **Testability** — every use case can be unit tested with in-memory fakes;
  integration tests exercise the real Postgres via Docker/testcontainers;
  the agent's OS-specific code sits behind interfaces so business logic is
  tested without a real desktop session.
- **Offline-first agent** — the agent never blocks tracking on network
  availability; a local durable queue (SQLite) absorbs everything and a
  background syncer drains it.
- **Least privilege & privacy by design** — screenshots and window titles are
  sensitive; access is role-gated and every read is audit-logged (see
  [07-security-and-nfrs.md](07-security-and-nfrs.md)).

## Open questions requiring a decision before implementation starts

These are called out explicitly rather than silently assumed:

1. **Screenshot storage backend** — object storage (S3/MinIO/Azure Blob) vs.
   storing binaries in Postgres. This doc assumes **S3-compatible object
   storage** with only metadata + URL in Postgres (see schema doc, §
   `screenshots`). Confirm this is acceptable for the deployment target.
   MinIO is recommended for self-hosted/on-prem deployments so the design
   stays cloud-agnostic.
2. **Real-time dashboard updates** — polling (React Query interval) vs.
   WebSocket/SSE push for "live employees". This doc specifies polling for
   MVP (simpler, fewer moving parts) with a documented upgrade path to
   WebSocket in a later phase (see roadmap Phase 6).
3. **Multi-tenancy** — the schema below is single-organization. If this needs
   to serve multiple companies from one deployment, an `organizations` table
   and an `organization_id` column on every tenant-scoped table should be
   added before implementation — this is a schema-shape decision, not a
   later migration, so it must be settled now.
4. **Consent & legal compliance** — screenshot/keystroke-adjacent monitoring
   has jurisdiction-specific disclosure requirements (e.g., EU/GDPR, several
   US states). The system should support a "monitoring notice acknowledged"
   flag per employee/session; confirm whether legal review is needed before
   the feature set is finalized.

Once these four questions are answered and the documents below are approved,
implementation can proceed app-by-app following the roadmap.
