# Steel Companion 격리 체험판 실행계획

**Goal:** 승인된 원화·대사로 공방 → 1회/10연 출하 → 카드 감상 → 도감 재열기를 구현하고 사용자 체험 검토에 넘긴다.
**Spec:** game-edition/docs/design/game-replan-2026-10-31.md 및 steel-companion-full-art-remake.md 작업25–30.
**Architecture:** detached worktree 0e27fe0, 그 안의 .omo/prototypes/steel-companion-full-art-remake에 독립 정적 앱을 둔다. 기존 데이터/등급/확률/픽업/재고/부품계획 함수는 템플릿의 정확한 소스를 추출한다. 공식 제품 계약·소스·테스트는 변경하지 않는다. 새로운 저장 키와 origin을 사용한다.
**Tech Stack:** 기존 JavaScript, CSS, HTML, Node 표준 라이브러리, 설치된 Playwright 1.61.1. 새 의존성 없음.

## 고정 제약과 검토 초점

- art477·대사47·장착 적합성254 승인 감사의 현재 선택 SHA를 고정한다. 승인 자산을 재인코딩하지 않는다.
- 일반44 ID, QP 개발전용, 열처리47면, 확률45/35/15/5·RARE·픽업·10연20스크랩·LV3 보장을 유지한다.
- 시작 자원은 별도 체험 세이브에만 추가출하12·스크랩60을 제공하고 체험용임을 명시한다. 기존 사용자 저장을 읽거나 쓰지 않는다.
- 손에 장비를 겹쳐 합성하지 않는다. cardId/side/sorted equipmentKeys의 승인 완성 그림만 선택한다. 장착 감상은 소유/보상 변경 없는 외형 미리보기다.
- 저장을 먼저 시도하고 확정 결과를 연출한다. 연타/스킵/화면이동/재실행으로 재추첨·추가소비·중복지급하지 않는다. 저장 실패 경고·백업을 제공한다.
- 새 프로필·손상된 저장·다중 탭·이미지 실패·미발견 정보·モーション 감소·키보드 초점·390px/1280px을 검증한다.
- 본 개발·공식 계약 통합·커밋·푸시·배포는 이번 범위가 아니다. 사용자 체험 승인은 pending으로 남긴다.

## 작업과 소유권

- [x] 1. 승인 인계와 기준 코드·dirty 목록을 확인하고 지정 detached worktree 생성.
- [x] 2. prepare.mjs / source.mjs / engine.mjs / qa: 승인 해시 확인, 301외형·47대사·세계 자산 manifest, 기존 경제 함수 추출, 독립 상태/저장 명령과 검증. 루트 에이전트 소유.
- [x] 3. src/index.html / src/prototype.css / src/app.mjs / src/card.mjs / src/reveal.mjs / DESIGN.md: 공방·출하·도감·공통 카드, KO/JA·장착/전후 감상, 감소모션·오류·키보드. UI 작업자 소유.
- [x] 4. prepare → 테스트 → 실제 브라우저 공방/1회/10연/상세/도감/복귀/실패를 검증. 최소 스크린샷과 결과 JSON 보관.
- [x] 5. Astra High 최종 통합 검토, 필요한 수정·검증 후 실행 링크와 체험 검토 항목 전달. 사용자 체험 승인을 자동 기록하지 않는다.

## 공유 인터페이스

`public/data.json`: {cards:[{id,family,familyName,familyKind,grade,code,level,levelName,rare,description,use,spec:{ts,el?,ra?},altSpec?,hasAlt}], families:[{key,name,abbr,kind}], appearances:[{id,cardId,side,equipmentKeys,equipment,image,sha256}], dialogue:[{cardId,side,ko,ja}], assets:{[id]:{image,sha256}}, parts:[{key,name,need}], binding:{...}}.

`src/engine.mjs` exports `createEngine({storage=localStorage,now=Date.now,random=Math.random}={})` returning `{state(), status(), ship(1|10), save(), backup(), nextGoal()}`. `state()` is a deep clone with owned/stock/items/parts/scrap/extra/pullAt/pullUsed/results. `status()` returns {warning,blocked,singleLeft,canTen}. `ship` returns `{ok:true,result:{id,mode,cards:[{id,isNew,stock}],at}}` or `{ok:false,error}`; synchronously commits/save before return, records last result for reload. Local storage key `steel_companion_prototype_20261109_v1`. `nextGoal()` returns {ready,partKey,name,missing:[{name,ids}]} or null. `backup()` returns JSON string.

Source function extraction is pinned to exact template SHA, function bodies retained as strings with a build report. Tests compare RNG sequences to the original functions and prove 10연 guarantee/cost, readonly snapshots, restored results, read/write failures, corruption and foreign key preservation.

## 기록

2026-11-09: 사용자 '승인 자료 최종 점검도 통과했으니 이제 체험판 개발로 진행합시다.'로 작업25–30의 체험판 구현 승인. 원본 dirty 3개 검증 파일·미추적 재계획/타래 자료 보존.
격리 worktree 자체가 약3GiB로 단일 생성량1GiB를 초과했다. 추가 전체 복사를 중단했다. 이후 자산은 선택 원본423MB 중 체험 사용분만 SHA 보존 복사, 추가 의존성 설치 없음. 프로젝트 전체 누적5GiB 내에서 검증한다. worktree는 보존 대상이며 정리하지 않는다.

완료: Node15·Chromium/WebKit18·화면16 통과. Astra High 독립 검토의 동시 탭/손상 pending/본문 링크/메모리 백업 재현을 수정·회귀 검증했다. 소스 추출 RNG1000회 원본과 일치. 제품·교육판·과거 baseline·승인 원본은 보존했다. 실행·검토 자료는 지정 prototype 폴더 README.md, verification.json, gate-review.md에 연결한다. G-EXPERIENCE는 pending으로 유지하며 본 개발을 시작하지 않았다.
