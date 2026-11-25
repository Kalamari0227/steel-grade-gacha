// 주행 시험장 기록(확장 A 관문 4). 본편 세이브(SAVE_KEY)와 다른 칸에 차·코스마다 가장 빠른 기록 하나와 그 주행(고스트)만 둔다.
// 보상이 없으므로 본편 저장·재고·스크랩을 읽지도 쓰지도 않는다. 백업 코드에도 넣지 않는다(2026-11-23 사용자 결정).
export const RACE_KEY = 'sgg_game_race_v1';
export const GOLD = 70, SILVER = 76;             // 메달 기준(초). 임시: 자동 조향 값(67·73)에 사람 몫 여유 3초를 더했다. 사람 기록이 모이면 다시 맞춘다.
export const MEDAL_TEXT = {gold: '금', silver: '은', bronze: '동'};
export const medalOf = t => t <= GOLD ? 'gold' : t <= SILVER ? 'silver' : 'bronze';
const MAX_GHOST = 2400;                           // 0.25초 간격으로 10분
const timeOk = t => typeof t === 'number' && Number.isFinite(t) && t >= 20 && t <= 3600;
const ghostOk = g => Array.isArray(g) && g.length <= MAX_GHOST && g.every(p => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]));

// storage: {getItem, setItem}. cars·courses: 허용하는 키 목록.
export function createRaceStore(storage, {cars, courses}) {
  const known = (car, course) => cars.includes(car) && courses.includes(course);
  function read() {
    let raw = null;
    try { raw = storage.getItem(RACE_KEY); } catch { return {}; }
    if (!raw) return {};
    try {
      const value = JSON.parse(raw), out = {};
      if (!value || value.v !== 1 || typeof value.best !== 'object' || value.best === null || Array.isArray(value.best)) return {};
      for (const [id, row] of Object.entries(value.best)) {
        const [car, course] = id.split(':');
        if (id.split(':').length === 2 && known(car, course) && row && timeOk(row.t) && ghostOk(row.ghost)) out[id] = {t: row.t, ghost: row.ghost};
      }
      return out;
    } catch { return {}; }
  }
  return {
    // 그 차·코스의 가장 빠른 기록. 없으면 null.
    best(car, course) { const row = read()[car + ':' + course]; return row ? {t: row.t, medal: medalOf(row.t), ghost: row.ghost} : null; },
    // 차 한 대의 코스별 메달(코스 순서, 기록이 없으면 '')과 가장 빠른 기록.
    summary(car) {
      const all = read(), rows = courses.map(course => all[car + ':' + course] || null), times = rows.filter(Boolean).map(r => r.t);
      return {medals: rows.map(r => r ? medalOf(r.t) : ''), fastest: times.length ? Math.min(...times) : null, runs: times.length};
    },
    // 더 빠를 때만 쓴다. 결과: {ok, improved, previous(이전 기록 초 또는 null), medal}.
    record(car, course, t, ghost) {
      if (!known(car, course) || !timeOk(t) || !ghostOk(ghost)) return {ok: false, improved: false, previous: null, medal: ''};
      const all = read(), id = car + ':' + course, previous = all[id]?.t ?? null, time = Math.round(t * 100) / 100;
      if (previous !== null && time >= previous) return {ok: true, improved: false, previous, medal: medalOf(time)};
      all[id] = {t: time, ghost};
      try { storage.setItem(RACE_KEY, JSON.stringify({v: 1, best: all})); }
      catch { return {ok: false, improved: false, previous, medal: medalOf(time)}; }
      return {ok: true, improved: true, previous, medal: medalOf(time)};
    }
  };
}
