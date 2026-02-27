# Critérios de Release — Staging e Produção (Municipal)

Este documento define os **critérios mínimos** para promover uma versão do CMCHUB para **staging** e **produção**.

## 1) Gate técnico (obrigatório)

- [ ] CI verde: lint + typecheck + build
- [ ] Migrações aplicam num DB limpo (pipeline valida com PostgreSQL efémero)
- [ ] Alterações de schema têm **plano de rollout** (compatibilidade app↔DB)

## 2) Segurança (obrigatório)

- [ ] Revisão explícita de RBAC/scope quando há mudanças em permissões/fluxos
- [ ] Sessão/cookies/CSRF verificados para endpoints unsafe (POST/PUT/PATCH/DELETE)
- [ ] `npm audit` executado antes de produção e exceções documentadas (se existirem)
- [ ] Segredos e ENV de produção definidos (sem defaults fracos)

## 3) Migrações e rollback (obrigatório)

- [ ] Comando de migração para produção definido: `npm run prisma:deploy`
- [ ] Backup de DB antes da janela de release (e **teste de restore** periódico)
- [ ] Plano de rollback:
  - [ ] rollback de aplicação (deploy anterior)
  - [ ] rollback de dados/migração (quando aplicável) ou estratégia “forward-only”

Ver: `docs/runbooks/database-migrations.md`.

## 4) Observabilidade e SLO (obrigatório)

- [ ] Logs estruturados com `x-request-id` úteis para troubleshooting
- [ ] Endpoint de health disponível para checks automatizados (`GET /api/health`)
- [ ] Dashboards/alertas mínimos definidos (erros 5xx, latência, saturação DB)
- [ ] SLO/SLI definidos para pelo menos:
  - autenticação/sessão
  - requests (aprovações/executar)
  - tickets

## 5) Runbooks e resposta a incidentes (obrigatório)

- [ ] Runbook de release (passo a passo) existe e está atualizado
- [ ] Runbook de migrações e rollback existe e está atualizado
- [ ] Processo de incident response definido (papéis, severidades, comunicação)

Ver: `docs/runbooks/incident-response.md`.

## 6) Qualidade funcional (obrigatório)

- [ ] Smoke test executado em staging com as personas (USER/MANAGEMENT/ADMIN)
- [ ] Fluxos críticos confirmados:
  - criação/submissão de request
  - aprovação chefia + aprovação final
  - execução/fulfillment (quando aplicável)
  - tickets (chat + participantes)
  - portal/incoming (quando aplicável)
- [ ] Sem regressões de permissões (acessos indevidos / bloqueios indevidos)

## 7) Compliance municipal (recomendado, mas esperado em produção)

- [ ] Retenção e acesso a logs/audit definidos (quem vê o quê, por quanto tempo)
- [ ] Evidência de auditoria (trail) preservada em transições críticas
- [ ] Plano de continuidade (backup, restore, fallback manual)

