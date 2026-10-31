# Original audio production / Task 11 handoff

All notes and sound patches are original procedural material. No external samples, paid APIs or downloaded melodies are used. Node built-ins synthesize 48 kHz float PCM. FFmpeg 7.1.1 provides codec encoding and EBU R128 measurement; exact observed versions are in manifest.json and render-receipt.json.

Run from the game-edition root:

```
node tools/audio/render.mjs --all --seed 20261025
node tools/audio/encode.mjs --all
node tools/audio/verify.mjs --all --repeat-render --max-bytes 8000000 --report /absolute/evidence/audio.json
node tools/audio/verify.mjs --case negative-fixtures --report /absolute/evidence/negative/report.json
node tools/audio/preview.mjs --out /absolute/evidence/listening
```

Set TMPDIR, NODE_COMPILE_CACHE and BUN_RUNTIME_TRANSPILER_CACHE_PATH to an owned temporary directory. Negative fixtures copy production inputs into TMPDIR/negative-fixtures and remove that copy after inspection. Production files are never mutated by verification. Sources required for restoration are the manifest source closure plus all src/audio files. Masters are not shipped in the runtime budget.

The four-note signature is D4, F#4, A4, E4. Each 16-bar score has four separately written four-bar phrases: call, response, variation, return. Workshop uses a gentle bell lead; collection moves the signature into an upper piano register with B-minor colors; craft uses a more active pluck ostinato; garage rests on lower piano/bass. Render synthesizes three identical cycles including release and reverb taps and extracts the middle complete period. Seeded percussion repeats by note and cycle.

Runtime must apply `mix.json` masterSafetyGain 0.85 AFTER the BGM/SFX buses, before AudioContext.destination. User BGM/SFX gain defaults are 0.30/0.60 only after opt-in. Bound verification uses both buses at unity, two equal-power transitioning tracks, and six overlapping SFX, so user controls must not amplify above unity. Grand cues additionally duck BGM by 6 dB. Runtime owns six-voice cap, 100 ms UI cooldown, 400 ms transition, 150 ms duck attack/400 ms release, opt-in, mute, suspend/resume and no missed-cue replay.

Do not assume container duration is the loop period. Four logical periods are 2304000 / 2560000 / 1920000 / 2304000 frames respectively at 48 kHz. Ogg Opus ffmpeg decoded priming is 0 after honoring its 312 encoded skip samples. Task11 guarded fragmented AAC-LC decodes with2112 leading frames (1024 encoder delay +1088 exact periodic tail pre-roll) and960 trailing padding frames. Chromium can trim trailing padding and round one frame; WebKit trims2112 leading frames. The runtime validates both independently against actual buffer lengths, retaining the exact musical period. Actual correlation and decoded frame counts are recorded per variant. Set source loopStart/loopEnd from the decoded buffer contract. Web Audio decoding on each target engine must still validate whether it trims priming; use reference/correlation or the engine-specific decoded length before scheduling. A 20 ms overlapping boundary schedule, if used, must preserve the logical musical period. See manifest.json for exact sample and second values.

Task 10 verifies PCM/codec/period/score/envelopes, complete preview and native browser playback clock. Agent subjective listening is unverified; neither waveform inspection nor a running player proves hearing, musical preference or physical iOS/headphone behavior. Target-engine loop and runtime behavior remain Task 11/36 responsibilities.

Task11 codec correction: `node tools/audio/encode.mjs --all --aac-only` updates only four AAC files and the source-bound manifest; original Opus, SFX and all28masters remain unchanged. `verify.mjs` additionally checks guarded AAC phase, leading/trailing master correlation and wrong-priming rejection. See `src/game/audio-runtime.md` and Task11 evidence; the historical Task10 AAC hashes are superseded by the Task11 before/after receipt.
