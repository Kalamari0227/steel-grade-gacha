// 주행 시험장 판정 규칙(확장 A 관문 4, docs/plans/racing-plan-2026-11-22.md "판정 규칙 2판").
// 시제품 docs/design/game-racing-2026-11-22-u0/race-rules.mjs에서 옮겼다(내용은 같다).
// 새 기준값을 만들지 않는다. data.json의 부품 35 "필요 소재" 목록·부품 묶음과 카드의 계열만 읽는다.
// 저장·경제·화면을 건드리지 않는 순수 함수다. 본편 엔진(engine.mjs)을 불러오지 않는다.
//   최적: 그 시험이 보는 부품의 필요 소재      통함: 같은 묶음(바디/프레임/섀시 · 구동)의 다른 부품 소재      보통: 그 밖
export const SLOTS = [
  {key: 'body', name: '바디', group: '바디'},
  {key: 'frame', name: '프레임', group: '프레임'},
  {key: 'chassis', name: '섀시', group: '섀시 · 구동'}
];
// parts: 최적으로 보는 부품. need: 그 부품의 필요 소재 가운데 이름에 이 말이 든 칸만 본다.
export const SECTION = {
  hail: {key: 'hail', name: '우박 구간', test: '외판이 패이지 않는가', slot: 'body', parts: ['hood', 'dooro'], need: '소부경화',
    focus: '소부경화 외판', text: ['깊게 패였어요.', '얕은 자국이 남았어요.', '우박을 맞아도 패이지 않았어요.']},
  salt: {key: 'salt', name: '염수 눈길', test: '녹이 슬지 않는가', slot: 'body', also: 'chassis', parts: ['whouse', 'floor'],
    focus: '바닥용 도금재', text: ['녹이 비쳤어요.', '녹을 늦췄어요.', '염화칼슘 눈길에서도 녹을 막았어요.']},
  crash: {key: 'crash', name: '충돌 시험 벽', test: '실내가 버티는가', slot: 'frame', parts: ['bumper'],
    focus: '범퍼 빔', text: ['벽 앞에서 실내가 밀렸어요.', '벽은 넘었지만 앞이 많이 찌그러졌어요.', '시험 벽을 받아 내고 실내가 버텼어요.']},
  side: {key: 'side', name: '측면 충돌 구간', test: '옆구리가 버티는가', slot: 'frame', parts: ['bpillar', 'impact'],
    focus: 'B 필러·도어 임팩트 빔', text: ['옆에서 받히자 크게 밀렸어요.', '문이 조금 밀려 들어왔어요.', '옆에서 받혀도 문이 버텼어요.']},
  twist: {key: 'twist', name: '비틀림 굽잇길', test: '차체가 뒤틀리지 않는가', slot: 'frame', parts: ['crossm', 'roofx'],
    focus: '크로스멤버', text: ['차체가 크게 뒤틀려 바깥으로 밀렸어요.', '차체가 조금 뒤틀렸어요.', '굽은 길에서도 차체가 뒤틀리지 않았어요.']},
  bumps: {key: 'bumps', name: '장거리 요철', test: '흔들림을 받아 내는가', slot: 'chassis', parts: ['spring', 'stabil'],
    focus: '스프링·스태빌라이저', text: ['진동이 커졌어요.', '흔들림이 조금 남았어요.', '긴 요철을 부드럽게 넘었어요.']},
  climb: {key: 'climb', name: '급경사 언덕', test: '힘이 줄지 않는가', slot: 'chassis', parts: ['crank', 'conrod', 'vspring'],
    focus: '엔진·구동 부품', text: ['오르막에서 힘이 많이 빠졌어요.', '오르막에서 조금 처졌어요.', '가파른 오르막에서도 힘이 줄지 않았어요.']},
  speed: {key: 'speed', name: '고속 주회로', test: '바퀴가 오래 버티는가', slot: 'chassis', parts: ['tire', 'bearing'],
    focus: '타이어·베어링', text: ['고속에서 바퀴가 떨려 속도를 못 냈어요.', '고속에서 떨림이 조금 있었어요.', '고속에서도 바퀴가 조용히 돌았어요.']}
};
export const COURSES = [
  {key: 'base', name: '기본 시험로', note: '바디 칸이 두 구간을 맡아요.', secs: ['hail', 'salt', 'crash', 'bumps']},
  {key: 'winter', name: '겨울 고갯길', note: '눈길과 언덕, 굽잇길이 이어져요.', secs: ['salt', 'climb', 'twist', 'hail']},
  {key: 'safety', name: '충돌 안전 시험장', note: '프레임 칸이 두 구간을 맡아요.', secs: ['side', 'hail', 'bumps', 'crash']},
  {key: 'oval', name: '고속 주회로', note: '섀시 칸이 두 구간을 맡아요.', secs: ['speed', 'salt', 'twist', 'climb']}
];
export const TIER = ['보통', '통함', '최적'];

