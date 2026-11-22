# 배경음악 시안 U0 만들기: template.html에 다섯 곡(assets/bgm-2026-11-22)과 출하 음악을 넣어 index.html을 만든다.
# index.html은 곡을 담고 있어 약 10.6MB라 Git에 넣지 않는다. 필요하면 이 파일로 다시 만든다: python3 docs/design/game-bgm-2026-11-22-u0/build.py
import json, base64, pathlib
here = pathlib.Path(__file__).resolve().parent
root = here.parents[2]
record = json.loads((root/'current/approval/bgm/bgm-approval-2026-11-22.json').read_text())
labels = {
  'workshop':   ('공방', '스윙 빅밴드', 'SWING', '약 120 BPM'),
  'crafting':   ('제작', '펑키 하드밥', 'FUNK', '약 115 BPM'),
  'garage':     ('차고', '쿨재즈', 'COOL', '약 115 BPM'),
  'collection': ('도감', '피아노 트리오', 'TRIO', '측정 불안정(느린 편)'),
  'research':   ('연구', '보사노바', 'BOSSA', '약 123 BPM'),
}
meta, audio = {}, {}
for f in record['files']:
  tab, style, code, bpm = labels[f['name']]
  meta[f['name']] = {'tab': tab, 'style': style, 'short': code, 'code': 'BGM · ' + code, 'key': f['measured']['key'], 'bpm': bpm,
                     'loopStart': f['loopStart'], 'loopEnd': f['loopEnd'],
                     'range': f"{f['loop']['start']:.1f}초 → {f['loop']['end']:.1f}초", 'size': f"{f['bytes']/1048576:.2f}MB (MP3 160kbps)"}
  audio[f['name']] = 'data:audio/mpeg;base64,' + base64.b64encode((root/f['path']).read_bytes()).decode()
t = (here/'template.html').read_text()
t = t.replace('{{META}}', json.dumps(meta, ensure_ascii=False)).replace('{{AUDIO}}', json.dumps(audio))
t = t.replace('{{THEME}}', 'data:audio/mpeg;base64,' + base64.b64encode((root/'game/public/audio/sfx.theme.mp3').read_bytes()).decode())
assert '{{' not in t
(here/'index.html').write_text(t)
print(len(t))
