# Stock Local

Aplicação local para gestão de stock, requisições internas e unidades físicas com QR. Esta branch (`ONLYLOCAL`) está orientada para uso de gabinete: manter o inventário organizado, registar entradas e saídas, controlar pedidos de material e saber rapidamente onde está cada equipamento.

## Objetivo

O sistema responde a perguntas operacionais simples:

- Que material existe em stock?
- Que unidades físicas existem para um produto?
- Quem levantou uma unidade?
- Que QR está reservado num pedido?
- Que fatura/REQ originou uma entrada?
- Que material uma pessoa tem atualmente ou já teve?
- Onde está a ficha completa de uma unidade quando se lê o QR?

## Stack

- Next.js 15
- React 19
- TypeScript
- Prisma 6
- PostgreSQL 16
- Tailwind CSS
- Docker Compose
- QR Code: `qrcode` e `@zxing/browser`
- PDF: `pdf-lib` e Chromium/Puppeteer para fluxos de impressão/exportação

## Serviços Docker

O `docker-compose.yml` sobe:

- `stock-app`: aplicação Next.js em produção
- `stock-postgres`: PostgreSQL 16

URLs locais:

- App: `http://localhost:3000`
- Healthcheck: `http://localhost:3000/api/health`
- PostgreSQL no host: `localhost:55432`

## Arranque Rápido

```bash
cp .env.example .env
npm install
npx prisma generate
docker compose up -d --build
```

Verificar:

```bash
docker compose ps
curl -fsS http://localhost:3000/api/health
```

Aplicar migrations quando houver alterações de schema:

```bash
npx prisma migrate deploy
```

Criar admin local:

```bash
npm run create-admin -- --email=admin@example.local --name=Admin --password=12345678
```

## Variáveis De Ambiente

Ver `.env.example`.

Principais:

- `DATABASE_URL`: ligação PostgreSQL.
- `JWT_SECRET`: segredo de sessão/API.
- `DEFAULT_TENANT_SLUG`: tenant usado por omissão.
- `NEXT_PUBLIC_API_BASE_URL`: normalmente `/api`.
- `NEXT_PUBLIC_APP_URL`: URL pública usada em QR/PDF, por exemplo `http://localhost:3000` ou domínio de produção.
- `NEXT_PUBLIC_PRINT_LOGO_URL`: logo opcional usado nas folhas de impressão.
- `TRUST_PROXY`: ativar se a app estiver atrás de reverse proxy.
- `ALLOWLIST_BOOTSTRAP_ADMIN`: ajuda no primeiro acesso quando a allowlist de IPs está vazia.
- `RATE_LIMIT_STORE`: `db` recomendado em Docker/produção.

Em Docker, a app usa `DATABASE_URL` interno para o serviço `postgres`. Fora do Docker, usar a porta exposta `55432`.

## Módulos Principais

### Produtos E Stock

Rotas:

- `/` - listagem de produtos
- `/products/[id]` - detalhe operacional do produto
- `/products/[id]/print-qr` - impressão em lote de QR das unidades

Funcionalidades:

- produto com categoria, fornecedor, SKU, descrição e preço;
- imagem principal do produto;
- stock agregado para produtos simples;
- unidades físicas com QR para produtos controlados individualmente;
- detalhe de faturas, REQ, movimentos e unidades;
- edição de S/N, P/N e Asset Tag por unidade.

### Entrada De Stock

Fluxo principal:

1. Registar fatura.
2. Registar produto ou associar ao produto.
3. Indicar quantidade.
4. Anexar fatura e REQ.
5. Criar unidades QR automaticamente, uma por unidade.

Para produtos com QR, cada unidade física é representada por um `ProductUnit`.

### Fornecedores

Rota:

- `/suppliers`

Permite manter os fornecedores usados nas entradas de stock e nas faturas. Um fornecedor pode ficar associado ao produto, aos documentos de compra e ao histórico visível nas folhas de pedido.

