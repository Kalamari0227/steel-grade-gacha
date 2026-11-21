import {button, el, micro} from './ui.mjs';

// 철강 퀴즈: 장착 창과 같은 전체 화면 위층. 문제(검정 시험지) → 해설 → 결과(시험 성적서). 규칙·채점·보상은 모두 엔진 명령이 한다.
// 이 화면은 고른 보기 번호를 엔진에 보내고, 엔진이 돌려준 세션(정답은 답한 뒤에만 들어 있다)을 그린다. 진행 중인 퀴즈는 저장하지 않는다.

// 문항 글에는 <b>…</b>만 들어 있다(qa/stage4.test.mjs가 413문항 전부를 검사한다). innerHTML을 쓰지 않고 <b>만 요소로 만든다.
// 그 밖의 '<'는 모두 글자로 나온다.
export function richText(parent, text) {
  let bold = null;
  for (const part of String(text).split(/(<\/?b>)/)) {
    if (part === '<b>') { bold = el('b'); continue; }
    if (part === '</b>') { if (bold) parent.append(bold); bold = null; continue; }
    if (part === '') continue;
    (bold || parent).append(document.createTextNode(part));
  }
  if (bold) parent.append(bold);
  return parent;
}

// 결과 문구는 원본 renderQ의 네 가지 그대로다.
export const OUTCOME_TEXT = {
  fail: '5문제를 모두 맞추면 추가 출하를 받아요.',
  reward: '추가 출하 +1을 받았어요.',
  cap: '보유 추가 출하가 상한에 도달해 수량은 늘지 않았어요.',
  exhausted: '보상 잔여 횟수를 모두 사용했어요.'
};
const MARKS = ['①', '②', '③', '④'];

