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
    '스크랩 ' + state.scrap,
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
