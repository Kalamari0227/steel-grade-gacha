// 주행 시험장 판정 규칙(관문 2 시제품, docs/plans/racing-plan-2026-11-22.md "판정 규칙 확정").
// 새 기준값을 만들지 않는다. 부품 35의 "필요 소재" 목록과 카드의 계열만 쓴다. 관문 4에서 game/src/race-rules.mjs로 옮긴다.
export const SLOTS = [
  {key: 'body', name: '바디', tests: '우박 · 염수'},
  {key: 'frame', name: '프레임', tests: '충돌'},
  {key: 'chassis', name: '섀시', tests: '요철 · 염수'}
];
export const SECTIONS = [
  {key: 'hail', name: '우박 구간', test: '외판이 패이지 않는가'},
  {key: 'salt', name: '염수 눈길', test: '녹이 슬지 않는가'},
  {key: 'crash', name: '충돌 시험 벽', test: '실내가 버티는가'},
  {key: 'bumps', name: '장거리 요철', test: '바퀴·축이 오래 가는가'}
];
export const CRASH_PARTS = ['sill', 'bumper', 'apillar', 'bpillar', 'impact'];
export const PENALTY = 2;

// data: data.json의 {cards, parts}. 카드마다 어느 시험 자리의 소재인지, 그 근거가 된 부품 이름을 모은다.
export function materialRoles(data) {
  const roles = new Map(data.cards.map(c => [c.id, {outer: [], crash: [], chassis: [], coated: c.familyKind.includes('도금')}]));
  for (const part of data.parts) {
    for (const need of part.need) {
      for (const id of need.any) {
        const r = roles.get(id); if (!r) continue;
        if (need.n.includes('외판') && !r.outer.includes(part.name)) r.outer.push(part.name);
        if (CRASH_PARTS.includes(part.key) && !r.crash.includes(part.name)) r.crash.push(part.name);
        if (part.grp === '섀시 · 구동' && !r.chassis.includes(part.name)) r.chassis.push(part.name);
      }
    }
  }
  // 선행개발 QP는 본편에서 어느 부품 칸에나 대신 쓸 수 있다. 충돌 벽에서는 카드의 용도(B 필러·사이드 실)를 근거로 든다.
  const qp = data.cards.find(c => c.level === 5);
  if (qp) roles.get(qp.id).crash.push(...qp.use.split(' · ').slice(0, 2));
  return roles;
}

// 받침 판정: 한글은 글자로, 숫자·영문은 읽는 소리로(1470M → '엠', 받침 있음).
const josa = (word, pair) => {
  const last = word[word.length - 1], code = last.charCodeAt(0) - 0xac00;
  const batchim = code >= 0 && code <= 11171 ? code % 28 !== 0 : /[013678LMNRlmnr]/.test(last);
  return word + (batchim ? pair[0] : pair[1]);
};
const label = card => card ? card.familyName + ' ' + card.grade : '표준 강판';

// picks: {body, frame, chassis} 카드 ID 또는 ''. 결과: 구간마다 {pass, reason}.
export function judge(data, roles, picks) {
  const card = id => data.cards.find(c => c.id === id) || null;
  const body = card(picks.body), frame = card(picks.frame), chassis = card(picks.chassis);
  const r = c => c ? roles.get(c.id) : null;
  const list = names => names.slice(0, 2).join('·');
  const out = {};
  out.hail = r(body)?.outer.length
    ? {pass: true, reason: list(r(body).outer) + ' 같은 외판에 쓰는 ' + josa(label(body), ['이라', '라']) + ' 우박을 맞아도 패이지 않았어요.'}
    : {pass: false, reason: '바디 칸의 ' + josa(label(body), ['은', '는']) + ' 외판 자리 소재가 아니라 작은 자국이 남았어요.'};
  const coated = [body, chassis].find(c => c && r(c).coated);
  out.salt = coated
    ? {pass: true, reason: '아연도금된 ' + josa(label(coated), ['이', '가']) + ' 염화칼슘 눈길에서도 녹을 막았어요.'}
    : {pass: false, reason: '바디·섀시 칸에 도금재가 없어 염수에 녹이 비쳤어요.'};
  out.crash = r(frame)?.crash.length
    ? {pass: true, reason: list(r(frame).crash) + '에 쓰는 ' + josa(label(frame), ['이', '가']) + ' 충돌을 받아 실내 공간이 버텼어요.'}
    : {pass: false, reason: '프레임 칸의 ' + josa(label(frame), ['은', '는']) + ' 충돌을 받는 필러·범퍼 빔 자리 소재가 아니라 실내가 조금 밀렸어요.'};
  out.bumps = r(chassis)?.chassis.length
    ? {pass: true, reason: list(r(chassis).chassis) + '에 쓰는 ' + josa(label(chassis), ['이라', '라']) + ' 긴 요철에도 바퀴와 축이 버텼어요.'}
    : {pass: false, reason: '섀시 칸의 ' + josa(label(chassis), ['은', '는']) + ' 바퀴·축 자리 소재가 아니라 진동이 커졌어요.'};
  return out;
}

// 차급의 성격: 속도는 모두 같고 차폭과 흔들림만 다르다.
export function carTrait(body) {
  if (body.startsWith('경형')) return {width: 0.62, shake: 1.4, note: '차폭이 좁아 사이로 빠져나가기 쉬워요.'};
  if (/대형|SUV|미니밴/.test(body)) return {width: 0.86, shake: 0.5, note: '차폭이 넓지만 요철에서 덜 흔들려요.'};
  return {width: 0.74, shake: 1, note: '기준이 되는 차폭이에요.'};
}
