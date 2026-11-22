# Architecture (Phase 0)

**Frontend:** Vite, React, TypeScript; UI state in React. Responsive SVG editor. **Storage:** Dexie IndexedDB schema v1 for remnants, original image Blobs, parts and audit events; no sync. **Math:** pure TS polygon/segment functions; all coordinates millimeters. **Worker:** off-main-thread grid placement with exact polygon containment/collision validation in geometry.ts. **Export:** a reference-only ASCII AC1015 DXF writer, never a production toolpath. **PWA:** service worker caches app assets for offline startup.

Planned: calibrated multi-marker projective transform, optical segmentation, polygon repair/holes, verified stock state machine, real irregular nesting optimizer and DXF parser round-trip. No Rust crate yet: WASM benefit and integration not proven.
