# Meditera OSB Reuse Lab

**Phase 0–1 · experimental browser-first OSB remnant digitization & reuse preview.**

React + TypeScript + Vite + Dexie/IndexedDB + PWA. Millimeters are canonical. No server is required for local inventory.

## What actually works in this initial phase

- Live camera via getUserMedia (when supported) or file upload; rear-camera preference, device switching, capability-gated torch/focus/exposure, ImageCapture/canvas fallback and original photo saved as Blob. HEIC conversion is lazily loaded when necessary. Capture records persist immediately; unsaved measurements can be resumed.
- Pick two image points and specify real distance in **mm** to create a manually scaled trace.
- Draw a polygon with touch/mouse, inspect area and bounding dimensions, store it in IndexedDB.
- Search saved measured remnants.
- Try an explicitly **experimental deterministic grid** placement of rectangular parts in an irregular outline; a separate geometry check rejects overlaps/outside placement.
- Export an **unverified reference-only DXF** (AC1015, $INSUNITS=4, closed LWPOLYLINE) or JSON.
- Installable PWA cache for shell; data remains per browser/device.

**NOT implemented:** real Android or USB-camera physical validation, ArUco, perspective correction, automatic contour detection, holes/defect editor, independent physical verification, multi-remnant solver, production DXF, Cut2D validation, stock consumption and synchronization. No G-code generation.

## Development

Requires Node 22+.

    npm install
    npm run dev
    npm run test
    npm run build

## Phase 0 limitations

Two-point scale corrects scale **only**, not projective distortion. Operator must keep subject and reference approximately coplanar; stock saved as MEASURED (not production VERIFIED). Uploaded images and data are local to the browser; private storage can be deleted by the browser or OS. Backups and migrations follow in later phases. Native HEIC support depends on the browser. Grid placements are deterministic previews, not optimized CNC nesting.

**NEVER send DXF from this phase straight to Cut2D for fabrication.** See docs/CNC_SAFETY.md and docs/MEASUREMENT_PROTOCOL.md.

Repository created for Meditera, 2026-11-22.

### Phase 1 technical notes

The browser image is oriented by the decoder before tracing; source EXIF and original image remain unmodified. Pixel data for the editor is always normalized. Automatic quality indicators are heuristic (blur, glare, contrast and frame risk); they are not accuracy scores. Photo capture and locally saved recovery records work even when calibration is deferred.

`heic-to` (LGPL-3.0-or-later) is dynamically imported only for unsupported HEIC images. Keep its notices and source availability when redistributing; see `docs/DEPENDENCY_REVIEW.md`. Hardware acceptance requires actual Android phone and desktop USB webcam; Playwright tests cannot substitute.
