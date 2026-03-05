## O que muda

## Porquê

## Como testar

## Checklist (DoD / Release)
- [ ] CI verde (lint/typecheck/build)
- [ ] Segurança: RBAC/scope + validação de input onde aplicável
- [ ] Dados: migração/plano de rollout/rollback se houve alteração de schema
- [ ] Observabilidade: logs úteis + `x-request-id` para troubleshooting
- [ ] Runbook atualizado (se houver impacto operacional)

Referências:
- `docs/definition-of-done.md`
- `docs/release-criteria.md`
