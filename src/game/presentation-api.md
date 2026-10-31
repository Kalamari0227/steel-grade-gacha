# Card compositor API (Task23 → Tasks24–26)

`GAME_PRESENTATION.boot(bridge)` is called once by the game build, after restore. It reads the existing `findChar`, `ITEMS` (`bridge.items`) and state; it does not call save/craft/refresh or change economic data. Build mappings retain source declaration order.

```js
const view = GAME_PRESENTATION.render({
  cardId: 'ssial-270E',
  side: 'front', // required; alt exists only for poo-PHS and ga-1470H
  state: bridge.getState(), // optional; an explicit detached snapshot is also accepted
  previewItem: 'shield' // optional; omit to cancel preview
});
container.replaceChildren(view.element);
await view.ready; // boolean for each image: false means visible fallback, not a hang
```

The returned frozen handle has `element`, `ready`, `cardId`, `side`, and a frozen `items` list. Call render again after state changes or side/preview selection; call the former handle’s `dispose()` before replacing or unmounting it. Disposal clears pending image callbacks, settles readiness, removes listeners and detaches the element. It installs only local image/retry listeners, no timers, global input listeners, observers, canvas, or audio. `boot` does not replace existing routes. `model(input)` exposes the same selection checks for read-only UI use; consumers must not mutate its catalog/manifest references.

`view.onStatus(callback)` immediately supplies frozen `{loading, error, ready}` image counts and supplies new counts on every initial-load or retry transition. It returns an unsubscribe function; `dispose()` also clears all subscribers before aborting images. No callback is emitted after disposal. Use these current counts for live status text and `aria-busy`; `ready` remains the original one-shot boolean array and deliberately does not track later retries. Subscribers are local to the handle, with no polling or observers.

Discovery is `Boolean(state.owned[id])`; stock is deliberately irrelevant. Equipped items require `state.items[key] === id` and actual `ITEMS[].fit(findChar(id))`. Preview requires discovery, compatibility, and `state.items[key] === 1` or already assigned to this same ID. It rejects unowned, incompatible, and another-material assignment. There is no slot limit. Confirming equipment remains Task26's responsibility through the original economic action, including fresh eligibility checks. No unequip/reassign API exists.

A card's eight real DOM layers are background, rear equipment, plinth, character, front equipment, frame, foil, live HTML text. Equipment is transformed in normalized 960×1440 coordinates; square 768px art uses normalized height = width×2/3. Rotation/pivot apply to the square element. z10 routes behind the character and z40 in front. The currently reviewed placements use z40 and no masks. Metadata is explicit for all107 rows and must be merged before a production build. The foil container is reserved and static; the actual raster frame supplies its material. No animation/tilt is needed to read a card, and reduced motion is immediate.

The width belongs to the caller; the card maintains 2:3 aspect. 72px grids use the same DOM art, retaining accessible equipment names while hiding the small secondary line. Screen-level text and controls belong outside the card. Missing image layers show a Korean explanation and a native 44px retry button; retry fetches the same immutable URL with cache reload, retaining the service worker’s integrity check and cache identity. A temporary blob URL bypasses the image error cache and is revoked on success, failure, replacement, or disposal. All content hashes and character identity remain unchanged.

`docs/design/game-reviews/placements/showcase.html` is an explicitly labeled, non-production state harness using current core functions in a hidden iframe. It uses real art and arbitrary detached discovered/item states to exercise the compositor; its inventory is never user progress. The game-qa case also connects the current core to the actual compositor directly; it does not claim a completed production package.

## Workshop consumer (Task24)

`render({cardId,side,variant:'stage',state})` keeps the same eight-layer DOM, normalized full-body/equipment geometry, owned/stock rules and disposal contract. It omits background and frame image creation entirely; these images are not fetched and hidden later. Omitted `variant` (or `'card'`) retains the original full card behavior. The workshop supplies its separate actual scene behind the transparent stage, and keeps names/controls in HTML outside the figure.

`GAME_HOME.boot(bridge)` runs after `GAME_PRESENTATION.boot` and restore. `GAME_HOME.refresh()` is a no-op before boot and reads actual `owned`, `cars[].k`, and equipped items afterward. Its first representative is the first discovered catalog entry, including stock0; no owned entry means an empty stand. `GAME_HOME.select('hero',cardId)` / `select('car',carKey)` reject unowned choices and write only `sgg_game_preferences_v1.display.{hero,car}`, merging the latest preferences so audio and other fields survive. The return is boolean. A stale selected ID falls back for display without changing economic state. The existing `renderHome`/`homeRecommendation`/`partPlan` remain the authority for counters and next-part costs.
