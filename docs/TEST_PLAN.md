# Test plan

Run npm run test and npm run build in CI. Unit tests test nonrectangular stock, collision rejection, clearance, simple rings, DXF mm headers and geometry. Browser smoke test requires Playwright browser installation and npm run e2e. These are software tests only.

Physical acceptance still pending: 20 real 18mm OSB scraps, separate validation photos, independent measured boundaries, repeatability, desktop and real Android camera, 3 DXF files imported into licensed Cut2D and inspected by workshop operator. Record error and failures; never invent measurements.

## Phase 1 automated additions
- Unit-test quality diagnostic input, saturation, low contrast, apparent cropping warning and buffer bounds.
- Playwright permission-denied fallback and file import; verify CAPTURED record survives reload and image bytes remain available.
- Test canvas frame and camera-switch control using stubs only where deterministic. These are NOT evidence of real Android hardware support.
- Workshop QA backlog: capture on real Android Chrome and a desktop USB webcam; verify ImageCapture fallback, device switching, real HEIC from phone, EXIF rotated photos, low-light/reflective samples and slow/offline devices.
