# Phase 1 camera capture and measurement notes

**Operator procedure.** Open camera on HTTPS or use the upload action. Choose camera only if device selection exists. Use torch/focus/exposure only when capability controls appear. Check high-resolution capture with ImageCapture (where supported); other devices use canvas video capture. The original photo is stored as a Blob and the oriented preview is a separate blob. Capture record is created before the operator traces the geometry.

**Warnings.** Quality analysis uses heuristics and cannot detect every cropped edge. A warning about a possible problem is not a measured uncertainty. In a workshop, verify sharpness, image orientation, material outline and coplanar ruler position. A manually calibrated scan is only MEASURED and may not become production VERIFIED automatically.

**Recovery.** Captured-but-unmeasured photos appear under Scan, where the operator can reopen them after reload. IndexedDB can be evicted; backup and multi-device synchronization are pending.

**Physical acceptance gate.** Test rear camera, USB webcam, denial recovery, portrait photo orientation, HEIC conversion, low light and repeatability on real devices. Log the device/browser versions, real dimensions and photographic conditions. Do not claim completion from Playwright emulation.
