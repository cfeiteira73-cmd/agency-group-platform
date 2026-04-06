# BACKUP MANIFEST — AGENCY GROUP GOLD v2.0
**Data**: 2026-04-06
**Commit**: 891f01c
**Tag Git**: v2.0-GOLD-2026-04-06
**Branch backup**: backup/gold-2026-04-06-world-class
**Remote**: github.com/cfeiteira73-cmd/agency-group-platform

---

## Verificações de Integridade — Resultado Real

| Check | Resultado | Detalhe |
|-------|-----------|---------|
| Font-sizes homepage (page.tsx) | PASS | 0 violations |
| Font-sizes globals.css | PASS | 0 violations |
| Font-sizes portal components | FAIL — 53 violations | PortalDraftOffer.tsx (21), PortalCollections.tsx (17), PortalImoveis.tsx (15) |
| Buttons sem type — portal components | FAIL — 13 violations | PortalDashboard.tsx (13 buttons sem type=) |
| Buttons sem type — page.tsx | FAIL — 17 buttons, 0 com type= | Todos os `<button>` na homepage sem type="button" |
| AbortControllers useEffect | PASS | PortalCRM.tsx linha 356-357, PortalImoveis.tsx linha 1160-1161 |
| PortalFinanciamento guard | PASS | linha 51: `if (!principal \|\| principal <= 0 \|\| !years \|\| years <= 0)` |
| AUTH_SECRET validation | PASS | verify/route.ts linha 5-7: validação + graceful error |
| aria-current sidebar | PASS | PortalSidebar.tsx linha 74 |
| TypeScript errors | A verificar |

---

## Ficheiros Críticos Verificados

| Ficheiro | Tamanho | Última modificação |
|----------|---------|-------------------|
| app/page.tsx | 113.529 bytes | 2026-04-06 14:55 |
| app/globals.css | 65.470 bytes | 2026-04-06 14:58 |
| app/layout.tsx | 22.004 bytes | 2026-04-06 11:00 |
| app/portal/page.tsx | 62.591 bytes | 2026-04-06 10:24 |
| app/portal/components/PortalDashboard.tsx | 98.727 bytes | 2026-04-06 15:19 |
| app/portal/components/PortalCRM.tsx | 158.655 bytes | 2026-04-06 15:19 |
| package.json | 1.525 bytes | 2026-04-05 |
| tsconfig.json | 766 bytes | 2026-04-05 |
| .env.local | 5.854 bytes | 2026-04-06 00:33 |

---

## Bugs Confirmados Ainda Presentes (Wave 3 pendente)

### 1. Font-sizes abaixo de 0.5rem em componentes portal (53 ocorrências)
- **PortalDraftOffer.tsx**: 21 violações
- **PortalCollections.tsx**: 17 violações (`.75rem`, `.82rem`, `.65rem`, `.78rem`, `.68rem`, `.8rem`)
- **PortalImoveis.tsx**: 15 violações

### 2. Buttons sem type="button" em PortalDashboard.tsx (13 ocorrências)
- Linhas: 826, 963, 987, 1121, 1140, 1294, 1358, 1570, 1735, 1811, +3
- Risco: submit acidental em forms

### 3. Buttons sem type="button" em page.tsx (17 buttons, nenhum com type=)
- Inclui modais, tabs de pesquisa, botão de simulação

---

## Git Log (últimos 5 commits)

```
891f01c fix(a11y): WCAG AA — aria-labels em icon buttons, aria-current no sidebar, remaining type=button fixes
3ad6f23 fix(security): AUTH_SECRET validation — graceful error handling
b15bc92 fix: add type="button" to 375 buttons and AbortController to 5 useEffect fetches
dc6bf21 fix(audit): nano-detail audit — 15 font-size violations → .52rem + PortalFinanciamento div-by-zero guard
9542b4b fix(homepage): 2 remaining font-size violations → .52rem (off-market btn + testimonials eyebrow)
```

---

## Tags Existentes

- `v1.0-backup-2026-04-06`
- `v2.0-GOLD-2026-04-06`

---

## Como Restaurar

```bash
git checkout v2.0-GOLD-2026-04-06
# ou
git checkout backup/gold-2026-04-06-world-class
```

---

## Acções Pendentes (Wave 3)

1. Corrigir 53 font-size violations em PortalDraftOffer, PortalCollections, PortalImoveis
2. Corrigir 13 buttons sem type= em PortalDashboard.tsx
3. Corrigir 17 buttons sem type= em page.tsx
4. Criar commit `fix(audit): Wave 3 — font-sizes + button types remaining components`
5. Actualizar tag para `v3.0-GOLD-2026-04-06`
