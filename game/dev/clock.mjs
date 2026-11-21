// 로컬 검토 전용 시각 주입. 공개 체험판(public/)에는 없다(dev/는 배포에 들어가지 않는다).
// /?at=2026-10-22T12:00:00%2B09:00 처럼 시작 시각을 주면 그 시각부터 흘러가는 시계로 바꾼다. 없으면 실제 시각이다.
// 같은 출처(127.0.0.1:8779)의 저장을 그대로 쓴다.
(() => {
  const at = new URLSearchParams(location.search).get('at');
  if (!at) return;
  const start = Date.parse(at);
  if (!Number.isFinite(start)) return;
  const RealDate = Date, offset = start - RealDate.now();
  const now = () => RealDate.now() + offset;
  function FakeDate(...args) {
    if (!new.target) return new RealDate(now()).toString();
    return args.length ? new RealDate(...args) : new RealDate(now());
  }
  FakeDate.prototype = RealDate.prototype;
  FakeDate.now = now; FakeDate.UTC = RealDate.UTC; FakeDate.parse = RealDate.parse;
  globalThis.Date = FakeDate;
  addEventListener('DOMContentLoaded', () => {
    const tag = document.createElement('div');
    tag.setAttribute('aria-hidden', 'true');
    tag.style.cssText = 'position:fixed;top:0;right:0;z-index:99;background:#b3261e;color:#fff;font:600 11px system-ui;padding:2px 8px';
    tag.textContent = '검토용 시각 주입 · ' + at;
    document.body.append(tag);
  });
})();
