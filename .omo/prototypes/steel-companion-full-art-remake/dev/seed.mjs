// 로컬 검토 전용 저장 시드. 공개 체험판(public/)에는 없다. 엔진이 정규화한 현재 저장을 바탕으로 값만 바꿔 쓴다.
import {createEngine, SAVE_KEY} from '/engine.mjs';

const DAY = 24 * 60 * 60 * 1000;
const current = document.querySelector('#current');
const actions = document.querySelector('#actions');
const out = document.querySelector('#out');
const local = ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname);

function read() {
  const storage = {getItem: key => localStorage.getItem(key), setItem() { throw new Error('read only'); }};
  return createEngine({storage});
}
function render() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw === null) { current.textContent = '저장 없음 (새 프로필)'; return; }
  const engine = read(), status = engine.status(), state = engine.state();
  if (status.blocked) { current.textContent = '저장을 읽을 수 없어 보류 중입니다: ' + status.warning + '\n시드 기능을 쓰지 않습니다.'; return; }
  current.textContent = [
    '발견 ' + Object.keys(state.owned).length + '종 · 재고 ' + Object.values(state.stock).reduce((a, b) => a + b, 0) + '장',
    '남은 출하 ' + status.singleLeft + '회 (기본 ' + status.baseLeft + ' + 추가 ' + state.extra + ')' + (status.wait ? ' · 다음 출하까지 ' + status.wait : ''),
    '보증 ' + engine.warranties().owned + ' / 14 · 장착 ' + engine.warranties().items.filter(i => i.state === 'equipped').length + ' · 오늘 요구 회신 ' + state.orderDone + '건\n' + '스크랩 ' + state.scrap + ' · 부품 완성 ' + engine.partList().count + ' / 35 · 자동차 ' + state.cars.length + ' / 8',
    '마지막 기본 출하 ' + (state.pullAt ? new Date(state.pullAt).toLocaleString('ko-KR') : '없음') + ' · 사용 ' + state.pullUsed + '회'
  ].join('\n');
}
function write(change) {
  const raw = localStorage.getItem(SAVE_KEY);
  const engine = raw === null ? createEngine({storage: {getItem: () => null, setItem() {}}}) : read();
  if (engine.status().blocked) { out.textContent = '저장이 보류 상태라 바꾸지 않았습니다.'; return; }
  const state = engine.state();
  change(state, engine);
  const next = JSON.stringify(state);
  localStorage.setItem(SAVE_KEY, next);
  const check = read();
  out.textContent = check.status().blocked ? '쓴 값이 검사를 통과하지 못했습니다: ' + check.status().warning : '저장했습니다. 열린 게임 탭은 새로고침하세요.';
  render();
}
const ACTIONS = {
  resources: () => write(s => { s.extra += 50; s.scrap += 400; }),
  renew: () => write(s => { s.pullAt = Date.now() - DAY - 1000; s.pullUsed = 1; }),
  almost: () => write(s => { s.pullAt = Date.now() - DAY + 60 * 1000; s.pullUsed = 1; s.extra = 0; }),
  scrap: () => write(s => { s.scrap += 30; }),
  // 중복 스크랩 확인용: 낮은 등급 동료 10종 중 앞 6종을 3장, 나머지를 1장으로 만들고 이 10장을 마지막 10연 결과로 둔다.
  dupes: () => write((s, engine) => {
    const ids = engine.catalog().filter(c => c.level <= 2 && c.id !== 'qp-1470').slice(0, 10).map(c => c.id);
    ids.forEach((id, i) => { s.owned[id] = true; s.stock[id] = i < 6 ? 3 : Math.max(s.stock[id] || 0, 1); });
    s.results = {id: 'seed-' + Date.now(), at: Date.now(), mode: 'ten', cards: ids.map(id => ({id, isNew: false, stock: s.stock[id]}))};
  }),
  // 제작 확인용: 앞쪽 부품 8개를 바로 만들 수 있게, 칸마다 첫 후보를 1장씩 더한다(이미 완성한 부품은 건너뜀).
  parts: () => write((s, engine) => {
    const rows = engine.partList().groups.flatMap(g => g.parts).filter(p => p.state !== 'done').slice(0, 8);
    for (const row of rows) for (const slot of engine.partDetail(row.key).slots) { const id = slot.candidates[0].id; s.owned[id] = true; s.stock[id] = (s.stock[id] || 0) + 1; }
  }),
  // 차고 확인용: 부품 35개를 모두 완성한 상태(차량 선택·확정 화면). 이미 가진 차량은 그대로 둔다.
  fullparts: () => write((s, engine) => {
    for (const p of engine.partList().groups.flatMap(g => g.parts)) s.parts[p.key] = {at: Date.now(), use: []};
  }),
  // 차고 확인용: 차량 3대를 가진 상태(받은 날이 서로 다름)로 두고 부품은 건드리지 않는다. 한 번 더 누르면 7대까지 채운다.
  cars: () => write((s, engine) => {
    const keys = engine.garage().cars.map(c => c.key), have = s.cars.length, next = have < 3 ? 3 : 7;
    s.cars = keys.slice(0, next).map((k, i) => ({k, at: Date.now() - (next - i) * 3600 * 1000}));
  }),
  // 3단계 검토용 — 보증·요구. 모두 동료를 전부 발견(재고 2장)한 상태를 바탕으로 한다. 정식 규칙의 값만 쓴다(원본 today()와 같은 날짜 문자열).
  // 새 요구: 보증 없음, 오늘 요구가 아직 열리지 않은 상태(요구 화면을 열면 오늘의 요구가 나온다).
  ware0: () => write((s, engine) => {
    for (const {id} of engine.catalog()) { s.owned[id] = true; s.stock[id] = Math.max(s.stock[id] || 0, 2); }
    s.items = {}; s.orderDay = ''; s.orderKey = ''; s.orderDone = 0;
  }),
  // 보증 5종 획득(미장착 3 · 장착 2)과 오늘 몫을 다 쓴 날: 보증서 목록의 세 상태와 "오늘 회신 횟수를 모두 사용" 확인용.
  ware5: () => write((s, engine) => {
    for (const {id} of engine.catalog()) { s.owned[id] = true; s.stock[id] = Math.max(s.stock[id] || 0, 2); }
    const fit = {};
    for (const {id} of engine.catalog()) for (const it of engine.cardItems(id)) (fit[it.key] ||= []).push(id);
    const keys = Object.keys(fit);
    s.items = {};
    keys.slice(0, 3).forEach(k => { s.items[k] = 1; });
    keys.slice(3, 5).forEach(k => { s.items[k] = fit[k][0]; });
    const d = new Date(); s.orderDay = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    s.orderKey = keys[0]; s.orderDone = 1;
  }),
  // 보증 14종 모두 획득·한 동료에 여러 개 장착: 4종을 한 동료에 모두 건다(승인 외형 4장착 확인용). 나머지는 획득만.
  ware14: () => write((s, engine) => {
    for (const {id} of engine.catalog()) { s.owned[id] = true; s.stock[id] = Math.max(s.stock[id] || 0, 2); }
    const fit = {};
    for (const {id} of engine.catalog()) for (const it of engine.cardItems(id)) (fit[it.key] ||= []).push(id);
    s.items = {};
    for (const k of Object.keys(fit)) s.items[k] = 1;
    const four = engine.catalog().map(c => c.id).find(id => engine.cardItems(id).length === 4);
    if (four) for (const it of engine.cardItems(four)) s.items[it.key] = four;
    const d = new Date(); s.orderDay = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); s.orderKey = ''; s.orderDone = 1;
  }),
  all: () => write((s, engine) => { for (const {id} of engine.catalog()) { s.owned[id] = true; if (!s.stock[id]) s.stock[id] = 1; } }),
  download() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw === null) { out.textContent = '내려받을 저장이 없습니다.'; return; }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([raw], {type: 'application/json'}));
    link.download = 'sgg-game-save-local.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  },
  clear() {
    if (!confirm('이 브라우저(로컬 서버 주소)의 정식 저장을 지웁니다. 먼저 내려받기를 권합니다. 계속할까요?')) return;
    localStorage.removeItem(SAVE_KEY);
    out.textContent = '정식 저장을 지웠습니다. 게임을 열면 새 프로필입니다.';
    render();
  }
};
if (!local) {
  current.textContent = '로컬 서버(127.0.0.1)에서만 쓸 수 있습니다.';
} else {
  actions.hidden = false;
  actions.addEventListener('click', event => {
    const act = event.target.closest('[data-act]')?.dataset.act;
    if (act) ACTIONS[act]();
  });
  render();
}