export function createQuizDialog(engine, {loadBank, openCard, goDex, onChange, onDismiss}) {
  const dialog = document.querySelector('#quiz-dialog');
  let session = null, busy = false, message = '', confirming = false, bankReady = false;
  const progress = () => session && (session.phase === 'question' || session.phase === 'explain');
  dialog.addEventListener('close', () => {
    // 진행 중인 퀴즈는 닫으면 버린다(보상 없음·저장 그대로).
    engine.quizClose(session && session.id);
    dialog.replaceChildren();
    session = null; busy = false; message = ''; confirming = false;
    onDismiss();
  });
  // Esc·뒤로 가기는 진행 중이면 먼저 확인한다.
  dialog.addEventListener('cancel', event => { event.preventDefault(); ask(); });
  function ask() {
    if (!progress()) { dialog.close(); return; }
    confirming = true;
    render('#quiz-leave-title');
    // 확인 상자는 서류 아래에 붙는다. 긴 해설에서는 화면 밖에 생기므로 보이는 곳까지 내린다(초점만 옮기면 닫기가 먹지 않은 것처럼 보인다).
    dialog.querySelector('.quiz-leave')?.scrollIntoView({block: 'nearest'});
  }
  function frame() {
    const close = button('닫기', 'close-button', ask);
    close.autofocus = true;
    const head = el('div', 'dialog-head');
    const tag = el('span', 'dialog-label');
    tag.append(micro('STEEL QUIZ'), '철강 퀴즈');
    head.append(tag, close);
    return head;
  }
  // 5칸 진행 표시. 장식이다(숫자·정답 수는 글로 따로 있다).
  function marks(s) {
    const row = el('ol', 'quiz-marks');
    row.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < s.total; i++) row.append(el('li', i < s.index ? 'done' : i === s.index ? 'now' : ''));
    return row;
  }
  function counter(s) {
    const box = el('div', 'quiz-counter');
    const no = el('p', 'quiz-no');
    no.append(el('span', 'sr', '문제 '), el('b', '', String(s.index + 1)), el('small', '', ' / ' + s.total));
    box.append(micro('QUESTION'), no, el('p', 'quiz-score', '정답 ' + s.right + '개'));
    return box;
  }
  function relatedBlock(s) {
    const box = el('div', 'quiz-related');
    if (s.related.length) {
      for (const c of s.related) {
        const link = button('관련 보유 소재 · ' + c.name, 'secondary', event => openCard(c.id, event.currentTarget));
        link.dataset.quizCard = c.id;
        box.append(link);
      }
    } else {
      const dex = el('a', 'secondary quiz-dex', '소재 도감 둘러보기 · 현재 퀴즈 종료');
      dex.href = '#collection';
      dex.addEventListener('click', event => { event.preventDefault(); goDex(); });
      box.append(dex);
    }
    return box;
  }
  function question(s) {
    const sheet = el('section', 'quiz-sheet');
    sheet.setAttribute('aria-labelledby', 'quiz-question');
    sheet.append(counter(s), marks(s));
    const q = el('h3', 'quiz-q');
    q.id = 'quiz-question'; q.tabIndex = -1;
    richText(q, s.question.q);
    const list = el('div', 'quiz-opts');
    s.question.o.forEach((text, idx) => {
      const opt = el('button', 'quiz-opt');
      opt.type = 'button';
      opt.dataset.opt = String(idx);
      const mark = el('span', 'quiz-opt-no', MARKS[idx]);
      mark.setAttribute('aria-hidden', 'true');
      opt.append(mark, el('span', 'quiz-opt-text', text));
      if (s.phase === 'explain') {
        opt.disabled = true;
        const tag = el('small', 'quiz-opt-tag');
        if (idx === s.correctIndex) { opt.classList.add('right'); tag.textContent = '정답'; }
        if (idx === s.chosen) { opt.classList.add('picked'); if (idx !== s.correctIndex) { opt.classList.add('wrong'); tag.textContent = '내 답 · 오답'; } }
        if (tag.textContent) opt.append(tag);
      } else {
        opt.addEventListener('click', event => choose(s, idx, event));
      }
      list.append(opt);
    });
    sheet.append(q, list);
    if (s.phase === 'explain') {
      const note = el('section', 'quiz-explain');
      const verdict = el('p', 'quiz-verdict ' + (s.correct ? 'is-correct' : 'is-wrong'), s.correct ? '정답' : '오답');
      verdict.setAttribute('role', 'status');
      verdict.id = 'quiz-verdict'; verdict.tabIndex = -1;
      const answer = el('h4', 'quiz-answer');
      answer.append('정답 · ');
      richText(answer, s.question.o[s.correctIndex]);
      const reason = el('p', 'quiz-reason');
      richText(reason, s.explanation || '이 급에서 통상 그렇게 잡습니다.');
      const next = button(s.last ? '결과 보기' : '다음 문제', 'primary', event => advance(s, event));
      next.id = 'quiz-next';
      note.append(verdict, answer, reason, relatedBlock(s));
      if (message) { const err = el('p', 'quiz-error', message); err.setAttribute('role', 'alert'); note.append(err); }
      note.append(next);
      sheet.append(note);
    }
    return sheet;
  }
  function result(s) {
    const q = s.quiz, sheet = el('section', 'quiz-sheet quiz-report');
    sheet.setAttribute('aria-labelledby', 'quiz-result');
    sheet.append(micro('SCORE REPORT'));
    const score = el('h3', 'quiz-result');
    score.id = 'quiz-result'; score.tabIndex = -1;
    score.append(el('b', '', String(s.right)), el('small', '', ' / ' + s.total + ' 정답'));
    sheet.append(score);
    const reward = el('section', 'quiz-reward');
    reward.setAttribute('aria-labelledby', 'quiz-reward-title');
    const rt = el('h4', '', '출하 보상'); rt.id = 'quiz-reward-title';
    reward.append(rt, el('p', 'quiz-reward-text ' + s.outcome, OUTCOME_TEXT[s.outcome]),
      el('p', 'quiz-reward-sum', '보유 추가 출하 ' + q.extra + '회 · 보상 잔여 ' + q.left + ' / ' + q.max + '회'));
    if (q.windowOpen) reward.append(el('p', 'quiz-reward-renew', q.renewText + ' 갱신'));
    sheet.append(reward);
    const warn = [s.saveWarning, message].filter(Boolean).join(' ');
    if (warn) { const note = el('p', 'quiz-error', warn); note.setAttribute('role', 'alert'); sheet.append(note); }
    const actions = el('div', 'quiz-actions');
    if (q.left > 0) {
      const again = button(s.pass ? '한 판 더' : '다시 도전', 'primary', event => retry(event));
      again.id = 'quiz-retry';
      actions.append(again, button('확인', 'secondary', () => dialog.close()));
    } else actions.append(button('확인', 'primary', () => dialog.close()));
    sheet.append(actions);
    return sheet;
  }
  function leave() {
    const box = el('section', 'quiz-leave');
    box.setAttribute('role', 'alertdialog');
    box.setAttribute('aria-labelledby', 'quiz-leave-title');
    const title = el('h3', '', '퀴즈를 그만할까요?');
    title.id = 'quiz-leave-title'; title.tabIndex = -1;
    const actions = el('div', 'quiz-actions');
    actions.append(button('계속 풀기', 'primary', () => { confirming = false; render(session.phase === 'explain' ? '#quiz-next' : '#quiz-question'); }), button('그만하기', 'secondary', () => dialog.close()));
    box.append(title, el('p', '', '풀던 문제와 고른 답은 저장되지 않고, 보상도 없어요.'), actions);
    return box;
  }
  function render(focus) {
    if (!session) return;
    dialog.setAttribute('aria-label', '철강 퀴즈');
    const body = el('div', 'quiz-body');
    body.dataset.phase = session.phase;
    body.append(session.phase === 'result' ? result(session) : question(session));
    if (confirming) body.append(leave());
    dialog.replaceChildren(frame(), body);
    if (focus) dialog.querySelector(focus)?.focus({preventScroll: true});
  }
  // 빠른 두 번 누름의 두 번째 누름(event.detail 2)은 새로 그려진 화면의 보기·버튼에 떨어질 수 있으므로 무시한다. 키보드(detail 0)와 한 번 누름은 그대로 처리한다.
  function choose(s, idx, event) {
    if (busy || confirming || event.detail > 1) return;
    const outcome = engine.quizAnswer(s.id, s.index, idx);
    if (!outcome.ok) { if (outcome.session) { session = outcome.session; render(); } else dialog.close(); return; }
    session = outcome.session;
    render('#quiz-verdict');
  }
  async function advance(s, event) {
    // 그만두기 확인이 떠 있는 동안에는 보기와 같이 다음 문제도 받지 않는다.
    if (busy || confirming || event.detail > 1) return;
    busy = true; message = '';
    try {
      const outcome = await onChange.next(s.id, s.index);
      if (!outcome.ok) {
        if (outcome.session) session = outcome.session;
        // 마지막 문제의 결과 처리가 거절되면(다른 탭·저장 문제) 해설 화면에 머물고 알려 준다.
        message = outcome.error || '';
        render(message ? '.quiz-error' : '#quiz-next');
        dialog.querySelector('.quiz-error')?.setAttribute('tabindex', '-1');
        dialog.querySelector('.quiz-error')?.focus({preventScroll: true});
        return;
      }
      session = outcome.session;
      render(session.phase === 'result' ? '#quiz-result' : '#quiz-question');
    } finally { busy = false; }
  }
  async function retry(event) {
    if (busy || event.detail > 1) return;
    busy = true; message = '';
    try {
      const outcome = await onChange.start();
      if (!outcome.ok) { message = outcome.error; render('#quiz-result'); return; }
      session = outcome.session; render('#quiz-question');
    } finally { busy = false; }
  }
  return {
    // 시작: 문항 데이터는 처음 열 때 한 번만 불러온다(용량 때문에 별도 모듈).
    async open() {
      if (busy || dialog.open) return {ok: false};
      busy = true;
      try {
        if (!bankReady) {
          const loaded = await loadBank();
          if (!loaded.ok) return loaded;
          bankReady = true;
        }
        const outcome = await onChange.start();
        if (!outcome.ok) return outcome;
        session = outcome.session; message = ''; confirming = false;
        render();
        dialog.showModal();
        dialog.scrollTop = 0;
        dialog.querySelector('#quiz-question')?.focus({preventScroll: true});
        return {ok: true};
      } finally { busy = false; }
    },
    // 뒤로 가기: 진행 중이면 확인을 띄우고(true: 기록을 다시 쌓아야 함), 아니면 닫는다.
    back() { const keep = progress(); ask(); return keep; },
    close() { if (dialog.open) dialog.close(); },
    isOpen: () => dialog.open
  };
}
