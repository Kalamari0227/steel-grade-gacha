import {createHash} from 'node:crypto';
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export class PrototypeBuildError extends Error {}
export function check(value,message){if(!value) throw new PrototypeBuildError(message);}
export function section(source,from,to){
  check(source.split(from).length===2,`Ambiguous source start: ${from}`);
  const start=source.indexOf(from), end=source.indexOf(to,start);
  check(end>start,`Missing source end: ${to}`); return source.slice(start,end);
}
export function legacyModule(source,equipmentSource,toonSource,backupSource){
  const chunks={
    data:section(source,'var FAMS = [','var QUIZ = ['),
    img:section(source,'var IMG = {','var IMG_ALT = {'),
    init:section(source,'var POOL = Object.keys(IMG)','function today()'),
    window:section(source,'var DAY = 24 * 60','/* 남은 시간은 계속 흘러가니'),
    restore:section(source,'function applySaved(p){','function hasProgress(){'),
    random:section(source,'function allChars()','/* 확정 뽑기는'),
    missing:section(source,'function missingIn(lv){','/* ── 주문서'),
    findPart:section(source,'function findPart(key){','/* ── 선행개발'),
    qp:section(source,'var QP_ID  =','/* 열리는 순간'),
    stock:section(source,'function stockOf(','function partDone('),
    parts:section(source,'function partDone(','function ptImg('),
    pgrp:section(source,'var PGRP = [','function renderParts('),
    pending:section(source,'function sweepPending()','var drawState ='),
    single:section(source,'document.getElementById("btnPull").addEventListener("click", function(){','/* ── 10연 출하'),
    ten:section(source,'var SCRAP_TEN = 20, TEN_N = 10;','function showTen('),
    scrapPull:section(source,'function scrapPull(lv, cost){','document.getElementById("btnScrap3")'),
    /* 중복 스크랩은 원본에서 독립 함수가 아니라 #pullBox 클릭 핸들러의 data-draw-scrap 분기 안에 있다.
       그 분기에서 경제 상태만 바꾸는 원문 두 문장('if(stockOf(id) <= 1) return;'부터 DOM을 만지는
       'button.disabled = true;' 직전까지)만 그대로 뽑아 아래에서 function dupScrap(id){…}로 감싼다.
       시작 문자열은 원본에서 한 번만 나온다(section의 split 검사). 버튼 비활성화·문구·#drawStock 갱신은 화면 일이라 뺀다. */
    dupScrap:section(source,'if(stockOf(id) <= 1) return;','button.disabled = true;'),
    /* 차고 조회(hasCar·carAtOf·carsOwned·allCarsDone)는 원본에서 이어진 독립 함수 넷이다. CARS·findCar는 data 청크에 이미 들어 있다. */
    garage:section(source,'function hasCar(k){','function renderGarage(){'),
    /* 차량 확정은 원본에서 독립 함수가 아니라 renderCar 안 #takeCar 클릭 핸들러에 있다.
       takeCarGuard: 그 핸들러의 거절 조건 원문 'if(!carDone() || hasCar(k) || allCarsDone())'(바로 뒤 '{' 직전까지, 원본에서 한 번만 나옴).
       takeCar: 상태를 바꾸는 원문 'S.cars.push({k:k, at:Date.now()}); S.parts = {}; save(); refresh();'(화면 일인 GAME_GARAGE.showStage 직전까지). */
    takeCarGuard:section(source,'if(!carDone() || hasCar(k) || allCarsDone())','{'),
    takeCar:section(source,'S.cars.push({k:k, at:Date.now()});','GAME_GARAGE.showStage('),
    /* ── 3단계: 고객 요구와 보증 장비 ──
       items: 보증 항목 자료. 품종 묶음(SOFT·DEEP·BH·POHARD·UHSS·GA780)과 판정 도우미(cold·plate·sh·has·lvl), ITEMS 14종(fit 포함), ORDERS 14건.
         원본에서 IMG_ITEM 바로 뒤부터 FAMS 직전까지 이어진 구간 그대로다. IMG_ITEM(그림 자리 표시)은 화면 일이라 넣지 않는다. */
    items:section(source,'var SOFT   = [','var FAMS = ['),
    /* today: 원본 날짜 문자열(기기 현지 시각). init 청크가 'function today()' 직전에서 끝나므로 따로 뽑는다. */
    today:section(source,'function today(){','/* ── 진행 저장'),
    /* 주문서 판정: findItem 한 줄, 그 뒤 itImg(그림 태그, 화면 일)를 건너뛰고 findOrder·itemsOf·itemCount·dayHash·fitOwned·openOrders·pickOrder·todaysOrder. */
    findItem:section(source,'function findItem(k){','/* 아직 그림이 없는'),
    orders:section(source,'function findOrder(k){','function renderOrder(){'),
    /* 요구 회신은 원본에서 화면 함수 judge(key,btn) 안에 있다. 상태에 관한 원문 세 조각만 뽑아 아래 judge(expected,day,key)로 감싼다.
       judgeStale: 회신 시점 거절 조건 'if(!expected || S.orderKey!==expected … || !fitOwned(expected).length)' (바로 뒤 '{' 직전까지).
       judgeRight: 'var o=todaysOrder();if(!o || o.item!==expected)return;'부터 정답 지급 'S.items[o.item]=1;S.orderDone++;save();'까지(화면 일인 researchCue 직전까지). */
    judgeStale:section(source,'if(!expected || S.orderKey!==expected','{\n    res.textContent='),
    judgeRight:section(source,'var o=todaysOrder();if(!o || o.item!==expected)return;','\n    researchCue('),
    /* ── 4단계: 철강 퀴즈 ──
       quizData: QUIZ 413문항 배열 원문(구획 주석 18개 포함). 첫 화면 크기를 지키려고 legacy 본문에 넣지 않고 quiz.mjs로 따로 내보낸다.
       quizDraw: shuffleQ와 drawQuiz(둘 다 Math.random). 바로 뒤 #btnQuiz 시작 핸들러 직전까지.
       quizRelated: 해설의 관련 보유 소재 조회. renderQ 직전까지.
       quizWhen: 결과 화면의 '오늘/내일 HH:MM 갱신' 표기 fmtWhen(at). allChars 직전까지.
       quizSettle: 원본 renderQ의 결과 진입 처리. 'session.reward = 0;'부터 보상 계산 끝 'session.reward = S.extra - before;'가 든 if 블록의 닫는 괄호까지.
         그 뒤의 save()와 researchCue(화면 일)는 넣지 않는다. 아래 settleQuiz(pass)가 감싼다. */
    quizData:section(source,'var QUIZ = [','/* 그림이 들어온 강종만'),
    quizDraw:section(source,'function shuffleQ(q){','document.getElementById("btnQuiz")'),
    quizRelated:section(source,'function quizRelated(q){','function renderQ(){'),
    quizWhen:section(source,'function fmtWhen(at){','function allChars()'),
    quizSettle:section(source,'session.reward = 0;','save();\n      if(session.reward > 0)'),
    /* ── 5단계: 공지·행사 안내·출하 알림 ──
       notices: NOTICES 4건, curNotice, NOTICE, noticeOn. renderNotice 직전까지(원본에서 이어진 구간 그대로).
       bell: bellOK·bellOn 둘. renderBell 직전까지. 원본은 전역 Notification을 읽는다(아래 생성 코드가 같은 이름의 값을 주입한다).
       bellFire: 원본 fireBell의 판정 부분(알림 보내기 직전까지). bellDue로 감싼다.
       readyVar·readyCond·readyLast·readyBoot: 원본 wasReady 선언, watchReady의 전이 판정, wasReady 갱신, 부팅 때의 wasReady 초기화. readyEdge·bootReady로 감싼다.
       noticeAck·promoAck·promoEnd: 원본 checkNotice·checkPromo의 기록 문장. 원본은 안내가 열리는 순간 기록하지만 이번 단계는 확인·닫기를 누른 때만 부른다(호출 시점만 다르다). 각각 ackNotice·ackPromo·ackPromoEnd로 감싼다.
       bellOn5·bellOff5: 알림 버튼 클릭 핸들러의 켜기(권한 허용 뒤)·끄기 문장. bellEnable·bellDisable로 감싼다.
       rows: promoRows·promoSum(행사 혜택 목록과 한 줄 요약). span: fmtSpan(남은 시간 표기). */
    notices:section(source,'var NOTICES = [','\nfunction renderNotice(){'),
    bell:section(source,'function bellOK(){','\n\nfunction renderBell(){'),
    bellFire:section(source,'function fireBell(){','  var opt = { body:"오늘의 뽑기가 열렸습니다.'),
    readyVar:section(source,'var wasReady = null;','function watchReady(){'),
    readyCond:section(source,'  var r = pullRenewed();\n  if(wasReady === false && r){\n','    fireBell();'),
    readyLast:section(source,'  wasReady = r;','\n}\n\n/* ── 저장이 안 될 때'),
    readyBoot:section(source,'  wasReady = pullRenewed();\n  armBell();\n  checkNotice();','  armBell();\n  checkNotice();'),
    noticeAck:section(source,'function checkNotice(){','  save();\n  if(promoModal'),
    promoAck:section(source,'  if(promoOn()){\n    if(S.promoSeen !== PROMO.key){','      openPromo();'),
    promoEnd:section(source,'  } else if(Date.now() >= PROMO.to){','      showToast(PROMO.pick'),
    bellOn5:section(source,'      S.bell = true;\n','      save();\n      armBell();'),
    bellOff5:section(source,'    S.bell = false; save();','\n    clearTimeout(bellTimer);'),
    rows:section(source,'function promoRows(){','\n/* ── 공지사항'),
    span:section(source,'function fmtSpan(ms){','function promoWhen(){'),
    /* ── 6단계: 웹툰 목록과 읽음 표시 ──
       toon: TOON 회차 자료 원문(var TOON = [ … ];). 규칙 템플릿(source)이 아니라 웹툰 전용 고정 출처 toonSource(포크 e5c9673의 src/app_tpl.html 사본, src/upstream/app_tpl-e5c9673.html)에서 뽑는다.
             규칙 템플릿(6784048 기준)에는 연재 안내·1화·2화뿐이고, e5c9673은 3~7화와 특별편(sp01)을 더했다. e5c9673은 요일 증산도 행사 판정(curPromo)에 넣었으므로
             규칙은 옮기지 않고 웹툰 자료만 이 출처에서 읽는다(사용자 결정 2026-11-20). 그림 경로는 webtoon/…webp(승인 기록 current/approval/webtoon)다.
       toonKey: 'var TOON_SEEN = GAME_EDITION.toon;'(읽음 기록의 localStorage 키 이름. 진행 저장과 별개). 아래 생성 코드의 GAME_EDITION에 같은 이름의 값을 넣는다.
       toonRead: toonSeen·toonSeenIdx(읽은 마지막 회차 id와 위치. 값이 없거나 모르는 id면 ''·-1). 원본은 전역 localStorage를 읽는다(아래 생성 코드가 같은 이름의 값을 주입하며, 없으면 TypeError가 원문 try/catch에 잡혀 ''이 된다).
       toonWrite: 회차를 여는 순간의 기록 문장 'if(i > toonSeenIdx()){ try{ … }catch(e){} }'. toonMarkSeen(i)로 감싼다. */
    toon:section(toonSource,'var TOON = [','var TOON_SEEN = "sgg_toon_seen";'),
    toonKey:section(source,'var TOON_SEEN = GAME_EDITION.toon;','\nvar toonModal'),
    toonRead:section(source,'function toonSeen(){','function renderToonBtn(){'),
    toonWrite:section(source,'  if(i > toonSeenIdx()){ try{','\n  renderToonBtn();'),
    /* ── 7단계: 저장 완성(백업·복원·사본·진단·초기화) ──
       hasProgress: 진행이 있는지(발견·스크랩·아이템). 사본 복구가 필요한지 판정에 쓴다.
       code: 백업 코드 원문 CPFX·idShort·idLong·makePack·backupCatalog·makeCode·readCode·applyCode('/* ── 24시간 주기' 직전까지). GAME_BACKUP(아래 backup 청크)을 쓴다.
       runMode: 실행 방식(브라우저 탭·설치된 앱·내려받은 파일). idb: IndexedDB 사본 idbOpen·mirrorPut·mirrorGet(원본 bootRestore 직전까지).
       diag: idbProbe·storeDiag(저장 진단). 원본은 전역 localStorage·indexedDB·navigator·location·window를 읽는다(아래 생성 코드가 같은 이름의 값을 주입한다).
       needRestore: 원본 부팅의 'var needRestore = !loadFailed && !hasProgress();' 한 줄. restoreNeeded(loadFailed)로 감싼다.
       mirrorOk: 원본 bootRestore가 사본을 받아들이는 조건 'if(p && p.owned && Object.keys(p.owned).length)'. mirrorUsable(p)로 감싼다.
       reset: 초기화 클릭 핸들러의 새 상태 원문 'S = { … };'(알림·행사 확인 기록은 남김). resetProgress()로 감싼다. 뒤따르는 'loadFailed = false; save();'는 엔진이 다룬다.
       status: 백업 화면 문구 backupRestoreStatus·backupInputError·backupSummary(openBackup 직전까지). fmtDay: 마지막 백업 날짜 표기. */
    hasProgress:section(source,'function hasProgress(){','function load(){'),
    code:section(source,'var CPFX = [','/* ── 24시간 주기'),
    runMode:section(source,'/* 지금 어떤 방식으로 열려 있는지 */','/* IndexedDB 사본. 실패해도'),
    idb:section(source,'/* IndexedDB 사본. 실패해도','/* localStorage가 비어 있을 때'),
    diag:section(source,'/* IndexedDB에 실제로 써 보고 되읽어 봅니다 */','/* ── 기간 한정 프로모션 화면'),
    needRestore:section(source,'var needRestore = !loadFailed && !hasProgress();','\n'),
    mirrorOk:section(source,'    if(p && p.owned && Object.keys(p.owned).length)','{ applySaved(p);'),
    reset:section(source,'  S = { owned:{}, stock:{}, last:"", extra:0','  loadFailed = false; save();'),
    status:section(source,'function backupRestoreStatus(){','function openBackup(event){'),
    fmtDay:section(source,'function fmtDay(at){','function renderBackupWhen(){')
  };
  /* settleQuiz(pass): 원본 renderQ 결과 진입의 보상 문장을 감싼 최소 함수. 원문이 아닌 것은 다음뿐이다.
     - 'var session={};' 원본은 화면 세션 객체(qState)에 reward·rewardAllowed를 적는다. 같은 이름의 빈 객체를 안에 두어 원문을 한 글자도 바꾸지 않고 쓴다.
     - 끝의 'return session;' 원본은 그 객체를 화면 문구에 쓴다. 호출한 쪽이 reward·rewardAllowed를 읽는다.
     - pass 인자: 원본은 'var pass = session.right===session.qs.length;'(화면 쪽 줄)로 얻는다. 채점은 엔진 세션이 같은 식으로 한다.
     원본 save()는 이 함수 밖이다(엔진이 저장 먼저 시도 규칙으로 다룬다). */
  /* ── 5단계 감싸는 함수. 원문이 아닌 줄만 적는다(나머지는 위 청크 원문 그대로).
     bellDue: 'function fireBell(){' → 'function bellDue(){'(이름만), 끝의 'return true;'. 원본은 이 뒤에서 알림을 보내지만 그것은 화면 일이다. 판정에서 거절되면 원문 'return;'이 undefined를 돌려준다.
     readyEdge: 'var edge = false;', 판정이 참일 때의 'edge = true;'와 닫는 '}', 끝의 'return edge;'. 원본은 그 자리에서 fireBell·showToast·renderBell을 부른다(화면 일).
     bootReady: 원문 한 줄을 함수로 감싼 것뿐이다. 원본은 부팅 콜백 안에서 같은 줄을 실행한다.
     ackNotice: 원문 checkNotice에서 이름만 바꾸고 끝의 'return true;'를 붙였다. 뒤따르는 save()·창 열기·noticeBell은 넣지 않는다(엔진이 저장 먼저 시도 규칙으로 다룬다).
     ackPromo·ackPromoEnd: 원문 조각 앞의 'function …(){'(와 ackPromoEnd는 'if(promoOn()){' 한 줄), 뒤의 'return true;'와 닫는 괄호들. 원본은 그 뒤에서 창을 열거나 토스트를 띄운다(화면 일).
     bellEnable·bellDisable: 클릭 핸들러의 문장을 함수로 감싸고 뒤에 save()를 붙였다(원문 순서 그대로: 켜기는 S.bell·belledAt 뒤 save()). 권한 확인은 엔진이 먼저 한다. */
  const bellDue=chunks.bellFire.replace('function fireBell(){','function bellDue(){')+'  return true;\n}';
  const readyEdge='function readyEdge(){\n  var edge = false;\n'+chunks.readyCond+'    edge = true;\n  }\n'+chunks.readyLast+'\n  return edge;\n}';
  const bootReady='function bootReady(){\n'+chunks.readyBoot+'}';
  const ackNotice=chunks.noticeAck.replace('function checkNotice(){','function ackNotice(){')+'  return true;\n}';
  const ackPromo='function ackPromo(){\n'+chunks.promoAck.trimEnd()+'\n      return true;\n    }\n  }\n}';
  const ackPromoEnd='function ackPromoEnd(){\n  if(promoOn()){\n'+chunks.promoEnd.trimEnd()+'\n      return true;\n    }\n  }\n}';
  const bellEnable='function bellEnable(){\n'+chunks.bellOn5+'      save();\n}';
  const bellDisable='function bellDisable(){\n'+chunks.bellOff5+'\n  return true;\n}';
  /* toonMarkSeen(i): 원본 openToonView(i) 안의 읽음 기록 문장을 감싼 최소 함수. 원문이 아닌 것은 다음뿐이다.
     - 첫 줄 'var t = TOON[i];' 원본 openToonView가 같은 식으로 t를 얻는다(원문 한 줄을 그대로 옮김).
     - 끝의 'return toonSeenIdx() >= i;' 쓰기가 실제로 남았는지 되읽은 값. 원본은 실패를 조용히 무시하고(try/catch) 이 값은 없다. 화면은 쓰지 않고 시험이 쓴다. */
  /* toonScope: 원문이 아닌 한 줄. 승인한 회차(GAME_EDITION.toonScope = 연재 안내·1~7화)만 남긴다. 특별편 sp01은 그림 승인 전이라 뺀다(사용자 결정 2026-11-20).
     원본 배열의 순서와 내용은 바꾸지 않는다. 특별편은 맨 끝 회차라 앞 회차들의 위치(toonSeenIdx)는 원본과 같다. */
  const toonScope='TOON = TOON.filter(function(t){ return GAME_EDITION.toonScope.indexOf(t.id) >= 0; });';
  const toonMarkSeen='function toonMarkSeen(i){\n  var t = TOON[i];\n'+chunks.toonWrite+'\n  return toonSeenIdx() >= i;\n}';
  const settleQuiz='function settleQuiz(pass){\n  var session={};\n  '+chunks.quizSettle.trimEnd()+'\n  return session;\n}';
  /* 장착은 원본 openPickTarget이 이전 게임 모듈 GAME_EQUIPMENT(src/game/equipment.js, 템플릿의 <!-- GAME_EQUIPMENT --> 자리에 들어감)로 넘긴다.
     그 모듈에서 상태에 관한 원문 둘만 뽑는다: 장착 가능 판정 available(key,id)와 확정 문장 'S.items[current.key] = current.id; save();'(화면 일인 GAME_AV.cue 직전까지). */
  const equipChunks={
    available:section(equipmentSource,'function available(key, id) {','function stale()'),
    equipSet:section(equipmentSource,'S.items[current.key] = current.id;','GAME_AV.cue(\'equip.attach\');')
  };
  /* 백업 코드 형식은 템플릿의 <!-- GAME_BACKUP --> 자리에 들어가는 이전 게임 모듈 GAME_BACKUP(src/game/backup.js)에 있다. 장비와 같은 방식으로 SHA를 고정하고
     'var GAME_BACKUP = (function(){'부터 끝의 '})();'까지 그대로 넣는다(앞의 한 줄 주석만 뺀다). */
  const backupChunks={backup:section(backupSource,'var GAME_BACKUP = (function(){','\n})();')+'\n})();'};
  /* 7단계 감싸는 함수. 원문이 아닌 줄만 적는다.
     restoreNeeded(loadFailed): 원문 한 줄을 함수로 감싸고 'return needRestore;'. 원본의 전역 loadFailed를 인자로 받는다(엔진의 불러오기 실패·손상 보류).
     mirrorUsable(p): 원문 조건 뒤 ' return true;'와 'return false;'. 원본은 그 자리에서 applySaved(p)·release(true)를 부른다(엔진이 한다).
     resetProgress(): 원문 새 상태를 함수로 감싼 것뿐이다. */
  const restoreNeeded='function restoreNeeded(loadFailed){\n'+chunks.needRestore+'\n  return needRestore;\n}';
  const mirrorUsable='function mirrorUsable(p){\n'+chunks.mirrorOk.trimEnd()+' return true;\n  return false;\n}';
  const resetProgress='function resetProgress(){\n'+chunks.reset.trimEnd()+'\n}';
  const single=chunks.single.replace('document.getElementById("btnPull").addEventListener("click", function(){','function single(){').replace(/\}\);\s*$/,'}');
  const dupScrap='function dupScrap(id){\n    '+chunks.dupScrap.trimEnd()+'\n}';
  /* 원문이 아닌 줄은 둘뿐이다: 거절 조건 뒤 'return false;'(원본은 거기서 renderCar·안내 문구 후 return — 화면 일이라 뺐다)와
     끝의 'return true;'(확정했음을 알리는 값). 원본처럼 k가 CARS에 있는지는 이 조건이 보지 않는다(원본은 바깥 버튼 핸들러의 findCar 검사가 막는다). */
  const takeCar='function takeCar(k){\n    '+chunks.takeCarGuard+' return false;\n    '+chunks.takeCar.trimEnd()+'\n    return true;\n}';
  /* judge(expected,day,key): 원본 judge의 화면 일(버튼·결과 문구·효과음)을 뺀 최소 함수. 원문이 아닌 것은 다음뿐이다.
     - 첫 줄 'var pickBox={dataset:{orderKey:expected,orderDay:day}};' — 원본은 요구를 연 순간의 요구·날짜를 대화창 dataset에 적어 두고 회신 때 읽는다.
       그 두 값을 인자로 받아 같은 이름으로 놓아, 거절 조건 원문을 한 글자도 바꾸지 않고 쓴다. 이 pickBox는 함수 안에만 있다.
     - 거절 조건 뒤 'return null;'(원본은 거기서 안내 문구 후 return), 정답 지급 뒤 'return true;'와 닫는 '}', 끝의 'return false;'(오답: 원본도 상태를 바꾸지 않는다).
     - 원본에서 todaysOrder()가 요구를 바꿔 'o.item!==expected'로 끝나면 원문 'return;'이 그대로 undefined를 돌려준다(거절). */
  const judge='function judge(expected,day,key){\n  var pickBox={dataset:{orderKey:expected,orderDay:day}};\n  '+chunks.judgeStale.trimEnd()+' return null;\n  '+chunks.judgeRight.trimEnd()+'\n    return true;\n  }\n  return false;\n}';
  /* equip(key,id): 원본 confirm의 확정 문장을 감싼 최소 함수. 원문이 아닌 줄은 'if(!available(key,id)) return false;'(원본 confirm의 같은 검사 'if (!available(current.key,current.id)) { stale(); return; }'에서
     화면 일인 stale()만 뺌), 'var current={key:key,id:id};'(원본 선택 상태 selection의 두 값), 끝의 'return true;'. */
  const equip='function equip(key,id){\n  if(!available(key,id)) return false;\n  var current={key:key,id:id};\n  '+equipChunks.equipSet.trimEnd()+'\n  return true;\n}';
  const body=[chunks.data,chunks.img,chunks.init,chunks.restore,chunks.window,chunks.random,chunks.missing,chunks.findPart,chunks.qp,chunks.stock,chunks.parts,chunks.pgrp,chunks.pending,single,chunks.ten,chunks.scrapPull,dupScrap,chunks.garage,takeCar,chunks.items,chunks.today,chunks.findItem,chunks.orders,judge,equipChunks.available,equip,chunks.quizDraw,chunks.quizRelated,chunks.quizWhen,settleQuiz,chunks.notices,chunks.bell,bellDue,chunks.readyVar,readyEdge,bootReady,ackNotice,ackPromo,ackPromoEnd,bellEnable,bellDisable,chunks.rows,chunks.span,chunks.toon,toonScope,chunks.toonKey,chunks.toonRead,toonMarkSeen,backupChunks.backup,chunks.hasProgress,chunks.code,chunks.runMode,chunks.idb,chunks.diag,restoreNeeded,mirrorUsable,resetProgress,chunks.status,chunks.fmtDay].join('\n');
  /* Date: 원본 today()가 'new Date()'(인자 없음 = 지금)를 쓰므로, 주입한 now로 만든 날짜를 돌려주는 생성 가능한 함수로 둔다. Date.now·Date.UTC는 전과 같다. */
  const generated=`// Exact source sections extracted by prepare.mjs; no legacy UI/assets.\nexport function createLegacy({random=Math.random,now=Date.now,onSave=()=>{},onResult=()=>{},notification=undefined,storage=undefined,idb=undefined,env={}}={}){\nconst Math=Object.create(globalThis.Math); Math.random=random; const Date=Object.assign(function(...a){return new globalThis.Date(...(a.length?a:[now()]));},{now,UTC:globalThis.Date.UTC}); const GAME_EDITION={save:'sgg_game_save_v1',toon:'sgg_game_toon_seen',toonScope:['s00','ep01','ep02','ep03','ep04','ep05','ep06','ep07'],database:'sgg_game',store:'save'}; const Notification=notification; const localStorage=storage; const indexedDB=idb; const navigator=env.navigator; const location=env.location; const window=env.window; var loadFailed=false, saveHold=false, storeWarn='';\n${body}\nvar QUIZ=[]; function setQuiz(list){QUIZ=list;} function drawBusy(){return false;} function armBell(){} function askPersist(){} function refresh(){} function save(){onSave(S);} function showPull(id,fresh){onResult([id],[fresh]);} function showTen(ids,fresh){onResult(ids,fresh);}\nreturn {state:()=>S,setState:value=>{S=value;},applySaved,single,ten:tenPull,pullsLeft,pullBaseLeft,pullWindowOpen,pullRenewed,readyIn,fmtWait,DAY,tenReady,allChars,findChar,lvOf,specOf,rareOf,partPlan,parts:PARTS,use:USE,pool:POOL,weightedPick,qpRevealed,hasQP,addStock,qp:{id:QP_ID,keys:QP_KEY,need:QP_NEED,scrap:QP_SCRAP},missingIn,scrapPull,dupScrap,findPart,qpCovers,slotOk,partReady,partDone,partCount,partsReadyCount,carDone,craft,stockOf,sweepPending,PGRP,SCRAP_LV3,SCRAP_LV4,CARS,findCar,hasCar,carAtOf,carsOwned,allCarsDone,takeCar,ITEMS,ORDERS,ORDER_MAX,orderMax,today,findItem,findOrder,itemsOf,itemCount,dayHash,fitOwned,openOrders,pickOrder,todaysOrder,judge,available,equip,QUIZ_MAX,quizMax,promoOn,quizWindowOpen,quizLeft,quizReady,setQuiz,shuffleQ,drawQuiz,quizRelated,fmtWhen,settleQuiz,PULL_MAX,PROMOS,NOTICES,curPromo,curNotice,noticeOn,notice:()=>NOTICE,promo:()=>PROMO,promoSoon,promoLeft,promoIn,nextPromo,pullMax,pullReady,famName,pickX,bellOK,bellOn,bellDue,readyEdge,bootReady,ackNotice,ackPromo,ackPromoEnd,bellEnable,bellDisable,promoRows,promoSum,fmtSpan,TOON,toonSeen,toonSeenIdx,toonMarkSeen,GAME_BACKUP,hasProgress,makePack,makeCode,readCode,applyCode,backupCatalog,runMode,mirrorPut,mirrorGet,idbProbe,storeDiag,restoreNeeded,mirrorUsable,resetProgress,backupRestoreStatus,backupInputError,backupSummary,fmtDay};\n}\n`;
  const quiz=`// Exact QUIZ source (413 questions) extracted by prepare.mjs from the pinned template.\nexport ${chunks.quizData.trimEnd()}\n`;
  return {generated,quiz,chunks:Object.fromEntries(Object.entries({...chunks,...equipChunks,...backupChunks}).map(([key,value])=>[key,sha(value)]))};
}
