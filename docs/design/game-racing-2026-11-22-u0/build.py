# 주행 시험장 시제품(관문 2) 만들기: 판정 규칙(race-rules.mjs), 게임 자료(카드·부품·차), 승인된 차 그림·카드 썸네일,
# 효과음 3개와 차고 배경음악을 템플릿에 넣는다. 새 그림·소리는 없다. 만든 html은 Git에 넣지 않는다.
#   template.html    → index.html  v2: 뒤에서 따라가는 유사 3D 도로(2026-11-22 방향 전환)
#   template-v1.html → v1.html     v1: 위에서 본 3차선(첫 시제품, 비교용으로 남김)
#   python3 docs/design/game-racing-2026-11-22-u0/build.py
import json, base64, pathlib, re
here = pathlib.Path(__file__).resolve().parent
root = here.parents[2]
pub = root/'game/public'
data = json.loads((pub/'data.json').read_text())
uri = (lambda p, mime: f'data:{mime};base64,' + base64.b64encode(p.read_bytes()).decode())
cards = [{k: c[k] for k in ('id', 'family', 'familyName', 'familyKind', 'grade', 'code', 'level', 'use', 'spec')} for c in data['cards']]
parts = [{k: p[k] for k in ('key', 'name', 'grp', 'need')} for p in data['parts']]
cars = [{**{k: c[k] for k in ('key', 'tag', 'body')}, 'img': uri(pub/data['assets']['car:' + c['key']]['image'], 'image/webp')} for c in data['cars']]
thumbs = {c['id']: uri(pub/data['assets']['thumbnail:' + c['id'] + ':front']['image'], 'image/webp') for c in data['cards']}
sfx = {'thud': uri(pub/'audio/sfx.thud.mp3', 'audio/mpeg'), 'chime': uri(pub/'audio/sfx.chime-silver.mp3', 'audio/mpeg'), 'car': uri(pub/'audio/sfx.car.mp3', 'audio/mpeg')}
garage = data['bgm']['garage']
bgm = {'uri': uri(pub/garage['file'], 'audio/mpeg'), 'loopStart': garage['loopStart'], 'loopEnd': garage['loopEnd']}
rules = re.sub(r'^export ', '', (here/'race-rules.mjs').read_text(), flags=re.M)
for src, out in (('template.html', 'index.html'), ('template-v1.html', 'v1.html')):
    t = (here/src).read_text()
    t = t.replace('{{RULES}}', rules).replace('{{DATA}}', json.dumps({'cards': cards, 'parts': parts, 'cars': cars}, ensure_ascii=False))
    t = t.replace('{{SFX}}', json.dumps(sfx)).replace('{{BGM}}', json.dumps(bgm)).replace('{{THUMB}}', json.dumps(thumbs))
    assert '{{' not in t, src
    (here/out).write_text(t)
    print(out, len(t))
