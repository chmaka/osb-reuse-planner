# Dependency evaluation (2026-11-22)

| Project | License/status | Decision |
| --- | --- | --- |
| Dexie.js | Apache-2.0, maintained | Adopted for browser IndexedDB. Context7 docs consulted 2026-11-22. |
| React/TypeScript/Vite | OSS, mature | Adopted core stack. |
| Re:bble 2D Scanner | MIT | Research reference for ArUco/homography; Python code not imported. |
| js-aruco3 | License/third-party notices need full audit | Research for phase 2. |
| doc-scanner | MIT | Consider for perspective UX; document contour assumptions do not equal OSB detection. |
| OpenCV.js | Apache-2.0 | Defer lazy-load CV to phase 3. |
| WebSAM/SAM2 | Model and code rights must be checked independently | Optional phase 3; no model in initial bundle. |
| jagua-rs | MPL-2.0 | Research priority for geometry/WASM; avoid claiming optimizer completeness. |
| Nestbolt | Source and bundled licenses require review | Evaluate irregular container support before adopting. |
| iShape-js | MIT | Candidate for polygon boolean / offset after WASM test. |
| ironnest / PackingSolver | Source and licenses must be checked | Algorithm references only. |
| dxfjs/writer | MIT | Candidate for production-grade DXF; interim writer is reference-only and unvalidated in Cut2D. |

Current adoption is intentionally small to prioritize offline UX, testability and safe geometry. A working POC on Android, Safari and Cut2D remains required before selecting further dependencies.

## Phase 1 additions (2026-11-22)
- **heic-to 1.6.7** (LGPL-3.0-or-later; [source](https://github.com/hoppergee/heic-to)). Used as a **dynamic import** of the CSP-safe build only for HEIC unsupported by native image decoding. The source and redistributable license must remain available; transitive libheif codec licensing and packaging must be checked at each upgrade. Original image bytes are retained. Context7 current TS overloads checked. Self-hosted chunks require no cloud converter.
- **MediaDevices, MediaStreamTrack, ImageCapture** are Web APIs, not polyfills. ImageCapture is optional. Device and control availability determined through runtime capabilities and browser errors.
- No AI weights included in app shell or required for scanning.

## Phase 2 marker detection
- `js-aruco2@2.0.0` from [damianofalcioni/js-aruco2](https://github.com/damianofalcioni/js-aruco2): JS detector, on-demand local worker and printable marker dictionary. Published as MIT, underlying BSD licenses and notices documented in [upstream LICENSE.txt](https://github.com/damianofalcioni/js-aruco2/blob/master/LICENSE.txt), no external API calls or wasm. The decoder is not required for manually calibrated scans. Other newer rewrites were reviewed; a published, inspectable package was selected over an unverified npm entry. The preset is `ARUCO_MIP_36h12` (not OpenCV DICT_5X5_50).
- A sub-pixel fit, lens distortion model, multi-marker coplanarity check and physical accuracy report are not supplied by this dependency.