### Movimentos De Stock

Rota:

- `/movements`

Regista o histórico operacional:

- entradas de material;
- saídas por pedido;
- devoluções;
- reparações;
- abates;
- perdas.

Este histórico é a base para auditoria simples: perceber quando uma unidade entrou, saiu, voltou ou foi marcada com outro estado.

### Pedidos De Material

Rotas:

- `/requests` - backoffice de pedidos
- `/requests/novo` - criação backoffice
- `/requests/[id]` - detalhe do pedido
- `/requests/[id]/print` - folha A4 do pedido
- `/requests/[id]/labels` - etiquetas QR do pedido
- `/requests/estado` - pedidos do utilizador
- `/requests/estado/novo` - criação pelo utilizador

Regras importantes:

- Produto sem QR: `Qtd N` fica como uma linha normal.
- Produto com QR: `Qtd N` reserva `N` unidades diferentes.
- Cada linha interna fica com `Qtd=1` e QR distinto.
- QR reservado em pedido aberto não pode ser reutilizado noutro pedido.
- Ao assinar/finalizar, a unidade sai do stock e fica ligada ao histórico.

### Assinaturas E PDF Final

O pedido pode ter:

- assinatura/rubrica do técnico;
- assinatura do responsável no levantamento;
- PDF final assinado gerado automaticamente no storage;
- folha A4 com QR de verificação;
- QR de unidade destacado na tabela de materiais.

O PDF final é guardado em:

```text
storage/<tenantId>/Pedidos/<ano>/Requisicoes/<GTMI - requerente - resumo - data>/
```

### Scanner QR

Rota:

- `/units/scan`

Permite:

- ler QR pela câmara;
- colar código/link manualmente;
- abrir resumo da unidade;
- ver estado atual;
- ver a quem está entregue;
- ver último movimento;
- abrir ficha completa;
- devolver;
- enviar/receber reparação;
- marcar abatido;
- marcar perdido.

Os QR de unidade apontam para:

```text
/units/lookup?code=<codigo>
```

Essa rota resolve o código e redireciona para:

```text
/units/<id>
```

### Unidades E Reservas

Rotas:

- `/units/[id]` - ficha da unidade
- `/units/lookup?code=...` - resolver QR por código
- `/units/reservations` - reservas QR em pedidos abertos

Estados principais de unidade:

- `IN_STOCK`
- `ACQUIRED`
- `IN_REPAIR`
- `SCRAPPED`
- `LOST`

Movimentos principais:

- `IN`
- `OUT`
- `RETURN`
- `REPAIR_OUT`
- `REPAIR_IN`
- `SCRAP`
- `LOST`

### Relatórios

Rota:

- `/reports/person`

Permite consultar por pessoa:

- unidades atuais;
- produtos sem QR em posse;
- histórico de movimentos;
- pedidos relacionados;
- exportação CSV.

### Utilizadores, Departamentos E Permissões

Rotas:

- `/users`
- `/employees`

Inclui:

- utilizadores;
- funcionários;
- departamentos/serviços requisitantes;
- permissões/RBAC;
- allowlist de IPs;
- pedidos de acesso por IP.

Permissões frequentes:

- `requests.create`
- `requests.view`
- `requests.change_status`
- `requests.pickup_sign`
- `assets.view`
- `assets.manage`
- `assets.create`
- `assets.move`
- `assets.dispose`
- `users.manage`
- `reports.view`

## Storage

Novos ficheiros são organizados por tenant.

Pedidos:

```text
storage/<tenantId>/Pedidos/<ano>/Requisicoes/<GTMI - requerente - resumo - data>/
```

Stock:

```text
storage/<tenantId>/Stock/Produtos/<Produto - Categoria - Fornecedor - DataCriacao>/
```

Dentro da pasta do produto:

```text
Faturas/
Req/
Imagens/
```

Nomes de anexos novos:

