# Runbook — Observabilidade (mínimo)

## Objetivo
Ter sinais suficientes para diagnosticar e responder a problemas em ambiente municipal (produção).

## Logs
- Logs são JSON e devem incluir `x-request-id` (request correlation).
- Em incidentes, pedir sempre: `timestamp`, `requestId`, rota e utilizador (se aplicável).

## Health checks
- `GET /api/health` valida:
  - processo em execução
  - conectividade DB (SELECT 1 com timeout)

## Alertas mínimos (recomendado)
- Taxa de 5xx (API)
- Latência p95/p99 (API)
- Erros de DB / saturação de conexões
- Falhas de login/session (picos)

