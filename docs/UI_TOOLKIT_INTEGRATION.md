# Motion UI in OSB Reuse Lab — analytics integration (2026-11-23)

## Scope

Isolated PR, not a production deployment. Add an accessible inventory analytics module that reads existing Dexie records via the app's `useLiveQuery`. No model/data migrations and no changes to scanner, geometry, DXF, nesting, or production code.

### Implemented

- Real `motion/react` dependency (Motion 14) for animated area bars.
- Local filters: all/30/90 days and available thicknesses in millimeters.
- Group by thickness or material; counts and recorded surface in m² calculated **only** from stored `areaMm2`.
- Current inventory status distribution, including pending checks. No inference that an AVAILABLE/USED record means confirmed fabrication or actual savings.
- Responsive layout with reduced-motion support and keyboard-accessible controls.
- Downloadable summary CSV (aggregated counts and area only, not photos, remnant IDs or raw geometry; formula-injection-safe text).
- Pure deterministic unit tests and Playwright desktop/mobile checks.

### Deliberately not included

- No Bklit install in production yet: its shadcn registry imports a larger component dependency graph; currently exercised separately in the UI Toolkit Lab.
- No Kokonut AI assistant, Meta Astryx migration, cloud analytics, actual material reuse rates, verified stock accuracy, CNC-ready production or Machine/G-code workflow.
- Do not mark physical measurement/cutting validation complete based on software-only tests.

### Acceptance gate

Run `npm run lint`, `npm run test`, `npm run build`, `npm run e2e` (CI covers test/build/e2e). Confirm keyboard/motion preference at 375/768/desktop. Review draft PR before merge. Existing Cloudflare production deployments and Access policy remain unchanged.

Docs: https://motion.dev/docs/react (via Context7, checked 2026-11-23). Project rules: `AGENTS.md` and `docs/CNC_SAFETY.md`.
