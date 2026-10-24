# 교육 내용 검토

상태: **T22 데이터·표시 관계 검토**. Chromium에서 신규 교육 검증2개와 baseline/current 계약2개가 통과했고 카드47상태의 수치·단위·ID를 확인했다. 실제 카드·부품·학습·웹툰·설정의 선택 화면을 읽고 승인된 T19–21 사실과 한계를 반영했다. T23 최종 검증은 외부 `E/delivery-manifest.json`과 보고서로 확인한다. 데이터 전수 일치와 과학적 타당성 검토를 구분한다.

## 범위와 근거

정적 관찰 소스 SHA256은5327dfdbeeaf4ca6f9a31782815c4a871fc36b17c20714c36d94ce4ab0e98198이다. 격리된 VM에서 데이터 선언과 순수 변환만 읽어 baseline catalog와 비교했다. 일반 풀44, 카드45 ID/47상태, 부품35, 보증14, 차고8, 퀴즈413이 일치했다. 47상태의 TS·EL/RA·계열·사업LV·용도와35레시피/14호환 ID 전수표는 이 문서 하단의 데이터 전수 목록에 포함되어 있다.

이 검사는 QUIZ413의 데이터·정답 인덱스·기존 해설 보존을 확인한다. **413문항의 과학적 정확성을 모두 검증한 것은 아니다.** 개별 대표값의 제조사·규격·두께·시험편·열처리 조건 출처도 전수 확보되지 않았다. 해당 값은 규격 보증치로 승격하지 않는다.

## 구별해야 하는 의미

| 항목 | 검토 기준 |
|---|---|
| 사업 LV / 물성 |같은 LV3 S-EDDQ와1180Y의 TS·연성·용도가 다르다. LV4가 모든 성능에서 우월하다는 결론은 금지 |
| 발견 / 재고 |S.owned는 발견 기록, S.stock은 소비 가능 수량. 재고0 카드는 미발견이 아니다 |
| PHS/HPF 전후 |각각 하나의 ID에서 이미지·대사·TS·EL·선택 상태가 함께 바뀌며 비교표는 두 상태를 동시에 보여 준다 |
| EL / RA |도감 선재9종은 원본 ra 필드를 표시. 모든 선재 규격이 EL을 사용하지 않는다는 일반화는 피한다 |
| 보증 항목 |장착 가능한 카드·요구 대응을 표현하는 게임 데이터. 장착이 TS/EL/RA를 상승시키거나 실물 품질을 인증하지 않는다 |
| QP |별도 개발1종. 적격 슬롯만 무소모; 일반 소재 명시 선택과 다른 슬롯은 소비 |
| 대표값 / 보증치 |앱 대표값을 실무 구매·설계의 제품 보증치로 사용하지 않는다 |
| 웹툰 NEW |최대 순서의 열어본 회차. 페이지 캐시 성공·완독·학습 달성이 아니다 |

## 출처를 다시 확인한 기술 표현

2026-10-24 제조사/연구기관 원문을 확인했다. 아래 출처는 적은 수의 구체적 표현에 대한 근거이며 전체 콘텐츠의 인증이 아니다.

