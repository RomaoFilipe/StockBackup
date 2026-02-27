<p align="center">
  <img src="public/branding/logo2.png" alt="CMCHUB" width="160" />
</p>

# CMCHUB Municipal Operations Platform

Enterprise platform for Portuguese municipalities, designed to orchestrate internal requests, citizen requests, finance approvals, asset lifecycle, presidential dispatch, and full compliance-grade auditability.

## Table of Contents

- [Executive Overview](#executive-overview)
- [Municipal Problem Statement](#municipal-problem-statement)
- [Core Capabilities](#core-capabilities)
- [Technology Stack](#technology-stack)
- [Architecture Overview](#architecture-overview)
- [Architecture Diagram](#architecture-diagram)
- [Operational Workflow Diagram](#operational-workflow-diagram)
- [Request State Machine](#request-state-machine)
- [Deployment Topology](#deployment-topology)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Go-live Checklist](#go-live-checklist)
- [What Docker Compose Does](#what-docker-compose-does)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [RBAC and Organizational Scope](#rbac-and-organizational-scope)
- [Workflow Engine](#workflow-engine)
- [Domain Breakdown](#domain-breakdown)
- [Security and Audit](#security-and-audit)
- [SLO/SLI and Observability](#slosli-and-observability)
- [Architecture Decision Records](#architecture-decision-records)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Quality Commands](#quality-commands)
- [License](#license)

## Executive Overview

CMCHUB is a modular municipal platform built for real public administration constraints: organizational complexity, strict traceability, role segregation, and policy-driven approvals. It centralizes process execution across departments while preserving clear domain boundaries and institutional governance.

## Municipal Problem Statement

Municipal operations are often fragmented across spreadsheets, disconnected tools, and manual approvals. This typically causes:

- Low traceability of decisions and approvals
- Inconsistent policy enforcement across departments
- Delays in internal and citizen-facing processes
- Weak audit evidence for inspections and accountability
- High operational risk in finance, asset management, and dispatch decisions

CMCHUB addresses these issues with a unified workflow-driven core, granular RBAC scoped by Organizational Unit, and end-to-end event/audit trails.

## Core Capabilities

- Domain-separated municipal operations: `internal_requests`, `citizen_requests`, `finance`, `assets`
- Configurable workflow engine (`ProcessDefinition`, `ProcessStep`, `ProcessInstance`)
- Granular RBAC with Organizational Unit scope
- Presidential dispatch and decision lifecycle
- Full audit trail and event history
- Notifications and official document support
- Multi-tenant-ready operating model

## Modular Domains (Current Project)

### Core Municipal Domains

- `internal_requests`
  - Internal request lifecycle, approvals, signatures, fulfillment
- `citizen_requests`
  - External/citizen request intake, triage, acceptance/rejection
- `finance`
  - Financial process lifecycle (`appropriation`, `commitment`, `authorization`, `payment`)
- `assets`
  - Municipal asset registration, assignments, lifecycle events, disposal
- `workflow`
  - Configurable process orchestration (`ProcessDefinition`, `ProcessStep`, `ProcessInstance`)
- `presidency_dispatch`
  - Dispatch and decision flow for presidency-level approvals

### Governance and Security Modules

- `rbac`
  - Role/permission management with organizational scope
- `audit_trail`
  - Request status audit, RBAC audit, workflow events, domain event history
- `auth_session`
  - Login/session lifecycle, token validation, secure cookies
- `security_controls`
  - CSRF protection, IP allowlist, login lockout, rate limiting
- `multi_tenant`
  - Tenant-aware data partitioning and context enforcement

### Operations and Service Modules

- `inventory_products`
  - Products, categories, suppliers, supplier providers
- `stock_movements`
  - IN/OUT/RETURN/REPAIR/SCRAP/LOST movement tracking
- `equipment_units`
  - Unit-level tracking, assignment, repair, return, loss, scrap
- `invoices_procurement`
  - Product invoices and linkage with requests/services
- `tickets_sla`
  - Incident/request ticketing, status workflow, SLA escalation
- `users_admin`
  - User administration, password resets, activation and audit actions

### Citizen, Communication and Documents

- `notifications_realtime`
  - In-app notifications and realtime event propagation
- `official_documents`
  - Request PDFs, report PDFs, substitution/request document generation
- `storage_management`
  - File upload/download, document indexing, storage organization
- `portal_requests`
  - Public portal endpoint and UI for citizen request submission

### Analytics and Reporting

- `business_insights`
  - Operational metrics and business insights dashboards
- `municipal_reports`
  - Municipal reporting endpoints and export flows
- `ticket_operations_reports`
  - Ticket performance and SLA-oriented reporting

### Field and Productivity Modules

- `scan_qr`
  - QR scanning flows for products and substitutions
- `mydesktop_presence`
  - Personal workspace, presence/heartbeat and desktop queue views

## Module x Endpoints x Permissions Matrix

| Module | Key Endpoints | Required Permission(s) |
|---|---|---|
| `internal_requests` | `GET/POST /api/requests`, `GET/PATCH /api/requests/[id]` | `requests.change_status`, `requests.approve` (chefia), `requests.final_approve` (final), `requests.reject` (chefia), `requests.final_reject` (final), `requests.pickup_sign`, `requests.sign_approval` |
| `workflow` | `GET/POST /api/workflows/requests/[id]/action` | `requests.change_status` (view/ops), plus transition-specific permissions |
| `citizen_requests` | `POST /api/portal/requests`, `GET /api/admin/public-requests`, `POST .../accept`, `POST .../reject` | `public_requests.handle` |
| `assets` | `GET/POST /api/governanca/assets`, `GET/PATCH /api/governanca/assets/[id]` | `assets.manage` |
| `finance` | `GET/POST /api/governanca/finance`, `GET/PATCH /api/governanca/finance/[id]` | `finance.manage` |
| `presidency_dispatch` | `POST /api/requests/[id]/presidency-dispatch`, `POST /api/requests/[id]/presidency-decision` | `presidency.approve` (decision), plus dispatch-level governance permissions |
| `rbac` | `GET/POST/PATCH /api/admin/rbac/*` | `users.manage` |

## Technology Stack

- Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS
- Backend: Next.js API Routes, Zod validation
- Data Access: Prisma ORM
- Database: PostgreSQL
- Security: session cookies, CSRF controls, RBAC, IP controls
- Storage: local file storage (`storage/`) with DB metadata indexing

## Architecture Overview

The platform follows a domain-oriented architecture with explicit cross-cutting governance services.

- Business domains: requests, citizen portal, finance, assets
- Platform services: workflow, RBAC, audit, notifications, documents
- Policy-first transitions and permission checks
- Scalable for multiple organizational units and municipal process variants

## Architecture Diagram

```mermaid
flowchart LR
  UI[Backoffice + Citizen Portal] --> API[Application API]

  API --> AUTH[Authentication & Session Security]
  API --> RBAC[RBAC + Organizational Scope]
  API --> WF[Workflow Engine]
  API --> AUDIT[Audit & Event Trail]
  API --> DOC[Official Documents]
  API --> NOTIF[Notifications]

  API --> DREQ[internal_requests]
  API --> DCIT[citizen_requests]
  API --> DFIN[finance]
  API --> DAST[assets]

  DREQ --> DB[(PostgreSQL)]
  DCIT --> DB
  DFIN --> DB
  DAST --> DB
  RBAC --> DB
  WF --> DB
  AUDIT --> DB

  DOC --> FS[(Storage /storage)]
```

## Operational Workflow Diagram

```mermaid
sequenceDiagram
  participant OU as Organizational Unit
  participant P as Platform
  participant FIN as Finance
  participant PRES as Presidency
  participant AUD as Audit
  participant CIT as Citizen

  OU->>P: Submit internal request
  P->>P: Create ProcessInstance
  P->>FIN: Financial validation
  FIN->>P: Validation outcome

  alt Amount > threshold
    P->>PRES: Presidential dispatch required
    PRES->>P: Approve or reject
  end

  P->>AUD: Persist decision trail
  P->>OU: Notify status update

  CIT->>P: Submit citizen request
  P->>P: Route to dedicated workflow
  P->>AUD: Persist full trace
  P->>CIT: Return progress/decision
```

## Request State Machine

```mermaid
stateDiagram-v2
  [*] --> SUBMITTED
  SUBMITTED --> IN_REVIEW: validate input
  IN_REVIEW --> FINANCE_REVIEW: financial check required
  FINANCE_REVIEW --> PRESIDENCY_REVIEW: amount > threshold
  FINANCE_REVIEW --> APPROVED: amount <= threshold
  PRESIDENCY_REVIEW --> APPROVED: presidential approval
  PRESIDENCY_REVIEW --> REJECTED: presidential rejection
  APPROVED --> IN_EXECUTION: start execution
  IN_EXECUTION --> COMPLETED: execution complete
  IN_REVIEW --> REJECTED: non-compliant request
  REJECTED --> [*]
  COMPLETED --> [*]
```

## Deployment Topology

```mermaid
flowchart TB
  subgraph DEV[Development]
    DEVAPP[Next.js App]
    DEVDB[(PostgreSQL via Docker Compose)]
    DEVAPP --> DEVDB
  end

  subgraph STG[Staging]
    STGWEB[Web Layer]
    STGAPI[API Runtime]
    STGDB[(Managed PostgreSQL)]
    STGOBS[Logs/Metrics]
    STGWEB --> STGAPI --> STGDB
    STGAPI --> STGOBS
  end

  subgraph PRD[Production]
    WAF[WAF + Load Balancer]
    WEB[Backoffice/Citizen Frontends]
    API[Application API]
    DB[(PostgreSQL HA)]
    STORE[(Document Storage)]
    OBS[Central Observability]

    WAF --> WEB --> API
    API --> DB
    API --> STORE
    API --> OBS
  end
```

## Project Structure

```text
app/                      # Next.js App Router pages/components
pages/api/                # API endpoints
prisma/
  schema.prisma           # Prisma data model
  migrations/             # SQL migrations
utils/                    # Auth, RBAC, workflow, notifications, utilities
public/branding/          # Branding assets
storage/                  # Local file storage
docs/                     # Architecture, operations, governance documents
```

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Docker + Docker Compose

### Local Setup

```bash
npm install
docker compose up -d postgres
cp .env.example .env.local
npm run prisma:deploy
npm run dev
```

Open: `http://localhost:3000`

### Minimum Environment Variables

```dotenv
DATABASE_URL="postgresql://stockly:stockly_password@localhost:5432/stockly?schema=public"
JWT_SECRET="change-me-in-development"
DEFAULT_TENANT_SLUG="default"
NEXT_PUBLIC_API_BASE_URL="/api"
```

## Go-live Checklist

This is the short, practical checklist to validate before going to staging/production.

### Already implemented in this repo

- [x] RBAC bootstrap (system permissions/roles) on session load
- [x] Scoped approvals by `requestingServiceId` (CHEFIA) + global final approval permissions
- [x] Two-step approvals UI: `/requests/aprovacoes` (chefia) and `/requests/aprovacoes-finais` (final)
- [x] Unified request creation flow: `DRAFT -> SUBMIT` (user intake + backoffice + external accept)
- [x] Ticket participants + `@username` mentions (auto-add participant on mention)
- [x] Minimal flow script: `npm run test:approval-2step`
- [x] RBAC management UI: `/governanca/permissoes` (custom roles + toggle permissions)

### Must confirm before go-live

- [ ] **Dependency security**: run `npm audit` and ensure there are no `critical/high` (or accept a documented exception)
- [ ] **Lockfile stability**: use `npm ci` in CI/CD (avoid `npm audit fix --force` in production branches)
- [ ] **Database migrations**: `npm run prisma:deploy` in staging/prod (never `migrate dev` in prod)
- [ ] **Secrets**: set a strong `JWT_SECRET` (required in production) and verify cookie security behind TLS
- [ ] **Tenant bootstrap**: validate `DEFAULT_TENANT_SLUG` and at least 1 admin user exists for that tenant
- [ ] **RBAC ops**: confirm at least one user has `users.manage` (break-glass path) and access is logged in RBAC audit
- [ ] **Performance sanity**: check browser Network tab for no requests stuck in `(pending)` and navigation stays responsive
- [ ] **Backups**: DB backup policy + restore test + rollback plan for migrations

### Recommended smoke commands (staging/prod)

```bash
npm ci
npm run prisma:deploy
npm run prisma:generate
npm run typecheck
npm run lint
```

### One-time operational backfills (optional but recommended)

- [ ] Ensure all users have `username` for `@username` mentions:
  - `npm run backfill:usernames -- --dry-run`
  - `npm run backfill:usernames`

## What Docker Compose Does

`docker compose up -d postgres` boots the PostgreSQL service defined in `docker-compose.yml`, which is required for Prisma migrations and local runtime.

Typical commands:

```bash
docker compose up -d postgres
docker compose ps
docker compose down
docker compose down -v
```

## Database Schema

### Core Entities

- Tenant, User, RequestingService
- Request, RequestItem, RequestStatusAudit
- PublicRequest, PublicRequestItem
- AccessRole, AccessPermission, UserRoleAssignment, RbacAudit
- WorkflowDefinition, WorkflowStateDefinition, WorkflowTransitionDefinition, WorkflowInstance, WorkflowEvent
- MunicipalAsset, MunicipalAssetEvent, MunicipalAssetAssignment
- FinanceProcess, FinanceProcessEvent
- PresidencyDispatch
- Notification, StoredFile

### Conceptual ER Diagram

```mermaid
erDiagram
  TENANT ||--o{ USER : has
  TENANT ||--o{ REQUEST : owns
  TENANT ||--o{ PUBLIC_REQUEST : owns
  TENANT ||--o{ ACCESS_ROLE : owns
  TENANT ||--o{ WORKFLOW_DEFINITION : owns
  TENANT ||--o{ MUNICIPAL_ASSET : owns
  TENANT ||--o{ FINANCE_PROCESS : owns

  REQUEST ||--o{ REQUEST_ITEM : contains
  REQUEST ||--o| WORKFLOW_INSTANCE : drives
  REQUEST ||--o| PRESIDENCY_DISPATCH : may_have

  PUBLIC_REQUEST ||--o{ PUBLIC_REQUEST_ITEM : contains
  PUBLIC_REQUEST ||--o| WORKFLOW_INSTANCE : may_drive

  ACCESS_ROLE ||--o{ USER_ROLE_ASSIGNMENT : grants
  ACCESS_PERMISSION ||--o{ ACCESS_ROLE_PERMISSION : links

  WORKFLOW_DEFINITION ||--o{ WORKFLOW_STATE_DEFINITION : has
  WORKFLOW_DEFINITION ||--o{ WORKFLOW_TRANSITION_DEFINITION : has
  WORKFLOW_INSTANCE ||--o{ WORKFLOW_EVENT : emits

  MUNICIPAL_ASSET ||--o{ MUNICIPAL_ASSET_EVENT : emits
  MUNICIPAL_ASSET ||--o{ MUNICIPAL_ASSET_ASSIGNMENT : assigned_to

  FINANCE_PROCESS ||--o{ FINANCE_PROCESS_EVENT : emits
```

## API Endpoints

### Auth and Session

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`

### Internal Requests

- `GET /api/requests`
- `POST /api/requests`
- `GET /api/requests/[id]`
- `PATCH /api/requests/[id]`

### Workflow

- `GET /api/workflows/requests/[id]/action`
- `POST /api/workflows/requests/[id]/action`

### Citizen Requests

- `POST /api/portal/requests`
- `GET /api/admin/public-requests`
- `POST /api/admin/public-requests/[id]/accept`
- `POST /api/admin/public-requests/[id]/reject`

### Assets

- `GET /api/governanca/assets`
- `POST /api/governanca/assets`
- `GET /api/governanca/assets/[id]`
- `PATCH /api/governanca/assets/[id]`

### Finance

- `GET /api/governanca/finance`
- `POST /api/governanca/finance`
- `GET /api/governanca/finance/[id]`
- `PATCH /api/governanca/finance/[id]`

### Presidency

- `POST /api/requests/[id]/presidency-dispatch`
- `POST /api/requests/[id]/presidency-decision`

### RBAC Administration

- `GET /api/admin/rbac/assignments`
- `POST /api/admin/rbac/assignments`
- `PATCH /api/admin/rbac/assignments`

## RBAC and Organizational Scope

Access control combines fine-grained permissions with organizational scope.

- Action-level permissions (`requests.approve`, `finance.manage`, `assets.manage`, etc.)
- Role composition based on permission sets
- User-role assignments scoped by Organizational Unit
- Context-aware validation for each transition/action

### Role Matrix (Ready to Use)

| Role | Key Permissions | Recommended Scope |
|---|---|---|
| `PRESIDENT` | `presidency.approve`, `requests.approve`, `requests.final_approve`, `requests.reject`, `requests.final_reject`, `requests.sign_approval`, `requests.dispatch_presidency`, `reports.view` | Global municipal scope |
| `VICE_PRESIDENT` | Same as `PRESIDENT` for formal substitution | Global municipal scope |
| `COUNCILOR` | `requests.approve`, `requests.final_approve`, `requests.reject`, `requests.final_reject`, `requests.sign_approval`, `requests.dispatch_presidency`, `finance.view`, `assets.view` | By portfolio / Organizational Unit |
| `DIVISION_HEAD` | `requests.create`, `requests.view`, `requests.approve`, `requests.reject`, `requests.sign_approval`, `requests.pickup_sign` | Division / Organizational Unit |
| `FINANCE_MANAGER` | `finance.manage`, `finance.view`, `requests.approve`, `requests.final_approve`, `requests.reject`, `requests.final_reject`, `reports.view` | Finance department or municipal global (policy-based) |
| `FINANCE_OFFICER` | `finance.manage`, `finance.view`, `requests.view` | Finance department operational scope |
| `ASSET_MANAGER` | `assets.manage`, `assets.view`, `requests.change_status`, `requests.pickup_sign`, `requests.void_pickup_sign` | Asset/patrimony management scope |
| `PROCUREMENT_OFFICER` | `requests.create`, `requests.view`, `finance.view`, `assets.view` | Procurement / supporting units |
| `SERVICE_MANAGER` | `requests.create`, `requests.view`, `requests.approve`, `requests.reject`, `requests.sign_approval`, `requests.pickup_sign`, `requests.dispatch_presidency` | Specific requesting service |
| `EXTERNAL_REQUEST_VIEWER` | `public_requests.view` | Citizen request monitoring units |
| `EXTERNAL_REQUEST_REVIEWER` | `public_requests.view`, `public_requests.handle` | Citizen request handling units |
| `SUPERVISOR_UO` | `requests.create`, `requests.view`, `public_requests.view`, `reports.view` | Specific Organizational Unit |
| `OPERATOR_UO` | `requests.create`, `requests.view` | Specific Organizational Unit |
| `AUDITOR` | `requests.view`, `assets.view`, `finance.view`, `public_requests.view`, `reports.view` | Read-only institutional/audit scope |
| `SUPPORT_ADMIN` | `users.manage`, `tickets.manage`, `reports.view` | Platform administration scope (non-political) |

Governance note: keep `ADMIN` as a technical/system role and enforce business decisions through scoped institutional roles above.

## Workflow Engine

The workflow engine is configuration-driven.

- `ProcessDefinition`: process type and version
- `ProcessStep`: states, transitions, required permissions
- `ProcessInstance`: runtime execution record

Capabilities include conditional rules, per-process flow variants, and immutable event history for every transition.

## Domain Breakdown

- `internal_requests`: internal service requests and approvals
- `citizen_requests`: citizen-facing submissions and routing
- `finance`: appropriation, commitment, authorization, payment
- `assets`: municipal asset registration, assignment, maintenance, disposal

## Security and Audit

- Server-side validated authenticated sessions
- CSRF protection for unsafe methods
- Tenant-level data isolation
- Scoped RBAC authorization
- IP allowlist / access request flow
- Login rate limiting and lockout
- Audit records and event trail for sensitive operations

## SLO/SLI and Observability

Recommended SLO targets:

- Availability: `99.9%` monthly
- API latency: `p95 < 500ms`
- Workflow transition reliability: `>= 99.99%`
- Notification delivery: `>= 99.5%`

Recommended SLIs:

- Uptime ratio
- p50/p95/p99 latency by endpoint group
- 4xx/5xx error rates by domain
- Workflow transition success/failure counters
- Queue depth and retry metrics (notifications/documents)
- DB health metrics (slow queries, lock contention, pool saturation)

Observability baseline:

- Structured logs with correlation IDs
- Domain dashboards and alerting
- Distributed tracing across critical workflows

## Architecture Decision Records

Maintain ADRs under `docs/architecture/adr/`.

Suggested initial ADRs:

- Domain separation strategy
- Workflow engine as core orchestration component
- RBAC with organizational scope
- Audit/event model as compliance baseline
- Storage strategy and migration path
- Deployment topology and security boundaries

## Roadmap

### Phase 1

- Granular RBAC and organizational scope
- Baseline security controls

### Phase 2

- Configurable workflow engine
- Migration of request lifecycle to workflow-based transitions

### Phase 3

- Asset lifecycle consolidation

### Phase 4

- Financial lifecycle consolidation

### Phase 5

- Citizen portal hardening and presidency decision traceability

## Contributing

1. Create a dedicated branch per feature/fix.
2. Run `npm run typecheck` and `npm run lint` before opening a PR.
3. For data model changes, add/update Prisma migrations.
4. Include API/UI evidence for behavior changes.
5. Keep documentation aligned with functional changes.

## Quality Commands

```bash
npm run prisma:generate
npm run typecheck
npm run lint
npm run prisma:deploy
```

## License

To be defined according to municipal institutional policy.
