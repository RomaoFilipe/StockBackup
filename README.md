# Stockly (StockBackup)

Aplicação de **gestão de stock e requisições** (Next.js + Prisma + PostgreSQL).

Inclui:
- Produtos, categorias, fornecedores e unidades
- Requisições (aprovação, assinatura de aprovação e assinatura de levantamento)
- Movimentos de stock
- Upload/download de anexos com storage local em disco (`storage/`)

## Requisitos

- Node.js 20+ (recomendado)
- PostgreSQL 16+ (recomendado via Docker)
- Docker + Docker Compose (opcional, mas recomendado para a BD)

## Quick start (local)

```bash
# 1) Dependências
npm install

# 2) Base de dados (Postgres)
docker compose up -d postgres

# 3) Env
cp .env.example .env.local

# 4) Migrations
npm run prisma:deploy

# 5) Dev
npm run dev
```

Abrir: http://localhost:3000

## Variáveis de ambiente (`.env.local`)

O projeto lê variáveis do `.env.local` (recomendado). Podes começar pelo mínimo e depois ir adicionando opcionais conforme a tua instalação.

`.env.local` mínimo:

```dotenv
DATABASE_URL="postgresql://stockly:stockly_password@localhost:5432/stockly?schema=public"
JWT_SECRET="change-me-in-development"
```

Opcionais mais comuns (ver também `.env.example`):

```dotenv
# URL pública/base da aplicação (usado para gerar links/impressões em algumas páginas)
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Multi-tenant: tenant por defeito quando o cliente não envia x-tenant-slug
DEFAULT_TENANT_SLUG="default"

# CORS no login para origens diferentes (comma-separated). ALLOWED_ORIGINS é aceite como alias.
# CORS_ALLOWED_ORIGINS="http://localhost:3000"

# Se estiveres atrás de reverse proxy/load balancer (x-forwarded-for)
TRUST_PROXY="false"

# Evita lockout inicial do ADMIN quando a allowlist de IPs está vazia (usar temporariamente)
ALLOWLIST_BOOTSTRAP_ADMIN="false"

# Rate limit distribuído (recomendado em produção com múltiplas instâncias)
# Use "db" para guardar contadores na base de dados.
# RATE_LIMIT_STORE="db"

# Logging estruturado (opcional)
# LOG_LEVEL="info"

# Base URL da API no browser (normalmente deixa "/api")
NEXT_PUBLIC_API_BASE_URL="/api"

# Logo opcional para páginas de impressão
# NEXT_PUBLIC_PRINT_LOGO_URL="https://example.com/logo.png"
```

## Base de dados

Subir o Postgres via Docker:

```bash
docker compose up -d postgres
docker compose ps
```

Parar/remover volumes (apaga dados):

```bash
docker compose down -v
```

## Migrations (Prisma)

- Aplicar migrations existentes:

```bash
npm run prisma:deploy

# (Opcional) validar tipagem localmente
npm run typecheck
```

- Criar nova migration (dev):

```bash
npm run prisma:migrate
```

## Executar

Desenvolvimento:

```bash
npm run dev
```

Produção (local/servidor):

```bash
npm run build
npm run prisma:deploy
npm run start
```

## Primeiro login / bootstrap (importante)

- **Registo público está desativado** por design: `/api/auth/register` devolve `403`.
- Em base de dados vazia, é necessário criar **Tenant + primeiro utilizador ADMIN** diretamente na BD.

Passo-a-passo (manual, via Prisma Studio):

1) Abrir Prisma Studio:
```bash
npm run prisma:studio
```

2) Criar um `Tenant` (ex.: `slug=default`, `name=Default`).

3) Criar um `User` com:
- `tenantId`: o `id` do Tenant
- `role`: `ADMIN`
- `email`, `name`
- `passwordHash` (na BD está mapeado para a coluna `password`) com bcrypt

Gerar hash bcrypt (exemplo):

```bash
node -e "const bcrypt=require('bcryptjs'); bcrypt.hash('Admin123!', 10).then(h=>console.log(h))"
```

4) Fazer login na UI.

## Allowlist de IPs no login

O login valida IPs permitidos.
- Se vires `IP não autorizado`, o sistema cria um pedido de acesso para aprovação.
- Para evitar lockout inicial em ambientes novos, podes usar bootstrap (ADMIN + allowlist vazia):
  - Define `ALLOWLIST_BOOTSTRAP_ADMIN="true"` temporariamente.
  - Faz login com um ADMIN (o IP atual é adicionado).
  - Volta a `false` depois de configurar a allowlist.

Se estiveres atrás de proxy/load balancer, valida também `TRUST_PROXY`.

## Storage (uploads)

- Ficheiros são guardados localmente em `storage/` (disco) e indexados no Postgres.
- Em Linux/EC2, garante permissões de escrita na pasta `storage/` para o utilizador que corre o Node.

## Scripts úteis

```bash
npm run lint
npm run prisma:studio
npm run prisma:generate
```

## Rotas úteis

- UI: `/`
- API docs: `/api-docs`
- API status: `/api-status`
- Insights operacionais: `/business-insights`

## Arquitetura e fluxos

- Diagrama funcional atual da app: `docs/diagrama-fluxo-app.md`
