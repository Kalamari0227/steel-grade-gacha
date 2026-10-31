# Game release input contract

`node tools/build-game.mjs` validates production inputs before touching a previous release. `src/build.sh` delegates here. Runtime module definitions live in `src/game/{edition,backup,audio,presentation}.js`; CSS is `src/game/game.css`. Definitions precede the economic core and must not access `S` at definition time. `GAME_AUDIO.boot(bridge)` and `GAME_PRESENTATION.boot(bridge)` receive the single frozen bridge after restore, with `getState`, `allChars`, `findChar`, `partPlan`, `craft`, `save`, `refresh` and complete `assets`/`audio` maps. No economic computation belongs in those modules.

## Audio producer (Task 10)

Write `src/audio/manifest.json`:

```json
{"schemaVersion":1,"edition":"game","stage":"release","sources":[{"path":"src/audio/score.json","sha256":"64 lowercase hex"}],"tracks":[{"id":"workshop","kind":"bgm","variants":[{"path":"src/audio/encoded/workshop.opus","mime":"audio/ogg","bytes":123,"sha256":"64 lowercase hex","sampleRate":48000,"loopStart":0,"loopEnd":48},{"path":"src/audio/encoded/workshop.m4a","mime":"audio/mp4","bytes":123,"sha256":"64 lowercase hex","sampleRate":48000,"loopStart":0,"loopEnd":48}]}]}
```

Exactly four BGM IDs: `workshop`, `collection`, `craft`, `garage`. Each has one Ogg Opus and one AAC-LC MP4 variant. Exactly 24 SFX IDs follow the plan (see `audio.mjs` exported `cueIds`), each with one `audio/wav` PCM16 mono variant. Every variant carries actual decoded sample rate and loop boundaries in seconds (`0` to decoded duration for a one-shot); loopEnd must be positive and within decoded duration + 50ms codec tolerance. All variants together ≤8,000,000 bytes. Files are nonempty real audio and decoded with bounded ffmpeg/ffprobe commands. Sources must include score.json, patches.json, mix.json, cues.json and renderer/encoder/verification implementations under tools/audio; all source bytes bind the release hash. Paths are relative and symlink-free. No encoder command is accepted from JSON. Complete/encoded production audio and actual runtime definitions are required; metadata alone cannot pass.

## Test fixtures

`--fixture` accepts only a separate input directory containing `SYNTHETIC_GAME_BUILD_FIXTURE.json` with `{ "purpose":"synthetic-game-build-tests", "version":1 }`. This is a tool test mode, never production approval. Fixture output is permanently labeled `syntheticFixture:true` and `data-game-fixture="true"`; production rejects this marker. Fixture assets still require all 175 canonical rows, exact ID/path/side contracts, content SHA/MIME and actual raster decoding. Synthetic receipts cannot satisfy production review. Fixture audio uses the same complete count/codec/decode contract. Fixture packages retain their label and never promote to the real workspace.

`game-release.json` is the portable runtime allowlist, with every entry's relative path, SHA256, byte count, MIME and critical/optional class. The immutable release manifest is identical. Release identity hashes canonical source inputs (sorted paths/hashes, no absolute roots or timestamps), including build implementation. Package verification rehashes all files and rejects stale release identity, unsafe paths, symlinks, extra/missing declarations and original-comic mutations.

## PWA publication boundary

Game must use a dedicated origin, never a directory controlled by the education root service worker. The authored worker is `src/game-sw-template.js`; generated `sw.js` is output only and is never rehashed as a source input. Build injects integrity-bound shell/art/audio/comic entries (worker self-bytes are excluded to avoid a circular hash). Critical HTML, manifest, icons, workshop and plinth must all verify before the worker can activate. Updates wait for an explicit button click and idle responses from all live windows. Other windows retain their document and release cache; unknown windows prevent activation/pruning. Foreign/education caches are never deleted. Old exact original comic responses may be copied only after MIME, size and SHA validation. An unseen image exposes text and retry; unavailable audio fetches fail for the audio runtime's silent fallback. No browser permissions are requested on load.
