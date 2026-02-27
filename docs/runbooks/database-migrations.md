# Runbook — Migrações de Base de Dados (Prisma)

## Princípios
- Produção usa `prisma migrate deploy` (nunca `migrate dev`)
- Migrações devem ser **previsíveis** e com plano de rollback (ou “forward-only” documentado)

## Staging/Produção — aplicar migrações

1) Garantir `DATABASE_URL` correto no ambiente.
2) Aplicar migrações:

```bash
npm ci
npm run prisma:deploy
```

3) Confirmar aplicação funciona (smoke) e monitorizar erros/latência.

## Rollback (estratégias)

### A) Rollback de aplicação (preferido)
Reverter para o deploy anterior quando a migração for compatível e o problema estiver no código.

### B) Rollback de schema/dados (casos específicos)
Depende do tipo de migração (ex.: drop/rename/transform). Requer:
- backup antes da janela
- script(s) de reversão aprovados e testados em staging

> Prisma não gera rollback automático seguro para todos os casos. Quando necessário, tratar como “change management” com scripts SQL e teste em staging.

