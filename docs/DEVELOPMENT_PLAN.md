# Phased plan and gates

- **0:** repository, strict TS/Vite shell, PWA, typed Dexie store, initial manual-image-to-inventory-to-reference-layout, tests, build and preview.
- **1:** hardware camera device switching, focus, quality diagnostics, HEIC fallback and real Android/webcam test.
- **2:** ArUco board, multi-point homography, coplanar calibration, measured uncertainty and physical pilot.
- **3:** OpenCV.js segmentation, contour editor, defects and holes, optional cached AI.
- **4–5:** complete inventory lifecycle, backups, revision history, part library and CAD editing.
- **6:** production irregular-to-irregular multi-stock solver with deterministic improvement and independent validation.
- **7–8:** independently parsed DXF, operator-verified Cut2D production, stock residuals and audit.
- **9–11:** design-from-waste, optional secure multi-device sync and measured circular metrics.
- **12:** cross-device QA, production pilot with 20 measured remnants and release.

Do not advance phase status until acceptance tests and human evidence exist.

### Phase 1 implementation (2026-11-22)
- Browser camera module: rear-camera preference, camera list/switching, capabilities-gated torch, continuous focus and exposure adjustment; still-photo API with canvas fallback.
- JPEG/PNG/WebP and lazy HEIC decoder path (original preserved); EXIF-aware normalized display pixels.
- Worker-based advisory diagnostics for blur, high glare, low contrast, possible near-frame-edge details. Thresholds are heuristic and **not calibrated confidence values**.
- Captures are immediately persisted (Dexie schema v2) and can be resumed even before a polygon is drawn.
- Phase 1 browser automated tests are distinct from real-device acceptance. Android and USB-camera physical testing remains pending until a real workshop device is used.
