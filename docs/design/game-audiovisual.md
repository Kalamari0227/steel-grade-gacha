# Game audiovisual event ownership

Task31 uses the existing four original tracks and24 original cues. Audio is optional presentation; all economic commands and save attempts finish before result presentation. No audio return value is an economic condition.

## Music

workshop → workshop; dex/research → collection; craft → craft; garage → garage. Equipment owns craft music from entering its target/preview flow through confirmation display. A nested card retains that flow's music; closing equipment restores the latest actual destination. A real route change invalidates the overlay owner before dialog teardown, so an old caller cannot win. Nested material details preserve the original card nodes, side, scroll and opener while disposing/recreating their art handle. Choosing equipment again from a temporary detail dismisses that detail and continues the existing equipment flow; closing it still returns to the original card. No URL/state write selects music. `GAME_AV` owns only this presentation context, safe cue invocation and a bounded next-turn route cue. Existing `GAME_AUDIO` still owns audio graph, preferences and native lifecycle.

## Cues

| IDs | Semantic emitter |
|---|---|
| ui.tap | Opening settings via its two explicit buttons |
| ui.back | Explicit close/back/skip buttons and dialog Escape; never silent route teardown |
| ui.tab | Actual destination change after routing cancellations, or grid/gallery mode change |
| ui.confirm | Each successful representative UI action, after its presentation cleanup: two home selects, gallery/card buttons, garage button after renderGarageStage. GAME_HOME.select retains a boolean result and does not emit the cue itself. |
| ui.unavailable | Rejected stale equipment confirmation |
| card.flip | Valid changed side in card/gallery/equipment; no same-side, refresh or retry cue |
| equip.select / equip.preview / equip.attach | Valid target / changed before-preview / successful assignment after save |
| research.correct / research.incorrect / research.reward | Accepted quiz answer / accepted incorrect quiz or order answer / actually granted reward after save |
| draw.latch / draw.coil / draw.seal | Committed opening at0/200/450ms |
| draw.reveal / draw.new / draw.result | First card reveal / new discovery in intended sequence / natural non-development result |
| qp.complete | Sole emitter in draw development reveal after core development save; no second research cue |
| craft.material / craft.work / craft.complete | Post-save material-on-workbench / form300ms / natural completion1100ms |
| garage.assemble / garage.complete | Post-save car reveal / natural completion1500ms |

## Cancellation contract

`GAME_AUDIO.snapshot().cueGeneration` is a monotonic cancellation generation used by presentation producers, not just diagnostic output. `cancel()` increments it; mute, SFX0, route and hidden/pagehide use cancellation. Draw/craft/garage capture the value on starting a new presentation and suppress subsequent timed cue calls when it differs. Thus mute→unmute preserves visual continuity but cannot restart old sequence sounds. New presentations use the current generation. The existing pending-decode generation check still prevents a canceled in-flight source from starting. No new public method or audio gain/codec behavior is added.

Skip/close disposes each module's timers/art handles and cancels its owned audio. Natural completion may retain its grand tail. A route cue is queued after the native event handlers, which may themselves cancel SFX; only the latest route generation may emit it. Hide/pagehide cancels that queued work and releases equipment ownership. Representative UI actions emit only after successful saving and their own synchronous display cleanup, so an old garage grand tail cannot cancel the new confirmation. Failed validation/storage emits no confirmation. Research immediate answers and equipment immediate actions use safe cue calls whose failures never abort visible completion.

## Garage confirmation visibility

Successful confirmation focuses the named showroom heading and scrolls the stage into view immediately, before its light/turntable/complete sequence. This also cancels a pending selection scroll. Reduced motion uses the same visible heading without smooth scrolling; the car status text remains available and stale rejection retains its existing status focus. The transaction still saves once and clears assembled parts once.

## Evidence interpretation

`tests/game/audiovisual-loop.spec.mjs` runs the real production build in Chromium and WebKit. Its owned profile records native decode SHA→AudioBuffer identity→AudioBufferSourceNode.start/stop, while preserving native playback. Request logs alone are insufficient. The primary loop has exactly one declared pre-load fixture with34 valid parts and enough materials; draw, equipment, quiz reward, final recipe and car acquisition then use actual UI without progress replacement.

Its optional capture probe adds a test-only MediaStreamAudioDestinationNode beside the native master destination and records that output with MediaRecorder. This records the actual gain/ducked browser graph, not a synthesized reconstruction and not microphone/speaker output. The silent screen recording and captured audio file are separately retained and labeled. An audio stream, advancing clock and nonzero decoded PCM do not establish subjective hearing or physical iOS/headphone output.

Documentation references: [Playwright1.61.1 videos](https://github.com/microsoft/playwright/blob/v1.61.1/docs/src/videos.md), [MDN createMediaStreamDestination](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamDestination), [MDN MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder).
