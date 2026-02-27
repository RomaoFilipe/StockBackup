# Runbook — Resposta a Incidentes (CMCHUB)

## Objetivo
Restaurar serviço com segurança, preservar evidência (audit/logs) e comunicar impacto de forma clara.

## Severidades (sugestão)
- **SEV-1**: indisponibilidade total / impacto crítico municipal
- **SEV-2**: degradação severa / impacto em fluxos críticos
- **SEV-3**: impacto limitado / workaround disponível

## Checklist (durante o incidente)
- [ ] Declarar severidade e “incident lead”
- [ ] Definir canal de comunicação (interno) e status updates (cadência)
- [ ] Capturar `x-request-id` e exemplos de requests afetados
- [ ] Consultar logs (JSON) filtrando por `requestId`
- [ ] Verificar saúde do sistema (`GET /api/health`)
- [ ] Se houver risco de corrupção de dados: **pausar operações** (feature flag / bloqueio operacional)
- [ ] Mitigação rápida: rollback de aplicação (deploy anterior) quando apropriado

## Pós-incidente (até 48h)
- [ ] Postmortem curto: causa raiz, timeline, impacto, ações
- [ ] Ação preventiva: alerta/métrica/runbook/CI gate ajustado

