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
