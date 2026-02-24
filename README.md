# CMCHUB Platform (StockBackup)

[![Next.js](https://img.shields.io/badge/Next.js-15-black)](#)
[![React](https://img.shields.io/badge/React-19-149eca)](#)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2d3748)](#)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178c6)](#)

## Table of Contents

- [PT — Visão Geral](#pt--visão-geral)
- [PT — Módulos](#pt--módulos)
- [PT — Diagrama Técnico](#pt--diagrama-técnico)
- [PT — Mapa de Estados](#pt--mapa-de-estados)
- [PT — Diagrama Operacional](#pt--diagrama-operacional)
- [PT — Setup Rápido](#pt--setup-rápido)
- [EN — Overview](#en--overview)
- [EN — Modules](#en--modules)
- [EN — Technical Diagram](#en--technical-diagram)
- [EN — State Machine](#en--state-machine)
- [EN — Operational Diagram](#en--operational-diagram)
- [Project Structure](#project-structure)
- [Quality Checklist](#quality-checklist)
- [Contributing](#contributing)
- [License](#license)

---

## PT — Visão Geral

Plataforma municipal para **gestão de requisições, património, financiamento e despacho institucional**, com auditoria, RBAC granular, workflow de estados e operação multi-tenant.

### PT — Módulos

- Requisições (criação, aprovação, rejeição, cumprimento)
- Workflow (state machine com transições por permissão)
- RBAC (papéis e permissões por serviço)
- Património (ativos, afetação, ciclo de vida)
- Financiamento (cabimento, compromisso, aprovação, pagamento)
- Portal Externo (submissão de requerimentos)
- Presidência (despacho e decisão)

### PT — Diagrama Técnico

```mermaid
flowchart LR
  UI[Web App Next.js] --> API[API Routes]
  API --> AUTH[Auth, CSRF, IP Allowlist, RBAC]
  API --> WF[Workflow Engine]
  API --> REQ[Requests Domain]
  API --> ASSET[Assets Domain]
  API --> FIN[Finance Domain]
  API --> PUB[Public Portal Domain]
  API --> TKT[Tickets/SLA Domain]

  AUTH --> DB[(PostgreSQL)]
  WF --> DB
  REQ --> DB
  ASSET --> DB
  FIN --> DB
  PUB --> DB
  TKT --> DB

  API --> STORAGE[(Storage local /storage)]
```

### PT — Mapa de Estados

```mermaid
stateDiagram-v2
  [*] --> SUBMITTED
  SUBMITTED --> APPROVED: APPROVE
  SUBMITTED --> REJECTED: REJECT
  APPROVED --> FULFILLED: FULFILL
  APPROVED --> REJECTED: REJECT
  REJECTED --> [*]
  FULFILLED --> [*]
```

### PT — Diagrama Operacional

```mermaid
sequenceDiagram
  participant U as Utilizador/Serviço
  participant P as Plataforma
  participant PR as Presidência
  participant F as Finanças
  participant A as Património

  U->>P: Criar Requisição
  P->>P: Iniciar Workflow (SUBMITTED)
  P->>PR: Despacho Presidencial
  PR->>P: Aprovar/Rejeitar
  P->>F: Iniciar Processo Financeiro
  F->>P: Evoluir estado financeiro
  P->>A: Registar/afetar ativos
  P->>P: Fecho operacional e auditoria
```

### PT — Setup Rápido

```bash
npm install
docker compose up -d postgres
cp .env.example .env.local
npm run prisma:deploy
npm run dev
```

Abrir: `http://localhost:3000`

### PT — Variáveis Essenciais

```dotenv
DATABASE_URL="postgresql://stockly:stockly_password@localhost:5432/stockly?schema=public"
JWT_SECRET="change-me-in-development"
DEFAULT_TENANT_SLUG="default"
NEXT_PUBLIC_API_BASE_URL="/api"
```

### PT — Rotas Principais

- UI: `/`, `/governanca`, `/governanca/patrimonio`, `/governanca/financiamento`, `/governanca/requerimentos`, `/governanca/permissoes`, `/portal/requerimentos`
- API: `/api/requests`, `/api/workflows/requests/[id]/action`, `/api/governanca/assets`, `/api/governanca/finance`, `/api/portal/requests`, `/api/requests/[id]/presidency-dispatch`, `/api/requests/[id]/presidency-decision`

---

## EN — Overview

Municipal platform for **requests, asset management, finance operations, and presidential dispatch workflows**, with auditing, granular RBAC, state-machine workflows, and multi-tenant operation.

### EN — Modules

- Requests (create, approve, reject, fulfill)
- Workflow engine (permission-driven state machine)
- RBAC (role and permission scope by requesting service)
- Assets (lifecycle, assignment, status transitions)
- Finance (budget commitment through payment)
- External Portal (public request submission)
- Presidency (formal dispatch and decision)

### EN — Technical Diagram

```mermaid
flowchart LR
  UI[Next.js Web App] --> API[API Routes]
  API --> AUTH[Auth, CSRF, IP Allowlist, RBAC]
  API --> WF[Workflow Engine]
  API --> REQ[Requests Domain]
  API --> ASSET[Assets Domain]
  API --> FIN[Finance Domain]
  API --> PUB[Public Portal Domain]
  API --> TKT[Tickets/SLA Domain]

  AUTH --> DB[(PostgreSQL)]
  WF --> DB
  REQ --> DB
  ASSET --> DB
  FIN --> DB
  PUB --> DB
  TKT --> DB

  API --> STORAGE[(Local storage /storage)]
```

### EN — State Machine

```mermaid
stateDiagram-v2
  [*] --> SUBMITTED
  SUBMITTED --> APPROVED: APPROVE
  SUBMITTED --> REJECTED: REJECT
  APPROVED --> FULFILLED: FULFILL
  APPROVED --> REJECTED: REJECT
  REJECTED --> [*]
  FULFILLED --> [*]
```

### EN — Operational Diagram

```mermaid
sequenceDiagram
  participant U as User/Service
  participant P as Platform
  participant PR as Presidency
  participant F as Finance
  participant A as Assets

  U->>P: Create request
  P->>P: Start workflow (SUBMITTED)
  P->>PR: Send presidential dispatch
  PR->>P: Approve/Reject
  P->>F: Start finance process
  F->>P: Progress finance status
  P->>A: Register/assign assets
  P->>P: Operational closure + audit
```

### EN — Quick Start

```bash
npm install
docker compose up -d postgres
cp .env.example .env.local
npm run prisma:deploy
npm run dev
```

Open: `http://localhost:3000`

### EN — Required Environment Variables

```dotenv
DATABASE_URL="postgresql://stockly:stockly_password@localhost:5432/stockly?schema=public"
JWT_SECRET="change-me-in-development"
DEFAULT_TENANT_SLUG="default"
NEXT_PUBLIC_API_BASE_URL="/api"
```

### EN — Core Routes

- UI: `/`, `/governanca`, `/governanca/patrimonio`, `/governanca/financiamento`, `/governanca/requerimentos`, `/governanca/permissoes`, `/portal/requerimentos`
- API: `/api/requests`, `/api/workflows/requests/[id]/action`, `/api/governanca/assets`, `/api/governanca/finance`, `/api/portal/requests`, `/api/requests/[id]/presidency-dispatch`, `/api/requests/[id]/presidency-decision`

---

## Project Structure

```text
app/                      # UI (App Router)
pages/api/                # Backend endpoints
prisma/schema.prisma      # Data model
prisma/migrations/        # SQL migrations
utils/                    # Auth, RBAC, workflow, helpers
storage/                  # Local file storage
```

## Quality Checklist

```bash
npm run prisma:generate
npm run typecheck
npm run lint
npm run prisma:deploy
```

## Contributing

1. Create a dedicated branch for each feature/fix.
2. Run `npm run typecheck` and `npm run lint` before opening a PR.
3. For data model changes, add/update Prisma migrations and document impacts.
4. Include API/UI evidence for functional changes (screenshots or request/response examples).
5. Keep README and operational notes updated when behavior changes.

## License

Define according to institutional policy.
