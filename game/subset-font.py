"""제목 글꼴 Hahmlet 축소본을 다시 만든다.

원본: https://github.com/google/fonts 의 ofl/hahmlet/Hahmlet[wght].ttf (SIL OFL 1.1)
준비: python3 -m venv .venv && .venv/bin/pip install fonttools brotli
실행: 체험판 폴더에서  .venv/bin/python subset-font.py <원본.ttf> src/fonts/Hahmlet-wght-ko.woff2
      그 뒤 같은 파일을 public/fonts/ 에 복사한다.

남기는 글자: 영문·숫자(ASCII), KS X 1001 완성형 한글 2,350자, 몇 가지 기호,
그리고 src/ 의 html·mjs 와 public/data.json 에 지금 나오는 모든 글자.
가변 굵기 축(wght 100–900)은 그대로 둔다. 축소본에 없는 글자는 CSS 의 대체 글꼴로 나온다.
"""
import sys, glob, json
from fontTools.ttLib import TTFont
from fontTools import subset

src, out = sys.argv[1], sys.argv[2]
chars = set(chr(c) for c in range(0x20, 0x7f))
for hi in range(0xB0, 0xC9):
    for lo in range(0xA1, 0xFF):
        chars.add(bytes([hi, lo]).decode('euc_kr'))
chars |= set('·★☆—–‹›…「」→←↑↓▲▼•×%℃°')
used = set()
for path in glob.glob('src/*.mjs') + glob.glob('src/*.html') + ['public/data.json']:
    used |= set(open(path, encoding='utf-8').read())
hangul = {c for c in used if '가' <= c <= '힣'}
chars |= used

font = TTFont(src)
options = subset.Options()
options.flavor = 'woff2'
options.layout_features = ['*']
options.name_IDs = ['*']
options.notdef_outline = True
subsetter = subset.Subsetter(options)
subsetter.populate(unicodes=[ord(c) for c in chars])
subsetter.subset(font)
font.flavor = 'woff2'
font.save(out)

cmap = TTFont(out).getBestCmap()
missing = ''.join(sorted(c for c in hangul if ord(c) not in cmap))
print(json.dumps({'hangulUsedNow': len(hangul), 'usedMissingInSubset': missing}, ensure_ascii=False))
if missing:
    sys.exit('축소본에 없는 한글이 있습니다: ' + missing)
