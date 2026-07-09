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

**Architecture phase.** No application code has been written yet, by design —
the full architecture is documented under [`docs/architecture/`](docs/architecture/)
and is pending review/approval before implementation begins.

## Start here

Read the docs in order:

1. [System Architecture](docs/architecture/01-system-architecture.md)
2. [Folder Structure](docs/architecture/02-folder-structure.md)
3. [Database Schema](docs/architecture/03-database-schema.md)
4. [API Specification](docs/architecture/04-api-specification.md)
5. [Desktop Agent Architecture](docs/architecture/05-desktop-agent-architecture.md)
6. [Sequence Diagrams](docs/architecture/06-sequence-diagrams.md)
7. [Security & NFRs](docs/architecture/07-security-and-nfrs.md)
8. [Development Roadmap](docs/architecture/08-roadmap.md)

Or read the [architecture index](docs/architecture/README.md) for a summary
of every document and the open questions that need a decision before coding
starts.