- Fatura: inclui número da fatura, data da fatura, REQ, data da REQ e data de importação.
- REQ: fica em `Req/`.
- Imagem do produto: fica em `Imagens/`.

Downloads continuam a ser feitos via:

```text
/api/storage/[id]
```

## APIs Relevantes

Produtos e stock:

- `GET /api/products`
- `POST /api/products`
- `PUT /api/products`
- `GET /api/products/[id]`
- `POST /api/products/[id]/image`
- `POST /api/intake`
- `GET /api/stock-movements`

Unidades:

- `GET /api/units`
- `GET /api/units/[id]`
- `PATCH /api/units/[id]`
- `GET /api/units/lookup?code=...`
- `GET /api/units/available`
- `GET /api/units/reservations`
- `POST /api/units/acquire`
- `POST /api/units/return`
- `POST /api/units/action`

Pedidos:

- `GET /api/requests`
- `POST /api/requests`
- `GET /api/requests/[id]`
- `PATCH /api/requests/[id]`
- `POST /api/requests/[id]/execute`
- `POST /api/workflows/requests/[id]/action`

Storage:

- `GET /api/storage`
- `POST /api/storage`
- `GET /api/storage/[id]`
- `DELETE /api/storage/[id]`

Relatórios:

- `GET /api/reports/person-assets`

## Comandos Úteis

Desenvolvimento:

```bash
npm run dev
```

Typecheck:

```bash
npm run typecheck
```

Build:

```bash
npm run build
```

Prisma:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
npm run prisma:studio
```

Docker:

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f app
docker compose down
```

Health:

```bash
curl -fsS http://localhost:3000/api/health
```

## Fluxos De Teste Manuais

### Entrada Com QR

1. Criar produto/entrada com quantidade `N`.
2. Anexar fatura e REQ.
3. Confirmar que são criadas `N` unidades QR.
4. Abrir `/products/[id]` e validar unidades.
5. Imprimir QR em `/products/[id]/print-qr`.

### Pedido Com Qtd N

1. Criar pedido com produto controlado por QR e `Qtd 5`.
2. Usar reserva automática.
3. Confirmar que aparecem 5 linhas de `Qtd=1`.
4. Confirmar que cada linha tem QR diferente.
5. Criar segundo pedido e validar que não reutiliza os QR reservados.

### Finalização

1. Abrir pedido aprovado.
2. Confirmar QR reservados.
3. Assinar técnico.
4. Assinar levantamento.
5. Validar estado `FULFILLED`.
6. Validar movimentos `OUT`.
7. Validar PDF final no storage.

### Scanner QR

1. Abrir `/units/scan`.
2. Ler uma etiqueta QR ou colar código manualmente.
3. Confirmar resumo da unidade.
4. Testar ação rápida adequada ao estado.

## Notas De Produção

- Definir `NEXT_PUBLIC_APP_URL` com o domínio real; isto é essencial para QR em etiquetas/PDF.
- Usar `JWT_SECRET` forte e único.
- Manter `ALLOWLIST_BOOTSTRAP_ADMIN=false` depois do primeiro arranque.
- Garantir backup do volume PostgreSQL.
- Garantir backup da pasta `storage`.
- Aplicar migrations com `npx prisma migrate deploy` antes ou durante deploy.
- O acesso por câmara ao scanner QR pode exigir HTTPS em browsers modernos, exceto em `localhost`.

## Escopo Da Branch ONLYLOCAL

Esta branch mantém o foco em stock local e pedidos internos. A base ainda contém modelos históricos mais amplos no Prisma, mas o produto final aqui deve ser simples:

- inventário;
- entradas;
- saídas;
- fornecedores;
- pedidos;
- unidades QR;
- assinaturas;
- PDF/storage;
- relatórios operacionais.

Módulos amplos como tickets, portal público, governança, business insights, financiamento e documentação API não são o foco desta branch.