1. **GA와 Al-Si**: SSAB는 GA를 아연-철 계열 도금으로 설명한다. ArcelorMittal은 Al-Si·GI·GA를 구별하고, Usibor의 Al-Si가 열 이력 중 Al-Fe-Si 층으로 변한다고 설명한다. 따라서 ga-1470H의 게임 계열을 유지하면서 Al-Si 실제 표면을 명확히 표시하는 T12 안내가 필요하다. 도금이 모두 사라진다고 확대하지 않는다. [SSAB GA](https://www.ssab.com/en-us/brands-and-products/steel-categories/coated-steel/galvannealed-coating), [ArcelorMittal Usibor/Ductibor](https://automotive.arcelormittal.com/products/flat/PHS/usibor_ductibor).
2. **1500급 숫자**: 같은 제조사 페이지의 특정 Usibor1500 조건 표에는 인장강도 최소1400MPa와 최소연신율5%가 있다. 이는 상품 등급명과 모든 조건에서의 일률적 보증 수치가 같지 않음을 보여 주는 사례다. 앱의1500이상/5~7 대표값을 변경하거나 그 제조사 제품과 동일시하지 않는다. [제조사 물성·시험조건 표](https://automotive.arcelormittal.com/products/flat/PHS/usibor_ductibor).
3. **Q&P 공정**: ORNL 연구 요약은 중간 담금질과 탄소 분배를 포함하는 열 이력을 다룬다. 앱의1470M·1180Y·스크랩 비용은 실제 강종 두 개를 섞는 공정식이 아니다. 특정 카드가 실물에서 항상 연신율 두 배라는 보증도 이 출처에서 얻을 수 없다. [ORNL Q&P review](https://impact.ornl.gov/en/publications/quench-and-partitioning-steels/).
4. **PO780Y 상한 표현**: Nippon Steel의2026년 기술보고서는 상용화된780/980MPa급 열연강판을 언급한다. 원본780Y의 최고/더 위는 없어 문구는 이 게임 일반출하 PO 구성의 범위로 한정해야 한다. 실제 열연 제품 전체 강도 상한으로 읽히지 않게 T23 표시 보완을 제안한다. [Nippon Steel Technical Report135](https://www.nipponsteel.com/en/tech/report/pdf/135-04s.pdf).

## 기존 문서 모순 처리표

추가 확인: B필러 원본 note의 “성형과 열처리를 한 번에 끝내는 유일한 자리”는 현재 PARTS의 설명이다. 제조사 공식 hot-stamping 응용에는 범퍼 빔·도어 보강·여러 필러가 포함되므로 보편적인 제조 사실로 일반화하면 오해가 생긴다. PARTS 원문을 보존하고 T23에 적용 범위를 알려 주는 표시 문구를 제안한다. [ArcelorMittal 응용 목록](https://automotive.arcelormittal.com/products/flat/PHS/usibor_ductibor).

| 기존 표현 | 초안 처리 / 남은 일 |
|---|---|
| 설치·백업은 첫 화면 맨 아래 |설정에서 접근. T19 승인 동작: 같은 창에서 복원된 코드·요약 갱신 및 즉시 복사; 실제 OS 설치를 검증한 것은 아님 |
| index.html RARE 직접 수정 |src/app_tpl.html 수정→빌드 |
| 카드 정보 넷, 배지 구석 위치 고정 |현재 정보 구조와 실제 정보 의미로 안내 |
| 차량당42장/전체336장 고정 소비 |42슬롯과 실제 선택 소비를 구분; QP5적격 슬롯 전수 계산 |
| QP 공개 후 일반 총수45 |일반44+별도 QP |
| QP 레시피=실제 제조 공정 |게임 비용으로 제한 |
| 고객 요구 보증9개 |원본14개 및 전체 호환 ID 표 |
| 전후는 다른 캐릭터 |동일 ID의 전후 상태 |
| 대표 물성은 앱에 미수록 |현재 대표값 표시, 규격 보증치 아님 |
| 날짜 고정 행사를 지금 행사로 단정 |고정 PROMOS/NOTICES 및 런타임 판정으로 안내 |
| SWRM은 자동차에 쓰이지 않음 |현재 게임 레시피 미포함 사실만 기술; 산업 일반 주장 삭제 |
| 캐릭터 두께=실제 전 품종 두께 순서 |그림의 디자인 표현으로만 다룸; 실물 범용 순위 주장 삭제 |
| 웹툰 열면 전체 오프라인 가능 |실제 다운로드·캐시된 그림으로 범위 제한 |
|80여그림/4.7MB/자동 커밋 |T21 104매핑·18웹툰·index8,773,399B 확인; T23 최종bytes 재검증, 승인된경우 커밋 |

## 남은 검토

- T20 수동 기록은 실제 IAB의 계열·LV 기본 메뉴 키보드 조작을 확인했다. 두 엔진 확대 화면은 CSS640×450/DPR2 등가 배치이며 실제 OS200% 확대가 아니다. headless 기본 팝업 키 한계와 실제 메뉴 성공을 구별하고, 접근성/주문 최종 회귀의 근거를 별도로 확인한다. T21은 index8,773,399B와 로컬 비교 측정을 기록했으며 배포 환경 성능이나 T23 최종 통과로 확대하지 않는다.

- T22 실제 카드·부품·학습·웹툰·설정 검토는 외부 E/task-22/content-review.md와 misconception-review.md에 기록했다. PO780Y 상한·B필러 유일 표현은 알려진 원본 단순화로 남아 있으며 표시 범위 보완을 T23에 전달했다.
- 원본 카드 대사/QUIZ/부품 노트의 기술적 단순화는 삭제·수치 변경하지 않았다. 대표값 출처 전수 확보와413문항 전문 검증은 별도 범위다.
- 웹툰 ep02 가격·코일 중량은 기존 이야기의 문구다. 실시간 시장 가격이나 모든 코일의 고정 중량으로 안내하지 않는다.
- T22 검토 시점에 T23 UI 표시 제안은 별도 ui-wording-proposals.md로 전달했다. 이후 적용 여부와 최종 검증 상태는 외부 `E/delivery-manifest.json`과 T23 보고서에서 확인한다.

# 데이터 전수 목록 — 정적 보존 검토

원본 데이터 전수 목록과 실제 수치 표시를 대조했다. 규격 적합성 또는 모든 과학 문장의 검증을 뜻하지 않는다.

## 45 ID / 47 상태

| ID | 상태 | 계열 | 등급 | LV | TS(MPa) | 연성 지표(%) | 주 용도(원본) |
|---|---|---|---|---|---|---|---|
| poo-270C | front | poo | CQ | 1 | 270 이상 | 연신율 EL 36 이상 | 휠 디스크 · 일반 구조재 |
| poo-270D | front | poo | DQ | 1 | 270 이상 | 연신율 EL 38 이상 | 휠 림 · 브래킷 |
| poo-270E | front | poo | DDQ | 1 | 270 이상 | 연신율 EL 40 이상 | 오일 팬 · 딥드로잉 부품 |
| poo-370W | front | poo | 370W | 1 | 370 이상 | 연신율 EL 32 이상 | 크로스 멤버 · 시트 프레임 |
| poo-440W | front | poo | 440W | 2 | 440 이상 | 연신율 EL 27 이상 | 샤시 멤버 · 로어 암 |
| poo-590Y | front | poo | 590Y | 2 | 590 이상 | 연신율 EL 24 이상 | 서스펜션 암 · 휠 디스크 |
| poo-780Y | front | poo | 780Y | 2 | 780 이상 | 연신율 EL 15 이상 | 로어 암 · 서브 프레임 |
| poo-PHS | front | poo | PHS | 4 | 500 ~ 700 | 연신율 EL 20 내외 | 범퍼 빔 · 필러 보강 |
| poo-PHS | alt | poo | PHS | 4 | 1500 이상 | 연신율 EL 5 ~ 7 | 범퍼 빔 · 필러 보강 |
| ssial-270C | front | ssial | CQ | 1 | 270 이상 | 연신율 EL 36 이상 | 브래킷 · 커버류 |
| ssial-270D | front | ssial | DQ | 1 | 270 이상 | 연신율 EL 38 이상 | 도어 인너 · 휠 하우스 |
| ssial-270E | front | ssial | DDQ | 1 | 270 이상 | 연신율 EL 40 이상 | 쿼터 인너 · 오일 팬 |
| ssial-270F | front | ssial | EDDQ | 2 | 270 이상 | 연신율 EL 42 이상 | 도어 아우터 · 펜더 |
| ssial-SEDDQ | front | ssial | S-EDDQ | 3 | 270 이상 | 연신율 EL 44 이상 | 사이드 아우터 · 복잡 형상 외판 |
| ssial-340W | front | ssial | 340W | 1 | 340 이상 | 연신율 EL 34 이상 | 외판 보강재 · 도어 인너 |
| ssial-340H | front | ssial | 340H | 2 | 340 이상 | 연신율 EL 34 이상 | 후드 아우터 · 도어 아우터 |
| ssial-440W | front | ssial | 440W | 2 | 440 이상 | 연신율 EL 27 이상 | 멤버 · 레인포스 |
| ssial-590Y | front | ssial | 590Y | 2 | 590 이상 | 연신율 EL 24 이상 | B 필러 보강 · 사이드 멤버 |
| ssial-780Y | front | ssial | 780Y | 2 | 780 이상 | 연신율 EL 15 이상 | 사이드 실 · B 필러 |
| ssial-980Y | front | ssial | 980Y | 3 | 980 이상 | 연신율 EL 10 이상 | B 필러 아우터 · 루프 레일 |
| ssial-1180Y | front | ssial | 1180Y | 3 | 1180 이상 | 연신율 EL 7 이상 | 사이드 실 이너 · 범퍼 빔 |
| ssial-1470M | front | ssial | 1470M | 4 | 1470 이상 | 연신율 EL 4 이상 | 도어 임팩트 빔 · 범퍼 빔 |
| ga-270C | front | ga | CQ | 1 | 270 이상 | 연신율 EL 36 이상 | 플로어 · 커버류 |
| ga-270D | front | ga | DQ | 1 | 270 이상 | 연신율 EL 38 이상 | 도어 인너 · 휠 하우스 |
| ga-270E | front | ga | DDQ | 1 | 270 이상 | 연신율 EL 40 이상 | 쿼터 인너 · 플로어 패널 |
| ga-270F | front | ga | EDDQ | 2 | 270 이상 | 연신율 EL 42 이상 | 도어 아우터 · 사이드 아우터 |
| ga-SEDDQ | front | ga | S-EDDQ | 3 | 270 이상 | 연신율 EL 44 이상 | 사이드 아우터 · 복잡 형상 외판 |
| ga-340W | front | ga | 340W | 1 | 340 이상 | 연신율 EL 34 이상 | 플로어 보강 · 도어 인너 |
| ga-340H | front | ga | 340H | 2 | 340 이상 | 연신율 EL 34 이상 | 후드 아우터 · 펜더 |
| ga-440W | front | ga | 440W | 2 | 440 이상 | 연신율 EL 27 이상 | 멤버 · 대시 패널 |
| ga-590Y | front | ga | 590Y | 2 | 590 이상 | 연신율 EL 24 이상 | 사이드 멤버 · 크로스 멤버 |
| ga-780Y | front | ga | 780Y | 2 | 780 이상 | 연신율 EL 15 이상 | 사이드 실 · 필러 보강 |
| ga-980Y | front | ga | 980Y | 3 | 980 이상 | 연신율 EL 10 이상 | B 필러 · 루프 레일 |
| ga-1180Y | front | ga | 1180Y | 3 | 1180 이상 | 연신율 EL 7 이상 | 사이드 실 · 범퍼 빔 보강 |
| ga-1470H | front | ga | 1470H | 4 | 500 ~ 700 | 연신율 EL 20 내외 | 센터 필러 · 사이드 실 · 범퍼 빔 |
| ga-1470H | alt | ga | 1470H | 4 | 1500 이상 | 연신율 EL 5 ~ 7 | 센터 필러 · 사이드 실 · 범퍼 빔 |
| eg-SECC | front | eg | 편면도금 | 3 | 270 이상 | 연신율 EL 40 이상 | 연료탱크 · 필러넥 |
| wr-SWRM | front | tarae | 연강 | 1 | 350 ~ 450 | 단면수축률 RA 70 이상 | 못 · 철선 · 철망 · 옷걸이 |
| wr-SWRY | front | tarae | 용접봉 | 2 | 350 ~ 450 | 단면수축률 RA 70 이상 | 피복 아크 용접봉 심선 |
| wr-SWRH | front | tarae | 경강 | 2 | 1050 ~ 1200 | 단면수축률 RA 35 이상 | PC강선 · 와이어로프 · 스프링 |
| wr-CORD | front | tarae | 타이어코드 | 2 | 1150 ~ 1300 | 단면수축률 RA 30 이상 | 타이어 스틸코드 · 비드와이어 |
| wr-CHQ | front | tarae | CHQ | 3 | 600 내외 | 단면수축률 RA 60 이상 | 고장력 볼트 · 엔진 체결부 |
| wr-SUJ | front | tarae | 베어링강 | 3 | 600 ~ 700 | 단면수축률 RA 40 이상 | 베어링 볼 · 롤러 · 궤도륜 |
| wr-SPR | front | tarae | 스프링강 | 3 | 900 ~ 1100 | 단면수축률 RA 30 이상 | 현가 스프링 · 스태빌라이저 |
| wr-VLV | front | tarae | 밸브스프링 | 4 | 1900 ~ 2100 | 단면수축률 RA 40 이상 | 엔진 밸브 스프링 |
| wr-NHT | front | tarae | 비조질 | 4 | 700 ~ 900 | 단면수축률 RA 45 이상 | 열처리 생략 볼트 · 단조 부품 |
| qp-1470 | front | qp | 1470QP | 5 | 1470 이상 | 연신율 EL 10 이상 | B 필러 · 사이드 실 · 루프 레일 (냉간 성형) |

## 35 부품

| 번호 / 키 | 이름 | 슬롯 수 | QP 가능한 슬롯(1부터) | 원본 후보 ID |
|---|---|---|---|---|
| 1 / roof | 루프 | 1 | 없음 | ssial-270E, ssial-270F, ga-270E, ga-270F |
| 2 / hood | 후드 | 2 | 없음 | ssial-340H, ga-340H / ssial-270E, ssial-270F, ga-270E, ga-270F |
| 3 / fender | 펜더 | 1 | 없음 | ga-270F, ssial-270F |
| 4 / sideo | 사이드 아우터 | 1 | 없음 | ssial-SEDDQ, ga-SEDDQ |
| 5 / dooro | 도어 아우터 | 1 | 없음 | ssial-340H, ga-340H |
| 6 / tire | 타이어 | 1 | 없음 | wr-CORD |
| 7 / trunkin | 트렁크 인너 | 1 | 없음 | ssial-270D, ssial-270E, ga-270D, ga-270E |
| 8 / trunko | 트렁크 아우터 | 2 | 없음 | ga-270F, ssial-270F / ssial-340W, ga-340W |
| 9 / whouse | 휠하우스 | 1 | 없음 | ga-270E, ga-270F |
| 10 / floor | 플로어 | 2 | 없음 | ga-270C, ga-270D, ga-270E / ga-340W, ga-440W |
| 11 / sill | 씰 사이드 | 1 | 없음 | ssial-980Y, ga-980Y, ssial-1180Y, ga-1180Y |
| 12 / bumper | 범퍼 빔 | 1 | 1 | ssial-1180Y, ga-1180Y, ssial-1470M, ga-1470H, poo-PHS |
| 13 / apillar | A 필러 | 1 | 1 | ga-1470H, ssial-980Y, ga-980Y, ssial-1180Y, ga-1180Y |
| 14 / bpillar | B 필러 | 2 | 1 | poo-PHS, ga-1470H / ssial-980Y, ga-980Y |
| 15 / crossm | 크로스멤버 | 1 | 없음 | poo-440W, poo-590Y, poo-780Y |
| 16 / impact | 도어 임팩트 빔 | 1 | 1 | ssial-1470M |
| 17 / rim | 휠 림 | 1 | 없음 | poo-370W, poo-440W, poo-590Y |
| 18 / disc | 휠 디스크 | 1 | 없음 | poo-590Y, poo-780Y |
| 19 / tank | 연료탱크 | 1 | 없음 | eg-SECC |
| 20 / seat | 시트 프레임 | 2 | 없음 | ssial-440W, ssial-590Y, ssial-780Y / poo-370W, poo-440W, poo-590Y |
| 21 / bearing | 자동차용 베어링 | 1 | 없음 | wr-SUJ |
| 22 / spring | 서스펜션 스프링 | 1 | 없음 | wr-SPR |
| 23 / vspring | 엔진 밸브 스프링 | 1 | 없음 | wr-VLV |
| 24 / bolt | 볼트 · 너트 | 1 | 없음 | wr-CHQ, wr-NHT |
| 25 / tierod | 스티어링 타이로드 | 1 | 없음 | wr-CHQ |
| 26 / arm | 서스펜션 암 | 1 | 없음 | poo-590Y, poo-780Y |
| 27 / clutch | 클러치 | 2 | 없음 | poo-440W, poo-590Y, poo-780Y / ssial-780Y, ga-780Y |
| 28 / stabil | 스태빌라이저 | 1 | 1 | poo-PHS, wr-SPR |
| 29 / bracket | 브라켓 | 1 | 없음 | poo-270C, ssial-270C, ga-270C |
| 30 / reinf | 보강재 | 1 | 없음 | ssial-440W, ga-440W, poo-440W |
| 31 / roofx | 루프 크로스멤버 | 1 | 없음 | ga-590Y, ssial-590Y, ga-780Y, ssial-780Y |
| 32 / sidemem | 사이드 멤버 | 1 | 없음 | ga-780Y, ga-980Y, ssial-780Y, ssial-980Y |
| 34 / brake | 브레이크 패드 | 1 | 없음 | poo-270C, poo-270D, poo-270E |
| 35 / crank | 크랭크샤프트 | 1 | 없음 | wr-NHT |
| 36 / conrod | 커넥팅 로드 | 2 | 없음 | wr-NHT / wr-CHQ |

## 14 보증 항목

| 키 | 이름 / 태그 | 원본 적용 범위 | 장착 가능한 ID |
|---|---|---|---|
| shield | 방패 / 외판재 | 냉연 · 도금의 연질재 | ssial-270C, ssial-270D, ssial-270E, ssial-270F, ssial-SEDDQ, ga-270C, ga-270D, ga-270E, ga-270F, ga-SEDDQ |
| dagger | 단검 / 박물재 | 판재 전 품종의 590급 이하 | poo-270C, poo-270D, poo-270E, poo-370W, poo-440W, poo-590Y, ssial-270C, ssial-270D, ssial-270E, ssial-270F, ssial-SEDDQ, ssial-440W, ssial-590Y, ssial-340W, ssial-340H, ga-270C, ga-270D, ga-270E, ga-270F, ga-SEDDQ, ga-440W, ga-590Y, ga-340W, ga-340H, eg-SECC |
| potion | 포션 / 윤활 후처리재 | 냉연 · 도금의 심가공재 | ssial-270E, ssial-270F, ssial-SEDDQ, ga-270E, ga-270F, ga-SEDDQ |
| arrow | 화살 / 두께 엄격재 | 판재 전 품종 · 전 등급 | poo-270C, poo-270D, poo-270E, poo-370W, poo-440W, poo-590Y, poo-780Y, ssial-270C, ssial-270D, ssial-270E, ssial-270F, ssial-SEDDQ, ssial-440W, ssial-590Y, ssial-780Y, ssial-340W, ssial-340H, ssial-1470M, ssial-980Y, ssial-1180Y, ga-270C, ga-270D, ga-270E, ga-270F, ga-SEDDQ, ga-440W, ga-590Y, ga-780Y, ga-340W, ga-340H, ga-980Y, ga-1180Y, eg-SECC, poo-PHS, ga-1470H |
| forge | 화덕 / BH재 | 소부경화강(H) | ssial-340H, ga-340H |
| flange | 버링 플랜지 / HER 보증재 | 산세의 고용강화 이상 | poo-440W, poo-590Y, poo-780Y |
| iron | 다리미 / 평탄도 엄격재 | 980급 이상 초고장력강 | ssial-1470M, ssial-980Y, ssial-1180Y, ga-980Y, ga-1180Y, ga-1470H |
| spark | 스파크 건 / LME 개선재 | 도금의 780급 이상 | ga-780Y, ga-980Y, ga-1180Y, ga-1470H |
| glass | 모래시계 / 시효 보증재 | 소부경화강(H) | ssial-340H, ga-340H |
| kettle | 구상화 항아리 / 구상화 소둔재 | 냉간압조용 · 베어링강 선재 | wr-CHQ, wr-SUJ |
| loupe | 루페 / 초청정재 | 베어링강 · 타이어코드 | wr-CORD, wr-SUJ |
| bath | 패턴팅 욕조 / LP 열처리재 | 경강 · 타이어코드 | wr-SWRH, wr-CORD |
| jominy | 조미니 봉 / 경화능 보증재 | 경화능 보증강(H강) | wr-CHQ |
| section | 탈탄 시편 / 탈탄 보증재 | 스프링강 계열 | wr-SPR, wr-VLV |

