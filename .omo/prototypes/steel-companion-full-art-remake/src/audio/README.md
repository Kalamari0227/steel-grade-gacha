# RARE 조율 음악 · 체험판

`draw.rare-tuning.wav`는 48kHz·16bit·스테레오, 7.2초의 샘플러 연주다. 현재 lower-r2는 바이올린·비올라의 높은 성부를 한 옥타브 낮추고 첼로·콘트라베이스·호른의 중저음 화음을 보강한 12성부 편성이다. 현악 앙상블·오보에·트럼펫을 함께 사용한다. 각 파트의 음정은 서로 다른 위치에서 A장조로 수렴하며, 144000번째 프레임(3초)에 조율이 완성된다. 이후 같은 음원으로 화음과 홀 잔향을 이어 간다.

원본 악기 뱅크는 로컬 macOS의 `/System/Library/Components/CoreAudio.component/Contents/Resources/gs_instruments.dls`이다. 렌더러는 [Apple의 DLS 샘플러 로딩](https://developer.apple.com/documentation/avfaudio/avaudiounitsampler/loadsoundbankinstrument(at:program:bankmsb:banklsb:))과 [오프라인 렌더링](https://developer.apple.com/documentation/avfaudio/performing-offline-audio-processing)을 사용한다.

체험판 루트에서 재생성한다.

```sh
swift -module-cache-path /private/tmp/steel-tuning-swift-cache src/audio/render-tuning.swift src/audio/draw.rare-tuning.wav
node prepare.mjs
```

브라우저는 오디오 출력 시계의 3초 지점에 고리 수렴과 카드를 공개한다. 음원은 공개 시점에도 계속 재생한다. 감소모션에서는 3초부터 재생한다. 무음과 음원 실패는 3초의 시각 예고로 대체한다. RARE 1회 출하는 8.5초로 두어 잔향을 감상할 시간을 확보했다.

lower-r2의 WAV SHA-256은 `1a7401bf24aba16d688b2ea10394de4e829ee403f7d62a8ac2a339180bd910a4`이다. 최대 진폭은 0.78이며, Chromium·WebKit의 실제 공개 시각은 음원 기준 3.025초·3.015초였다. 새 음원으로 연속 재생·음소거·스킵·감소모션을 재확인했다. 앞선 r1에서 지연 로딩·음원 실패와 1회/10연 회귀 네 건을 검증했다.
