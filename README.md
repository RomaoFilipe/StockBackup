<p align="center">
  <img src="public/branding/logo2.png" alt="CMCHUB" width="160" />
</p>

# CMCHUB — Municipal Operations Hub

CMCHUB is a **municipal operations hub**: it centralizes **Requests**, **Tickets**, **Incoming (Portal)**, **Inventory/Assets**, **Approvals**, and **Audit**, with **service/department-scoped RBAC** and a **configurable workflow engine** to guarantee traceability.

> Goal: a single municipal platform for requests, approvals, assets, and compliance-grade audit trails.

## Table of Contents

- [At a Glance](#at-a-glance)
- [Personas](#personas)
- [Core Capabilities](#core-capabilities)
- [Key Flows](#key-flows)
- [Request Workflow (Internal Requests)](#request-workflow-internal-requests)
- [Request State Machine](#request-state-machine)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Go-live Checklist](#go-live-checklist)
- [Definition of Done & Release Criteria](#definition-of-done--release-criteria)
- [Technology Stack](#technology-stack)
- [Deployment Topology](#deployment-topology)
- [Architecture Overview](#architecture-overview)
- [Architecture Diagram](#architecture-diagram)
- [Operational Workflow Diagram](#operational-workflow-diagram)
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

## At a Glance

CMCHUB is built for real municipal constraints: **departments**, **management approvals**, **scope-based authorization**, evidence-driven decisions, and a complete “who did what and when” history.

**What it solves:**
- Reduces manual work (email/Excel) with end-to-end flows
- Prevents “random access” with consistent permissions
- Improves response time with queues (“Pending for me”) and SLAs
- Ensures traceability (workflow + audit)

**Main screens:**
- `Requests`: create, track, approvals (department + final), history
- `Tickets`: support/triage, chat and participants, linked requests
- `Incoming (Portal)`: external intake and legacy history
- `Inventory/Assets`: catalog, units/equipment, movements
- `Reports`: exports and audit views

## Personas

These personas drive the menu and RBAC (menu items show/hide based on permissions):

| Persona | Objetivo | Acesso (resumo) |
|---|---|---|
| `USER` (worker) | “My work” | My requests, my tickets, incoming items assigned to me, MyDesktop |
| `MANAGEMENT` (division/office heads) | Department management | Everything from USER + department requests, pending approvals, department reports |
| `ADMIN` (platform) | Technical/platform ops | Catalogs, RBAC, global audit, technical management and support |

Note: `ADMIN` should not be a “business bypass”; operational decisions must be enforced via permissions and scope.

## Core Capabilities

- Internal requests with workflow (DRAFT → department approval → final approval → execution) and auditability
- Approvals scoped by service (`requestingServiceId`) plus global final-approval permissions
- Tickets with chat, participants, and `@username` mentions, with bidirectional Ticket ↔ Request linking
- Incoming (portal) for external intake + legacy history
- Inventory/Assets with movements, audit, and reporting
- RBAC with roles/permissions (scoped) and audit trail (RBAC audit)
- Multi-tenant isolation (`tenantId`)

## Key Flows

### Internal Requests (Pedidos)

- **Create** a request (user intake or backoffice) → starts as `DRAFT` and is submitted (`SUBMITTED`)
- **Management** approves (only for requests belonging to the service(s) they manage) → `AWAITING_ADMIN_APPROVAL`
- **Final** (platform/admin or another role with `requests.final_*`) decides → `APPROVED/REJECTED`
- **Execution**/delivery/pickup → `FULFILLED` (when applicable)

### Tickets

- Per-ticket chat with **participants** (followers) and `@username` mentions (auto-add)
- Triage by status/priority and Ticket ↔ Request linking (single place for context)

### Incoming (Portal) (Recebidos)

- External intake creates `PublicRequest` (portal) and is managed in `/governanca/recebidos`

### Inventory/Assets (Inventário/Património)

- Catalog (products/categories/suppliers), units/equipment and movements
- Audit and reporting by period/service

## Request Workflow (Internal Requests)

The system uses 2 layers:
- `Request.status` (a simple request state)
- `WorkflowInstance.currentState` (the workflow state, used to distinguish “under management validation” vs “awaiting final approval”, etc.)

Key rule for management:
- A user with `requests.approve` can only approve requests where `requestingServiceId` is within the services they manage (scope).

## Request State Machine

The real (simplified) internal requests workflow:

```mermaid
stateDiagram-v2
  [*] --> DRAFT
  DRAFT --> SUBMITTED: submit
  SUBMITTED --> AWAITING_ADMIN_APPROVAL: chefia approve
  SUBMITTED --> REJECTED: chefia reject
  AWAITING_ADMIN_APPROVAL --> APPROVED: final approve
  AWAITING_ADMIN_APPROVAL --> REJECTED: final reject
  APPROVED --> FULFILLED: execution/fulfillment
  REJECTED --> [*]
  FULFILLED --> [*]
```

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
  P->>P: Create WorkflowInstance
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

## Definition of Done & Release Criteria

Para evitar o “já faz tudo” mas ainda não está “fechado” (pronto para produção municipal), os critérios vivem em:
- `docs/definition-of-done.md`
- `docs/release-criteria.md`

E são aplicados no fluxo via template de PR e checklist de release:
- `.github/pull_request_template.md`
- `.github/ISSUE_TEMPLATE/release.md`

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
- `GET /api/admin/rbac/roles`
- `POST /api/admin/rbac/roles`
- `PATCH /api/admin/rbac/roles/[id]`
- `DELETE /api/admin/rbac/roles/[id]`
- `PATCH /api/admin/rbac/roles/[id]/permissions`

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

The workflow is **configurable** per tenant and acts as the decision/audit backbone.

- `WorkflowDefinition`: workflow type + version
- `WorkflowStateDefinition`: states (with `isInitial/isTerminal`)
- `WorkflowTransitionDefinition`: transitions (with `requiredPermission`)
- `WorkflowInstance`: runtime instance per request (`currentState`)
- `WorkflowEvent`: immutable events per transition/action

Transitions are executed through **actions** (API `.../action`) and are always validated server-side by permission and scope.

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
