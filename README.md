# Meditera OSB Reuse Lab

**Version 0.5.1 · experimental browser-first OSB remnant digitization, local physical QA & reuse preview.**

React + TypeScript + Vite + Dexie/IndexedDB + PWA. Millimeters are canonical. No server is required for local inventory.

## Original MVP baseline (historical; later features described below)

- Live camera via getUserMedia (when supported) or file upload; rear-camera preference, device switching, capability-gated torch/focus/exposure, ImageCapture/canvas fallback and original photo saved as Blob. HEIC conversion is lazily loaded when necessary. Capture records persist immediately; unsaved measurements can be resumed.
- Pick two image points and specify real distance in **mm** to create a manually scaled trace.
- Draw a polygon with touch/mouse, inspect area and bounding dimensions, store it in IndexedDB.
- Search saved measured remnants.
- Try an explicitly **experimental deterministic grid** placement of rectangular parts in an irregular outline; a separate geometry check rejects overlaps/outside placement.
- Export an **unverified reference-only DXF** (AC1015, $INSUNITS=4, closed LWPOLYLINE) or JSON.
- Installable PWA cache for shell; data remains per browser/device.

**Still not physically validated:** real Android/USB-camera accuracy and SlimSAM on production devices, 20 real workshop remnants, multi-remnant solver, Cut2D production DXF, stock consumption, sync and G-code. ArUco, planar calibration, basic automatic contour/holes and an independent physical QA evidence workflow have been implemented as experimental features below; they are not CNC-certified.

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

### Phase 2 planar projective calibration (pilot)

Skeniranje now offers: (1) original two-point approximate scale (no projective correction); (2) manual rectangle/coplanar planar homography by tapping 4 corners in clockwise order; (3) `ARUCO_MIP_36h12` marker detection (printable SVG). Enter exact reference width/height or physically measured black-square marker edge. Projective methods **require an independent physical check length** within max(2 mm, 2%) before a record can be stored as MEASURED. These are software thresholds, **not established camera precision**. Projective calibration stores its full pixel-to-mm matrix and the check result. A corrected 2D polygon preview can be toggled on; no full-image raster rectification or optical distortion correction is offered. CNC remains blocked pending real workshop testing.

### Phase 3 — Automatic contour suggestions and manual repair

On **Skeniranje**, establish scale first, then select **Predloži konturu automatski** (requires a contrasting surface and an unobstructed edge). The offcut outline is created from locally analyzed pixels. If the wrong object is selected, use **Izaberi uzorak OSB-a na slici** and try the same threshold again, or adjust the threshold value. The worker returns optional detected inner openings in orange that need separate operator acceptance. Existing points can be dragged; **Dodaj teme na ivici** inserts a vertex and **Izbriši izabrano teme** removes it. Switch to **Unutrašnji otvor** or **Oštećenje / zabrana rezanja** to trace separate exclusion regions and complete the ring. Open polygons, intersecting outlines and overlapping exclusions are rejected. Saving an automatically proposed outline additionally requires explicitly checking the operator review box. All regions are saved in millimeters, and usable area subtracts valid openings/defects. No contour becomes CNC-verified by software alone.

**Limitations:** background-color heuristics, not general-purpose AI segmentation; precise thin splinters may be lost by downsampling. The operator must correct and physically check the outline. The algorithm does not produce G-code or production-ready DXF; a reference DXF and experimental nesting remain separate.

Incomplete scan geometry, calibration settings and exclusion rings are stored with the locally captured image record after a short debounce. Resume the photo via **Nastavi mjerenje** following reload. All proposed auto holes must be accepted or rejected before saving a measured remnant. Local browser storage can be evicted; user backups remain necessary.

### Phase 4 — Re:bble-assisted one-touch automatic measurement (pilot)

