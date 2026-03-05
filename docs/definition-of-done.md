# Definition of Done (DoD) — CMCHUB

Este documento define o que significa “feito” no CMCHUB para **features**, **correções** e **alterações operacionais**.

> Nota: **“Compila e passa lint/typecheck/build” é necessário, mas não suficiente** para “pronto para produção municipal”.

## 1) DoD para qualquer mudança (mínimo)

### Qualidade e CI
- [ ] `npm run lint` passa
- [ ] `npm run typecheck` passa
- [ ] `npm run build` passa
- [ ] CI verde no PR (ver `.github/workflows/ci.yml`)

### Segurança (mínimo)
- [ ] Autorização aplicada (RBAC + scope) em qualquer endpoint/ação relevante
- [ ] Validação de input (ex.: Zod) em endpoints que recebem payload
- [ ] Dados sensíveis não aparecem em logs nem respostas (PII / credenciais / tokens)
- [ ] Mudanças em autenticação/sessão/CSRF explicitamente revisadas

### Dados, consistência e idempotência
- [ ] Operações com efeitos colaterais têm comportamento idempotente quando aplicável (ou é documentado porquê não)
- [ ] Regras de integridade/uniqueness no DB quando aplicável (Prisma + constraints)
- [ ] Alterações de schema incluem migração e plano de rollout (ver `docs/runbooks/database-migrations.md`)

### Observabilidade (mínimo)
- [ ] Logs estruturados (JSON) para ações críticas e erros
- [ ] O `x-request-id` é preservado/propagado e aparece em logs quando relevante
- [ ] Endpoints novos/alterados têm sinais mínimos para troubleshooting (logs + códigos de erro consistentes)

### Operação (mínimo)
- [ ] “Como testar” descrito no PR (passos/smoke)
- [ ] Config/ENV documentada quando alterada (README + `.env.example`)
- [ ] Mudanças que afetam operação incluem atualização de runbook (ver `docs/runbooks/`)

## 2) DoD para mudanças com impacto em produção

Além do “mínimo”, para qualquer mudança que possa afetar produção (schema, fluxos críticos, permissões, tickets/requests, inventário, relatórios, portal):

- [ ] Critérios de aceitação verificados com uma persona relevante (USER / MANAGEMENT / ADMIN)
- [ ] Backwards compatibility analisada (clientes, rotas, payloads)
- [ ] Plano de rollback definido (aplicação + dados), com passos executáveis
- [ ] Risco comunicado (impacto, janela, dependências, plano de mitigação)

## 3) DoD para correções de incidentes (hotfix)

- [ ] Causa raiz identificada (mesmo que preliminar) e documentada no ticket/incidente
- [ ] Métrica/sinal de detecção definido (como evitar “regressão silenciosa”)
- [ ] Runbook atualizado se o incidente revelou lacuna operacional