// data: data.json의 {cards, parts}. 카드마다 최적인 구간(근거 부품 이름)과 속한 묶음(근거 부품 이름), 도금 여부를 모은다.
export function materialRoles(data) {
  const roles = new Map(data.cards.map(c => [c.id, {best: {}, group: {}, coated: c.familyKind.includes('도금')}]));
  const add = (obj, key, name) => { (obj[key] ||= []).includes(name) || obj[key].push(name); };
  for (const part of data.parts) for (const need of part.need) for (const id of need.any) {
    const r = roles.get(id); if (!r) continue;
    add(r.group, part.grp, part.name);
    for (const sec of Object.values(SECTION)) if (sec.parts.includes(part.key) && (!sec.need || need.n.includes(sec.need))) add(r.best, sec.key, part.name);
  }
  // 선행개발 QP는 본편에서 1470급 칸을 대신한다. 충돌 두 구간에서는 카드의 용도(B 필러·사이드 실)를 근거로 최적, 프레임 묶음으로 본다.
  const qp = data.cards.find(c => c.level === 5);
  if (qp) { const r = roles.get(qp.id), use = qp.use.split(' · ').map(s => s.trim()).slice(0, 2); r.best.crash = use; r.best.side = use; r.group['프레임'] = use; }
  return roles;
}

// 받침 판정: 한글은 글자로, 숫자·영문은 읽는 소리로(1470M → '엠', 받침 있음).
const josa = (word, pair) => {
  const last = word[word.length - 1], code = last.charCodeAt(0) - 0xac00;
  const batchim = code >= 0 && code <= 11171 ? code % 28 !== 0 : /[013678LMNRlmnr]/.test(last);
  return word + (batchim ? pair[0] : pair[1]);
};
const label = card => card ? card.familyName + ' ' + card.grade : '표준 강판';
const list = names => names.slice(0, 2).join('·');

// picks: {body, frame, chassis} 카드 ID 또는 ''. 결과: 구간 종류마다 {tier: 0 보통 | 1 통함 | 2 최적, slot, card, reason}.
export function judge(data, roles, picks) {
  const card = id => data.cards.find(c => c.id === id) || null;
  const out = {};
  for (const sec of Object.values(SECTION)) {
    const grade = slotKey => {
      const c = card(picks[slotKey]), r = c ? roles.get(c.id) : null, slot = SLOTS.find(s => s.key === slotKey);
      if (sec.key === 'salt') {                   // 염수만 계열(아연도금)을 본다. 바닥(휠하우스·플로어) 도금재면 최적.
        if (r?.best.salt) return {tier: 2, slot, card: c, reason: list(r.best.salt) + '에 쓰는 도금재 ' + josa(label(c), ['이', '가']) + ' ' + sec.text[2]};
        if (r?.coated) return {tier: 1, slot, card: c, reason: '아연도금된 ' + josa(label(c), ['이', '가']) + ' ' + sec.text[1] + ' 바닥용 도금재는 아니에요.'};
        return {tier: 0, slot, card: c, reason: '바디·섀시 칸에 도금재가 없어 ' + sec.text[0]};
      }
      if (r?.best[sec.key]) return {tier: 2, slot, card: c, reason: list(r.best[sec.key]) + '에 쓰는 ' + josa(label(c), ['이라', '라']) + ' ' + sec.text[2]};
      if (r?.group[slot.group]) return {tier: 1, slot, card: c, reason: josa(label(c), ['은', '는']) + ' ' + list(r.group[slot.group]) + '에 쓰는 ' + slot.name + ' 소재지만 ' + sec.focus + ' 소재는 아니라 ' + sec.text[1]};
      return {tier: 0, slot, card: c, reason: slot.name + ' 칸의 ' + josa(label(c), ['은', '는']) + ' ' + slot.name + ' 소재가 아니라 ' + sec.text[0]};
    };
    const a = grade(sec.slot), b = sec.also ? grade(sec.also) : null;
    out[sec.key] = b && b.tier > a.tier ? b : a;
  }
  return out;
}

// 차급의 성격: 속도는 모두 같고 차폭과 흔들림만 다르다.
export function carTrait(body) {
  if (body.startsWith('경형')) return {width: 0.62, shake: 1.4, note: '차폭이 좁아 사이로 빠져나가기 쉬워요.'};
  if (/대형|SUV|미니밴/.test(body)) return {width: 0.86, shake: 0.5, note: '차폭이 넓지만 요철에서 덜 흔들려요.'};
  return {width: 0.74, shake: 1, note: '기준이 되는 차폭이에요.'};
}
