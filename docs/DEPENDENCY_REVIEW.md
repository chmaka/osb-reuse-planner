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
