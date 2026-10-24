# 교육용 · education-v1

2026-10-25(한국 시간), 사용자가 최종 인수한 현재 버전을 **교육용**으로 명명하고 보존하도록 승인했다.

| 항목 | 보존 지점 |
|---|---|
| 저장소 | https://github.com/Kalamari0227/steel-grade-gacha |
| 보존 브랜치 | `snapshot/education-2026-10-25` |
| 고정 태그 | `education-v1` |
| 승인 앱 원본 커밋 | `747d0a193f278d61631dcb48eee95ffa0e0bb7a7` |
| 개편 전 기준 커밋 | `6784048524c722b7d1057cb28e372b6cce5dc6cf` |
| 서비스 워커 캐시 | `steel-grade-gacha-redesign-t23-v4` |

승인 앱 원본 커밋에는 최종 전달 목록의 218개 파일이 그대로 들어 있다. 이어지는 보존 안내 커밋은 README의 교육용 명칭, 이 기록, 로컬 작업물 제외 규칙만 추가한다. 앱 소스·생성 HTML·최종 그림의 바이트는 바꾸지 않는다. 이후 기능 변경은 별도 작업 브랜치에서 진행하고 이 태그를 이동하지 않는다.

## 보존 범위

- 공방·도감·학습·차고와 출하·제작·저장·웹툰 기능의 소스 및 생성 HTML.
- 카드 45 ID의 47개 최종 그림, 공방 그림, 기존 부품·보증·차량·웹툰 이미지.
- 설계 문서와 시안, 자산 매핑, 회귀 검사 코드·합성 fixture·도구와 의존성 잠금 파일.
- 설치된 `node_modules`, `.omo`의 로컬 기준 복사본·고해상도 원화·검수 기록·실행 결과는 Git에 포함하지 않는다. 기존 로컬 자료는 삭제하지 않고 별도로 보관한다.
- 개인의 도감·재고·진행 데이터는 브라우저에 저장되므로 이 저장소에 포함되지 않는다. 앱 설정의 진행 백업·복원에서 별도로 보관한다.

## 교육용 버전 열기

새 폴더에 태그를 복제하면 해당 보존 버전을 열 수 있다.

```sh
git clone --branch education-v1 --single-branch https://github.com/Kalamari0227/steel-grade-gacha.git steel-grade-gacha-education
cd steel-grade-gacha-education
python3 -m http.server 4280 --bind 127.0.0.1
```

브라우저에서 `http://127.0.0.1:4280/`을 연다. 이미 만들어진 `index.html`이 포함되어 있어 앱을 여는 데 npm 설치나 재빌드는 필요하지 않다. 태그로 복제한 폴더에서 개발을 시작할 때는 먼저 새 작업 브랜치를 만든다.

## 승인된 앱 식별값

| 파일 | 바이트 | SHA256 |
|---|---:|---|
| `index.html` | 8,775,738 | `99537b579bddbb93994b7e19fad2348c736c8cb95e1bfa1a4d5dbdeedafa7126` |
| `src/app_tpl.html` | 439,262 | `03e35ef1d4aa834a6dd5dc6d076946040728c4f736eed856073443f045322b76` |
| `sw.js` | 4,566 | `c248ccc829ce05a0ccabaee5c65db5ca647d91a1e7ca3c0885c5ba898747b591` |

로컬 최종 전달 목록 `delivery-manifest.json`의 SHA256은 `49b9475d98b1ad85f5d7f8a9372f1edf291618dd4a4d40e2b1a38fd7147c59cb`이다. 커밋 전에 작업 파일 218개와 Git에 담긴 218개 파일 모두를 이 목록의 크기·SHA256과 대조해 불일치 0개를 확인했다.

## 검증 기록과 재현 조건

최종 인수 당시 기록은 Chromium 250개와 WebKit 250개, 총 500개 검사 통과 및 별도 핵심 규칙 50개 통과다. 이번 보존 작업에서 해당 전체 검사를 재실행한 것은 아니다. 보존 시에는 승인된 파일과 커밋 대상의 일치를 확인한다. 실제 학습자 대상 효과 조사와 실제 배포 환경 성능 측정은 수행되지 않았다.

새 복제본에서 검사를 실행하려면 [유지보수 안내](../redesign-maintenance.md)와 다음 조건을 함께 확인한다.

1. 원본 비교 검사에는 개편 전 기준 커밋의 전체 파일이 필요하다. 새 복제본의 비어 있는 기준 폴더에 아래처럼 복원하거나 `SGG_BASELINE_ROOT`로 다른 준비된 경로를 지정한다.

   ```sh
   mkdir -p .omo/baseline/site
   git archive 6784048524c722b7d1057cb28e372b6cce5dc6cf | tar -x -C .omo/baseline/site
   ```

2. `verify:assets`는 공방 그림의 외부 검수 문서도 읽는다. `--require-redraw`는 카드별 `identity-review.md`와 `export.json`을 추가로 요구한다. 이 자료와 고해상도 원화는 로컬 별도 보관 대상이며 Git 복제만으로 재현되지 않는다. 실제 자료 위치를 `--review-root`와 자산 manifest 기준으로 준비한다.
3. PWA 검사는 전용 `TMPDIR`를 요구한다. 기본 검사 서버는 4273·4274 포트를 사용하므로 열려 있는 미리보기 서버와 충돌하지 않게 준비한다.

위 조건은 검사 재현에 관한 것이며, 저장된 앱을 실행하는 데 외부 검수 자료가 필요한 것은 아니다.
