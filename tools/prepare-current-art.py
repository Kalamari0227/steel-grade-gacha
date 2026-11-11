import hashlib
import html
import json
from pathlib import Path
import shutil
import subprocess


ROOT = Path(__file__).resolve().parents[1]
ART = ROOT.parent / '.omo/artwork/steel-companion-full-art-remake'
CURRENT = ROOT / 'current'
CATALOG = 'review/ga-foundation-review-2026-11-05-r1/back-arrow-axis-r2/current477-candidates.json'
CATALOG_SHA = 'df6a3d818f0a8617db7dda8a58f4365821aa2419b11c3b6c0604957bb445300c'
DIALOGUE = 'identity/dialogue-current-selection.json'
AUDIT_DIR = 'review/pre-prototype-approval-audit-2026-11-09-r1/'
PROTOTYPE = '.omo/prototypes/steel-companion-full-art-remake'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def main():
    if digest(ART / CATALOG) != CATALOG_SHA:
        raise ValueError('승인 카탈로그 SHA가 변경되었습니다. 새 승인 근거를 먼저 확인하세요.')
    catalog = json.loads((ART / CATALOG).read_text())
    readiness = json.loads((ART / (AUDIT_DIR + 'approval-readiness.json')).read_text())
    audit = json.loads((ART / (AUDIT_DIR + 'audit-result.json')).read_text())
    if readiness['approvalMaterialBlockers'] or len(catalog['targets']) != 477:
        raise ValueError('승인 범위가 완전하지 않습니다.')
    tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
    by_sha = {}
    for relative in sorted(tracked, key=lambda p: (not p.startswith(PROTOTYPE + '/public/art/'), p)):
        path = ROOT / relative
        if path.is_file() and path.suffix.lower() in {'.png', '.webp', '.jpg', '.jpeg'}:
            by_sha.setdefault(digest(path), relative)

    rows = []
    for target in catalog['targets']:
        source = target.get('full') or target['image']
        expected = target['outputSHA']
        if target['status'] != 'approved' or digest(ART / source) != expected:
            raise ValueError('승인 파일 불일치: ' + target['id'])
        relative = by_sha.get(expected)
        if relative is None:
            relative = 'current/supplemental/' + expected + Path(source).suffix
            destination = ROOT / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ART / source, destination)
            by_sha[expected] = relative
        row = {key: target[key] for key in ['id', 'kind', 'name', 'category', 'family', 'cardId', 'side', 'version', 'equipmentKeys'] if key in target}
        row.update(status='approved', path=relative, sha256=expected,
                   bytes=(ROOT / relative).stat().st_size, localSource=source)
        if target.get('raw'):
            row['localMaster'] = target['raw']
        rows.append(row)

    sources = {CATALOG, DIALOGUE, AUDIT_DIR + 'approval-readiness.json', AUDIT_DIR + 'audit-result.json'}
    sources.update(row['source'] for row in audit['approvalGroups'])
    sources.update(row['path'] for row in audit['fitReceipts'])
    sources.update(row['path'] for row in audit['sources'] if 'user-decision' in row['path'])
    source_rows = []
    for source in sorted(sources):
        relative = 'current/approval/' + source
        destination = ROOT / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ART / source, destination)
        source_rows.append(dict(path=relative, localSource=source, sha256=digest(destination)))

    binding = json.loads((ROOT / PROTOTYPE / 'public/data.json').read_text())['binding']
    manifest = dict(schemaVersion=1, date='2026-11-11', edition='game',
                    authority='owner-approved selection; not modification time or version label',
                    catalogSHA256=CATALOG_SHA, dialogueSHA256=binding['dialogueSHA'],
                    experienceApproved=False, localArtworkRoot='../.omo/artwork/steel-companion-full-art-remake',
                    prototype=PROTOTYPE, sources=source_rows, targets=rows)
    write_json(CURRENT / 'artwork.json', manifest)

    escape = html.escape
    basic = [row for row in rows if row['kind'] == 'appearance' and not row.get('equipmentKeys')]
    families = [('poo', '포오'), ('ssial', '씨알'), ('ga', '도금이'), ('tarae', '타래'), ('eg', '이지'), ('qp', '큐피')]
    sections = []
    for key, label in families:
        cards = []
        for row in basic:
            if row.get('family') != key:
                continue
            link = '../' + row['path']
            cards.append(f'<article><a href="{escape(link, quote=True)}"><img loading="lazy" src="{escape(link, quote=True)}" alt="{escape(row["name"], quote=True)}"></a><h3>{escape(row["name"])}</h3><p>{escape(row["id"])}</p><small>{escape(row.get("version", ""))} · {row["sha256"][:12]}</small></article>')
        sections.append(f'<section id="{key}"><h2>{label}</h2><div class="grid">' + ''.join(cards) + '</div></section>')
    others = []
    for row in rows:
        if row in basic:
            continue
        others.append(f'<li><a href="../{escape(row["path"], quote=True)}">{escape(row.get("name", row["id"]))}</a> <small>{escape(row["kind"])} · {escape(row["id"])}</small></li>')
    page = '''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>스틸 컴패니언 · 게임용 최신 승인본</title>
<style>body{font:16px/1.65 system-ui,sans-serif;background:#f3f4f6;color:#202631;max-width:1200px;margin:auto;padding:24px}a{color:#154d9c}header{background:white;padding:24px;border-radius:12px}nav{display:flex;gap:18px;flex-wrap:wrap}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px}article{background:white;padding:16px;border-radius:12px}img{width:100%;height:260px;object-fit:contain;background:repeating-conic-gradient(#edf0f3 0% 25%,#fff 0% 50%) 0/16px 16px}article p,small{overflow-wrap:anywhere;font-size:12px}h3{margin-bottom:4px}summary{cursor:pointer}li{margin:8px 0}</style>
<header><h1>스틸 컴패니언 · 게임용 최신 승인본</h1><p>2026-11-11 정리 · 기본 캐릭터 47면 / 장착 외형 254개 / 기타 승인 산출물 176개 = 총 477개</p><p>게임 제작과 영상 레퍼런스는 이 목록을 기준으로 합니다. 도금이 B형, 두꺼운 코일 타래, 최신 PHS 포즈를 반영했습니다. 아트·문안 승인은 완료됐으며 체험 품질은 검토 중입니다.</p><nav><a href="../.omo/prototypes/steel-companion-full-art-remake/public/index.html">현재 게임 체험판</a><a href="artwork.json">477개 파일·SHA 목록</a><a href="README.md">보관 기준</a><a href="../docs/project-map.md">프로젝트 지도</a></nav><p>아래는 실제 게임의 기본 47면입니다. 회전 시점 참고 자료와 장착본은 맨 아래 별도 목록에서 확인합니다.</p></header>'''
    page += ''.join(sections) + '<details><summary>장착·배경·부품·차량·파생·시점 참고 자료 430개</summary><ul>' + ''.join(others) + '</ul></details></html>\n'
    (CURRENT / 'index.html').write_text(page)
    print(json.dumps(dict(targets=len(rows), basic=len(basic), supplementalFiles=len(list((CURRENT / 'supplemental').glob('*'))), approvalSnapshots=len(sources)), ensure_ascii=False))


if __name__ == '__main__':
    main()
