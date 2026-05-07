# Stock Local

Aplicacao local para gabinete, focada apenas em:

- Inventario de stock
- Entradas de material
- Saidas/devolucoes de material
- Criacao e acompanhamento de pedidos de material
- Gestao local de utilizadores, permissoes e IPs autorizados

Esta branch chama-se `ONLYLOCAL` e removeu o escopo mais amplo da base anterior: tickets, portal publico, governanca, patrimonio, financiamento, relatorios, business insights, MyDesktop, scan/substituicoes, presenca, documentacao API/DB e ferramentas administrativas de storage.

## Estado atual

A app corre em Docker com:

- `stock-app`: Next.js em modo producao
- `stock-postgres`: PostgreSQL 16

URLs locais:

- Site: `http://localhost:3000`
- Base de dados: `localhost:55432`
- Healthcheck: `http://localhost:3000/api/health`

Credenciais locais atuais:

- Email: `admin@gmail.com`
- Password: `12345678`

## Arranque com Docker

```bash
docker compose up -d --build
```

Ver estado dos containers:

```bash
docker compose ps
```

Ver logs da app:

```bash
docker compose logs -f app
```

Parar:

```bash
docker compose down
```

## Rotas principais

Rotas da aplicacao:

- `/` - produtos e inventario
- `/products/[id]` - detalhe do produto
- `/products/[id]/print-qr` - impressao de codigos das unidades
- `/movements` - movimentos de stock
- `/requests` - pedidos de material
- `/requests/novo` - criar pedido no backoffice
- `/requests/[id]` - detalhe do pedido
- `/requests/[id]/print` - impressao do pedido
- `/requests/estado` - area de pedidos do utilizador
- `/requests/estado/novo` - novo pedido do utilizador
- `/users` - utilizadores, permissoes e acessos

APIs mantidas:

- Autenticacao e sessao
- Produtos, categorias, fornecedores e anexos
- Entrada de stock via `intake`
- Movimentos de stock
- Pedidos de material e workflow associado
- Utilizadores, RBAC e allowlist de IPs
- Healthcheck

## Comandos de verificacao

```bash
npm run typecheck
npm run build
```

Teste rapido da app local:

```bash
curl -s http://localhost:3000/api/health
```

## Variaveis de ambiente

Ver `.env.example` para a configuracao base. Em Docker, a app usa PostgreSQL no servico `postgres`; fora do Docker, a porta local exposta e `55432`.

## Notas de escopo

Esta versao nao pretende ser uma plataforma municipal completa. O objetivo e manter a aplicacao pequena, operacional e facil de gerir dentro do gabinete: stock, entradas, saidas e pedidos.

Os modelos antigos ainda podem existir na base de dados/migracoes historicas, mas os ecras e endpoints aplicacionais dos modulos removidos foram retirados desta branch.
