# 스틸 컴패니언 체험판

2026-11-10 소스·실행 자산 보관본이다. 승인된 아트와 KO/JA 문안으로 공방·출하·수집·장착 외형 감상을 제공한다. 전량 아트 승인을 바탕으로 만든 체험판이며, 체험 품질 검토는 진행 중이다.

- [공개 체험판](https://kalamari0227.github.io/steel-grade-gacha/game-preview/)
- [PHS 조율 음향 시연](https://kalamari0227.github.io/steel-grade-gacha/game-preview/phs-preview/?tuning=lower-r2#last-two)

## 실행

이 폴더에서 `node server.mjs`를 실행하면 `http://127.0.0.1:8779/`에서 `public/`을 제공한다. 실행 자산은 저장소에 포함돼 있다.

`src/`는 체험판 소스, `public/`은 승인 자산과 실행 파일, `qa/`는 검증 코드, `phs-preview/`는 고정 10연 비교판이다. `src/audio/`에는 오케스트라 조율 음악과 재생성 코드가 있다.

`node prepare.mjs`는 로컬 프로젝트의 승인 자료 보관소와 원본 게임 소스의 SHA를 확인해 다시 생성한다. 이 작업에는 프로젝트 루트의 `.omo/artwork/steel-companion-full-art-remake/` 승인 기록이 필요하다. 이미 생성된 `public/`은 이 보관소 없이 실행할 수 있다.

## 검증

저장소 루트에서 `npm ci`로 기존 검증 의존성을 설치한 뒤 이 폴더에서 실행한다.

```sh
node --test qa/engine.test.mjs qa/shipments.test.mjs
../../../node_modules/.bin/playwright test --config qa/playwright.config.mjs
```

`qa/adapter.test.mjs`는 로컬 승인 자료를 함께 검증한다. `qa/visual-audit.mjs`는 원래 검토 환경의 OMO frontend 스킬을 사용한 시각 검사 도구다.

## Pages 내보내기

`node export-pages.mjs /절대경로/game-preview`로 새로운 배포 디렉터리를 만든다. 실행 파일·승인 자산·PHS 비교판을 복사하고 소스 커밋과 파일별 SHA를 `preview-release.json`에 기록한다. GitHub Pages의 배포 브랜치에 이 디렉터리를 추가한다.

RARE 조율 음악은 3초에 화음이 완성되고, 오디오 출력 시계에 맞춰 PHS를 공개한다. 음원·음소거·스킵·감소모션은 별도로 처리하며, 출하 결과는 기존 경제 명령이 먼저 확정한다.
