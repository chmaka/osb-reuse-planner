# Third-party license notices

Project code: original Meditera OSB Reuse Lab source, available in this repository.

## HEIC fallback

- Package: **heic-to** version 1.6.7
- Copyright: upstream contributors at https://github.com/hoppergee/heic-to
- License: **GNU Lesser General Public License v3.0 or later (LGPL-3.0-or-later)**, not MIT.
- Exact upstream license text: https://github.com/hoppergee/heic-to/blob/main/LICENSE
- Source, history, and modification/relinking information: https://github.com/hoppergee/heic-to
- Embedded libheif and codecs are third-party components. See upstream repository and libheif source for corresponding license terms.
- The decoder is loaded as an isolated, on-demand JavaScript chunk and is never required to start the rest of the app. Original image bytes are preserved in IndexedDB.
- Keep the upstream license/attribution and available source/relinking rights with redistributed binaries, and review all bundled codec notices before distribution.

## Other application dependencies

React, Vite, TypeScript, Dexie, Lucide, Vitest, Playwright, and their transitive dependencies retain their separate upstream licenses. Before redistributing a packaged build, run a full dependency license inventory and include relevant notices. This file is not itself a complete automated transitive-license audit.

## ArUco detection

- Package: **js-aruco2**, version 2.0.0, https://github.com/damianofalcioni/js-aruco2
- The original source includes MIT-style notices by Damiano Falcioni and Juan Mellado and additional BSD/OpenCV and dictionary notices.
- Exact full upstream license/third-party texts: https://github.com/damianofalcioni/js-aruco2/blob/master/LICENSE.txt. These notices must accompany source/binary redistribution. The application does not claim all sublicensed components are pure MIT.
- Detection runs locally and lazily in a Web Worker. The app generates printed-size SVG marker artwork from the included dictionary.

## Re:bble and optional SlimSAM

- Method reference: [Grangeot/Re-bble_2D_Scanner](https://github.com/Grangeot/Re-bble_2D_Scanner) © 2025 Maxence Grangeot, MIT license. Adapted concepts: marker-relative point prompts, perspective measurement, mask-to-contour pipeline. Original Python/SAM2 files are not shipped.
- Optional browser ML runtime: [@huggingface/transformers](https://github.com/huggingface/transformers.js) v3.8.1, Apache-2.0; runtime ONNX components retain their own notices.
- Model: [Xenova/slimsam-77-uniform](https://huggingface.co/Xenova/slimsam-77-uniform); model license and distribution obligations should be rechecked against model card before any redistribution. Model weights are downloaded by the user's browser only when AI mode is used; weights are not committed to GitHub.
