---
name: Release
about: Checklist de promoção para staging/produção
title: "Release: vX.Y.Z (staging → produção)"
labels: ["release"]
---

## Versão
- Tag/commit:
- Janela:
- Responsável:

## Checklist
- [ ] CI verde (lint/typecheck/build)
- [ ] Migrações aplicadas em staging (`npm run prisma:deploy`)
- [ ] Backup DB realizado antes da janela
- [ ] Smoke test em staging (fluxos críticos + personas)
- [ ] Observabilidade: dashboards/alertas mínimos verificados
- [ ] Plano de rollback pronto (app + dados quando aplicável)

Ver `docs/release-criteria.md`.
