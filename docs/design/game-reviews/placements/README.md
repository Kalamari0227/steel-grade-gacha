# 107 equipment placements

This directory owns all107 explicit `(cardId, side, itemKey)` placement rows,107 current-art-bound receipts,107 full/72 single equipment proofs, and47 full/72 compatible-set proofs. `coverage.json` records measured alpha intersections with approved face/emblem safe rectangles. `fullsets-contact.png`, `fullsets72-contact.png`, and `single72-contact.png` are review sheets assembled from actual Chromium DOM screenshots, not runtime artwork. The original WebKit captures remain in task evidence. All geometry preserves square item aspect in the 960×1440 card coordinate system. No character/item raster was altered; no hand masks were needed.

The real `ITEMS[].fit` predicates produce103 material/item pairs, including qp-1470/arrow; two heat-treatment alternate faces add four rows. Compatibility is not derived from the legacy102 POOL-only fixture. Empty full sets for nonmatching WR materials remain present in the47-face coverage.

`manifest-fragment.json` uses the dedicated virtual CLI group `placements`; it contains no asset/face/crop/derived updates. Its before hashes target the pre-placement canonical manifest and intentionally become stale after merge. The publication tool rejects wrong collections, unknown/duplicate rows, stale fingerprints, invalid geometry/side/anchor/mask and mismatched receipts. It verifies current47 characters,14items and all107 receipts; `artProductionComplete` remains false. Other assets are never promoted by this operation.

The non-production `showcase.html` uses real catalog functions and art with labeled detached test state. It provides full-compatible, before, preview and cancel controls for manual native-browser inspection. The reusable production API is documented in [presentation-api.md](../../../../src/game/presentation-api.md).

Generation helpers are `tests/game/placement-metadata.mjs` (draft geometry) and `tests/game/placement-receipts.mjs` (copies verified browser proofs and binds hashes). Do not regenerate the fragment against a new canonical revision without reviewing its actual row changes. Reviewed geometry is the canonical manifest, not an implicit runtime layout algorithm.
