# Architecture (Phase 0)

**Frontend:** Vite, React, TypeScript; UI state in React. Responsive SVG editor. **Storage:** Dexie IndexedDB schema v1 for remnants, original image Blobs, parts and audit events; no sync. **Math:** pure TS polygon/segment functions; all coordinates millimeters. **Worker:** off-main-thread grid placement with exact polygon containment/collision validation in geometry.ts. **Export:** a reference-only ASCII AC1015 DXF writer, never a production toolpath. **PWA:** service worker caches app assets for offline startup.

Planned: calibrated multi-marker projective transform, optical segmentation, polygon repair/holes, verified stock state machine, real irregular nesting optimizer and DXF parser round-trip. No Rust crate yet: WASM benefit and integration not proven.

### Acquisition additions (Phase 1)
Camera/format handling lives in `src/features/camera/`; file upload is always available. The source Blob is stored separately from its EXIF-normalized preview Blob. Scan metadata and recoverable CAPTURED records are stored by a forward-only Dexie v2 migration. One quality worker processes downsampled pixel buffers and returns warnings, not camera accuracy or production verification. Heavy HEIC conversion loads on demand; it is never a compulsory prerequisite to opening the app.