This integration uses the [Re:bble 2D Scanner](https://github.com/Grangeot/Re-bble_2D_Scanner) **concept** (MIT, Maxence Grangeot / EPFL) rather than running its CUDA/Python batch script on a phone. With a **physically measured** `ARUCO_MIP_36h12` marker (default displayed 80 mm *must be checked on print*), camera/upload automatically detects the marker, computes a planar projective pixel→mm transform, proposes a raster-derived irregular outline, and displays width, height and area in millimeters/square meters. No user must manually select contour corners for the normal automatic path. `Brzo` uses the existing local contrast segmentation with a point prompted from marker geometry. `AI` uses an optional lazy browser **SlimSAM** (`Xenova/slimsam-77-uniform`, Transformers.js/WebGPU) with Re:bble-style 4 positive query points outside the marker corners; if unavailable it **explicitly** falls back to contrast method. Neither mode claims SAM2 identical behavior. The first AI use downloads a model from Hugging Face; actual photographs are processed locally and are not uploaded by the app. In offline use, the AI model must already be cached. Browser support, local resource limits and physical accuracy are not yet verified on workshop phones.

Important distinction: the original Re:bble markers are OpenCV `DICT_4X4_250`, `DICT_5X5_250`, `DICT_6X6_250`, but this browser pilot currently recognizes its own `ARUCO_MIP_36h12` markers only. Download those from the in-app generator and print at 100% scale. Material and marker must be coplanar. A successful automatic measurement is **not** evidence of acceptable dimensional tolerance; the independent physical check and operator-reviewed geometry remain required for a saved MEASURED offcut. No CNC status is promoted.

### Phase 5 — Independent physical-width/height validation pilot

Open **Validacija**, choose an existing scanned offcut and physically measure the **outer bounding width and height** with an independent ruler/instrument. Digital dimensions populate from the previously saved polygon; the operator enters their real physical counterparts. Record reference instrument, device, lighting, and setup notes. The default 5 mm alert threshold is an editable *internal workshop benchmark*, not an accepted machining tolerance. All evidence is stored locally in a separate Dexie v3 table with a frozen scan geometry/revision snapshot. Recording a trial does not automatically promote a remnant to VERIFIED or CNC-ready.

The dashboard measures signed/absolute width and height errors, MAE, RMSE, P95 (nearest-rank), maximum deviation, user-defined warning threshold compliance and a progress target of **20 different physical offcuts**. Repeat measurements of one offcut remain distinct trials but count only once toward 20. Export evidence as CSV/JSON for independent analysis. A fresh device with zero physical trials explicitly displays 'Nema podataka' rather than claiming zero measurement error.

This validates **only external bounding width and height**. It does not establish local contour edge precision, concave/notched details, holes, kerf or industrial nesting/Cut2D correctness. Real workshop trial and Android WebGPU inference validation remain outstanding.

### Version 0.5.1 — physical controls for individual OSB edges and holes

Go to **Validacija → Kontrolne dužine — nepravilne ivice i otvori**. Select a stored offcut. Choose **Spoljašnja kontura**, an **Otvor**, or an **Oštećenje**. Select two clearly identifiable vertices (dropdowns or touch the endpoints on the vector drawing), measure the physical straight-line distance between the *same endpoints* using a ruler, enter that reading and the internal warning threshold. The application calculates and saves the **digital line length vs physical reading**, signed and absolute error, the ring/vertex indices and a frozen pair of source-coordinate points. It never updates a remnant to VERIFIED.

The individual edge/hole QA table uses a Dexie **v4** additive migration without overwriting existing scans, images, remnants or v3 bounding-size checks. Both original width/height and newly added local-span records remain in the offline browser and are independently exportable as CSV/JSON. The existing overall pilot JSON export also includes these local checks.

**Caution:** This measures straight-line separations between pairs of known vertices, not the full irregular perimeter length, surface flatness, saw kerf, missing splinters or the spatial error along an edge. Selecting clearly identifiable physical points is essential. Real workshop samples are still needed to quantify any tolerances.

### Phase 5.3 — Complete local backup and safe restore (v0.6.0)
Use **Podešavanja → Preuzmi sigurnosnu kopiju (.json)** to export **all seven** IndexedDB tables (remnants, captured scan drafts, original and normalized photo blobs, part library, dimension controls, local edge controls and audit trail) in one versioned, portable JSON archive. Photos and their original MIME types are preserved byte-for-byte through Base64. The backup includes SHA-256 checks for each binary and for the structured manifest. This is *corruption detection*, not a trusted-source digital signature. Source material is never uploaded to a server.

To transfer between computers/phones, copy the exported file privately to the target device, open **Podešavanja**, select it, preview its hash/status and record counts, then check the approval checkbox and press **Vrati kopiju bez prepisivanja**. Missing records are added atomically; identical existing IDs are skipped, while conflicting IDs block the entire import. No automatic overwrite, deletion or CNC status promotion occurs. Browser IndexedDB may still be evicted; maintain offline copies on multiple separate devices.

**Limits:** this pilot uses a JSON/Base64 container (larger than ZIP), with a safety cap of 80 MiB cumulative original/normalized photograph bytes or 125 MiB archive size. Export and import must run in a browser with sufficient available memory. The content is **not encrypted**; treat it as internal project data, not a public file. For inventories larger than these limits, a future streaming ZIP/OPFS archive and optional sync will be necessary. Workflows remain offline/local-only.
