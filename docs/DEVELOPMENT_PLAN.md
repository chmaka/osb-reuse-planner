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

### Phase 2 implementation — projective calibration
- Real four-corner rectangle projective calibration with a numerically conditioned homography and pixel-to-mm vector geometry; arbitrary quadrilateral is validated (convexity, edge length, finite coordinates).
- Optional ArUco marker detection uses `js-aruco2` MIT/BSD components in an on-demand local Web Worker, dictionary `ARUCO_MIP_36h12`, strict Hamming <=2, thumbnail processing for mobile performance.
- Printable physical-size SVG markers: default 80 mm **black square**, quiet zone outside; user must print 100%, measure with ruler, and keep marker flat and coplanar with OSB top face.
- Measured contour can be previewed in corrected metric 2D without raster warping; independent physical-distance check is required for projective calibration (max(2 mm, 2%) software acceptance threshold, not demonstrated physical accuracy). Extrapolation hard guard 12× reference radius.
- Remnant calibration and independent check kept in IndexedDB with audit records; marked MEASURED, never promoted to CNC VERIFIED from software alone.
- Optical lens distortion, subpixel corner refinement, homography conditioned with multi-marker board, true rectified photograph, validation on real scrap material remain future work. 

### Phase 2 release gate
Software functionality is implemented in the pilot but **not accepted for CNC**. Release is contingent on all GitHub Action checks, real Android and desktop camera checks, printed ArUco sample scaling, independent gauge checks across at least 20 actual OSB offcuts, and documented measurement error distribution. No approval is inferred by mathematical tests.

### Phase 3 (2026-11-23): browser segmentation MVP
- Background-color separation with robust border sample, adjustable threshold, largest 4-connected region, 3×3 majority denoising, traced outer boundary and internal holes; runs in a dedicated `segment.worker.ts` on a downsampled image (longest side ≤720 px).
- The algorithm is a classical heuristic for **contrasting OSB material against a different background**. It is not semantic AI/SAM2/OpenCV, may fail on timber/complex floor backgrounds, cannot infer hidden edges, and does not estimate measurement certainty. Explicit user review checkbox gates saving AI/classical auto suggestions.
- Separate user-approved holes and defects with free-form polygon tracing, drag-to-correct existing vertices and point insertion/removal. Production blockers: self-intersection, outside/touching/crossing exclusions, overlaps, unclosed drafts. Usable area excludes all valid hole and defect areas; original source image and inspection status remain local.
- A known deficiency: editable draft geometry should be persisted across reloads with versioned scan records (planned next). Human workshop acceptance still pending.
