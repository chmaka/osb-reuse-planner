# Test plan

Run npm run test and npm run build in CI. Unit tests test nonrectangular stock, collision rejection, clearance, simple rings, DXF mm headers and geometry. Browser smoke test requires Playwright browser installation and npm run e2e. These are software tests only.

Physical acceptance still pending: 20 real 18mm OSB scraps, separate validation photos, independent measured boundaries, repeatability, desktop and real Android camera, 3 DXF files imported into licensed Cut2D and inspected by workshop operator. Record error and failures; never invent measurements.

## Phase 1 automated additions
- Unit-test quality diagnostic input, saturation, low contrast, apparent cropping warning and buffer bounds.
- Playwright permission-denied fallback and file import; verify CAPTURED record survives reload and image bytes remain available.
- Test canvas frame and camera-switch control using stubs only where deterministic. These are NOT evidence of real Android hardware support.
- Workshop QA backlog: capture on real Android Chrome and a desktop USB webcam; verify ImageCapture fallback, device switching, real HEIC from phone, EXIF rotated photos, low-light/reflective samples and slow/offline devices.

## Phase 2 software acceptance
- Synthetic homography unit tests: mapping tilted reference quad into metric rectangle, reverse transform, singular/invalid guard, planted distance mismatch, marker extrapolation.
- Browser E2E: choose manual four-point reference, independent distance acceptance and rejection, contour and saved metadata, IndexedDB replay. Generate printed-size MIP36h12 SVG; upload composited synthetic marker and inspect auto detector when supported.
- Real workshop calibration acceptance **pending**: at least 20 real irregular OSB offcuts; gauge known dimensions at several locations, including edges distant from a marker; repeat under lighting/camera changes; log RMS, mean and 95th percentile in mm; preserve each test image and reference lengths. No release-to-CNC based on software unit tests.

## Phase 3 tests and pending real-world acceptance
- Synthetic mask unit tests cover L-shaped offcuts, an internal hole, blank and full-foreground rejection, closed rings and simplification (no field precision claims).
- Browser acceptance tests: take a synthetic image through upload/calibration/auto-contour worker, accept proposed hole, affirm review and persist; separately hand-draw a hole plus a defect, inspect their non-overlap/usable-area invariants, and attempt a deliberately invalid exclusion.
- Real workshop backlog: 20 photographs across OSB materials, dark/bright worktables, shiny screws, pencil marking, curves, saw teeth, splinters and mixed background; measure missed-edge rate and wrong-hole detections. No physical accuracy asserted from synthetic CI tests.

## Phase 4
- Pure geometry unit tests: Re:bble 0.75 offset prompt points, bounded coordinates, binary mask contour extraction, ignore marker's false black/quiet-zone hole while preserving real holes, metric area and impossible masks.
- E2E: synthetic photo containing in-app MIP36h12 marker on contrasting sheet should auto-find marker, populate mm measurements, and keep save disabled pending independent control and review. Test missing-marker path explicitly fails with no invented mm.
- AI SlimSAM WebGPU inference not covered by synthetic CI: requires real-device demo with fetched model on Android/desktop. The local fallback is testable but is not evidence the model ran.

## Phase 5 pilot evidence
- Unit tests: measured-vs-scan signed and absolute errors, finite/positive input guards, zero-record summaries as null, 20-distinct-remnant accounting, mean absolute error, root mean square error and nearest-rank P95; safe CSV formatting.
- Playwright: programmatically seed a *synthetic fixture* remnant, open the Validacija UI, record operator dimensions, verify persistence across reload, repeat the same offcut without increasing 20-item sample progress, report larger-than-threshold error, download CSV, confirm original remnant status remains MEASURED.
- Physical study remains unperformed. No statistical claims are based on seeded browser fixtures or mock imagery.

## Phase 5.2 tests
- Unit: choose adjacent and non-adjacent vertices from outer/holes/defects, reject impossible ring/vertex pairs, nonfinite or impossible physical lengths; sign + absolute error and zero-evidence summary; distinguish repeated checks and physical offcuts; neutralize CSV formula injection.
- Browser: seeded irregular test offcut with real polygon/inner hole, select hole vertices and record physical test reading, verify immutable snapshot and MEASURED status, reload, inspect persisted record and CSV; select a concave outer edge then reject duplicate endpoints. These are **synthetic fixtures**, not measured material.
- Real field: physically mark identical two reference vertices on OSB before using a ruler, log method and offset from reference marker. Full-profile edge deviation requires richer physical ground truth than two point-to-point lengths.
