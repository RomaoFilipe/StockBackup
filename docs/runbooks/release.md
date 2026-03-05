# Runbook — Release (staging → produção)

## Antes da janela
- [ ] CI verde (lint/typecheck/build)
- [ ] Verificar dependências (`npm audit`) e documentar exceções
- [ ] Confirmar plano de migração/rollback (se aplicável)
- [ ] Confirmar responsáveis e canal de comunicação

## Na janela
- [ ] Backup DB (antes da migração)
- [ ] Deploy de aplicação para staging
- [ ] Aplicar migrações: `npm run prisma:deploy`
- [ ] Smoke test em staging (fluxos críticos + permissões)
- [ ] Promover para produção
- [ ] Verificar `GET /api/health` e métricas/erros

## Depois
- [ ] Monitorizar 30–60 min (erros, latência, queues)
- [ ] Registar versão e resultados do smoke

