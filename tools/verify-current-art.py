import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import sys
from urllib.parse import unquote


ROOT = Path(__file__).resolve().parents[1]
CATALOG_SHA = 'df6a3d818f0a8617db7dda8a58f4365821aa2419b11c3b6c0604957bb445300c'
DIALOGUE_SHA = '464d0d12e2280f2c54555b4387a3d215683d5c415db362d973ce574c450158ee'


def check(condition, message):
    if not condition:
        raise ValueError(message)


def resolve(relative):
    path = (ROOT / relative).resolve()
    check(path.is_relative_to(ROOT) and path.is_file(), 'Missing or outside repository: ' + relative)
    return path


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.images = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == 'img':
            self.images.append(values.get('src', ''))
        for key in ('href', 'src'):
            if key in values:
                self.links.append(values[key])


def verify_webtoon(manifest):
    """웹툰 그림은 캐릭터 원화 477장과 별개의 승인 범주다. 승인 기록의 64장(연재 안내·1~7화, 2026-11-20)과 정확히 같아야 한다."""
    web = manifest['webtoon']
    check(web['approved'] is True and web['root'] == 'webtoon', 'Webtoon category not approved')
    record_path = resolve(web['approvalRecord'])
    check(digest(record_path) == web['approvalSHA256'], 'Webtoon approval record changed')
    record = json.loads(record_path.read_text())
    files = record['files']
    check(record['category'] == 'webtoon' and record['count'] == web['count'] == len(files) == 64, 'Wrong webtoon scope')
    check(len({row['path'] for row in files}) == len(files), 'Duplicate webtoon record')
    check(sum(row['bytes'] for row in files) == record['totalBytes'], 'Wrong webtoon total')
    for row in files:
        path = resolve(row['path'])
        check(digest(path) == row['sha256'] and path.stat().st_size == row['bytes'], 'Webtoon artwork changed: ' + row['path'])
    on_disk = {'webtoon/' + p.name for p in (ROOT / 'webtoon').iterdir()}
    check(on_disk == {row['path'] for row in files}, 'Unapproved or missing webtoon file')
    public = ROOT / manifest['prototype'] / 'public'
    for row in files:
        copy = public / row['path']
        check(copy.is_file() and digest(copy) == row['sha256'], 'Runtime webtoon copy mismatch: ' + row['path'])


def verify_web_derivatives(manifest, selected):
    """웹용 파생본(2026-11-20 승인)은 승인 그림의 같은 크기 손실 WebP다. 기록·파일·원본 짝이 정확히 같아야 하고, 원본 그림은 그대로 남아 있어야 한다."""
    web = manifest['webDerivatives']
    check(web['approved'] is True and web['root'] == 'assets/web-derivatives-2026-11-20', 'Web derivatives not approved')
    record_path = resolve(web['approvalRecord'])
    check(digest(record_path) == web['approvalSHA256'], 'Web derivative approval record changed')
    record = json.loads(record_path.read_text())
    files = record['files']
    check(record['category'] == 'web-derivatives' and record['count'] == web['count'] == len(files) == 345, 'Wrong web derivative scope')
    check(sum(row['bytes'] for row in files) == record['totalBytes'], 'Wrong web derivative total')
    check(len({row['sourceSHA256'] for row in files}) == len(files), 'Duplicate derivative source')
    approved_sources = {row.get('outputSHA') for row in selected.values() if row.get('status') == 'approved'}
    public = ROOT / manifest['prototype'] / 'public'
    for row in files:
        path = resolve(row['path'])
        check(path.name == row['sha256'] + '.webp' and digest(path) == row['sha256'] and path.stat().st_size == row['bytes'], 'Web derivative changed: ' + row['path'])
        check(row['sourceSHA256'] in approved_sources, 'Derivative of unapproved art: ' + row['path'])
        copy = public / 'art' / (row['sha256'] + '.webp')
        check(copy.is_file() and digest(copy) == row['sha256'], 'Runtime derivative copy mismatch: ' + row['path'])
    on_disk = {p.name for p in (ROOT / web['root']).iterdir() if p.suffix == '.webp'}
    check(on_disk == {row['sha256'] + '.webp' for row in files}, 'Unapproved or missing web derivative file')


def main():
    manifest = json.loads(resolve('current/artwork.json').read_text())
    check(manifest['catalogSHA256'] == CATALOG_SHA, 'Wrong current catalog')
    check(manifest['dialogueSHA256'] == DIALOGUE_SHA, 'Wrong current dialogue')
    for source in manifest['sources']:
        check(digest(resolve(source['path'])) == source['sha256'], 'Approval snapshot changed: ' + source['path'])
    catalog_source = next(s for s in manifest['sources'] if s['sha256'] == CATALOG_SHA)
    catalog = json.loads(resolve(catalog_source['path']).read_text())
    selected = {row['id']: row for row in catalog['targets']}
    rows = manifest['targets']
    check(len(rows) == len(selected) == len({r['id'] for r in rows}) == 477, 'Wrong target set')
    by_id = {row['id']: row for row in rows}
    for row in rows:
        check(row['id'] in selected, 'Unexpected selected target')
        original = selected[row['id']]
        check(row['status'] == original['status'] == 'approved', 'Unapproved target')
        check(row['kind'] == original['kind'], 'Wrong target kind')
        check(row['sha256'] == original['outputSHA'], 'Wrong selected version: ' + row['id'])
        for key in ('family', 'cardId', 'side', 'equipmentKeys', 'version'):
            check(row.get(key) == original.get(key), 'Changed target identity: ' + row['id'])
        path = resolve(row['path'])
        check(digest(path) == row['sha256'] and path.stat().st_size == row['bytes'], 'Artwork changed: ' + row['id'])
    prototype = manifest['prototype']
    data = json.loads(resolve(prototype + '/public/data.json').read_text())
    check(data['binding']['artSHA'] == CATALOG_SHA and data['binding']['dialogueSHA'] == DIALOGUE_SHA, 'Wrong runtime binding')
    appearances = [row for row in rows if row['kind'] == 'appearance']
    check(len(appearances) == len(data['appearances']) == 301, 'Wrong runtime appearance count')
    check({r['id'] for r in appearances} == {r['id'] for r in data['appearances']}, 'Runtime target set mismatch')
    # 2026-11-20부터 화면은 승인된 웹용 파생본을 쓸 수 있다. 그때 runtime sha256은 파생본, sourceSHA256은 승인 원본이며 그 짝이 파생본 승인 기록에 있어야 한다.
    derived = {row['sha256']: row['sourceSHA256'] for row in json.loads(resolve(manifest['webDerivatives']['approvalRecord']).read_text())['files']}
    def source_of(runtime):
        if 'sourceSHA256' in runtime:
            check(derived.get(runtime['sha256']) == runtime['sourceSHA256'], 'Runtime derivative not approved: ' + runtime['image'])
            return runtime['sourceSHA256']
        return runtime['sha256']
    for runtime in data['appearances']:
        row = by_id[runtime['id']]
        check(source_of(runtime) == row['sha256'] and runtime['sha256'] == digest(resolve(prototype + '/public/' + runtime['image'])), 'Runtime artwork mismatch')
    for target_id, runtime in data['assets'].items():
        check(target_id in by_id and source_of(runtime) == by_id[target_id]['sha256'], 'Runtime asset selection mismatch')
        check(digest(resolve(prototype + '/public/' + runtime['image'])) == runtime['sha256'], 'Runtime asset changed')
    wording_source = next(s for s in manifest['sources'] if s['sha256'] == DIALOGUE_SHA)
    wording = json.loads(resolve(wording_source['path']).read_text())
    expected_wording = [{key: row[key] for key in ('cardId', 'side', 'ko', 'ja')} for row in wording['rows']]
    check(data['dialogue'] == expected_wording, 'Runtime dialogue mismatch')
    parser = Links()
    parser.feed(resolve('current/index.html').read_text())
    basic_paths = {'../' + row['path'] for row in appearances if not row.get('equipmentKeys')}
    check(len(parser.images) == len(basic_paths) == 47 and set(parser.images) == basic_paths,
          'Gallery must show exactly the 47 selected basic faces')
    for link in parser.links:
        check(':' not in link, 'Gallery must use local links')
        resolve('current/' + unquote(link.split('#')[0]))
    music_root = 'docs/music-video/pickle-song-2026-11-11/'
    references = json.loads(resolve(music_root + 'references.json').read_text())
    check(references['catalogSHA256'] == CATALOG_SHA, 'Wrong video reference catalog')
    check(len(references['references']) == 11, 'Wrong video reference count')
    for reference in references['references'].values():
        target = by_id[reference['targetId']]
        check(reference['path'] == target['path'] and reference['sha256'] == target['sha256'], 'Wrong video reference selection')
        check(digest(resolve(reference['path'])) == reference['sha256'], 'Video reference changed')
    plan = json.loads(resolve(music_root + 'remake-plan.json').read_text())
    clips = {clip['id']: clip for clip in plan['clips']}
    check(len(clips) == 14, 'Wrong video prompt count')
    for clip in clips.values():
        resolve(clip['prompt'])
        check(all(key in references['references'] for key in clip['referenceKeys']), 'Unknown video reference key')
        check(clip['estimatedCredits'] == clip['generateSeconds'] * plan['priceCreditsPerSecond'], 'Wrong clip quote')
    for scope in plan['scope'].values():
        check(scope['count'] == len(scope['clips']), 'Wrong remake clip count')
        check(scope['credits'] == sum(clips[key]['estimatedCredits'] for key in scope['clips']), 'Wrong remake quote total')
    verify_webtoon(manifest)
    verify_web_derivatives(manifest, selected)
    print(json.dumps(dict(status='PASS', selectedArt=477, basic=47, equipped=254,
                          runtimeAssets=len(data['assets']), dialoguePairs=47,
                          approvalSnapshots=len(manifest['sources']), webtoonArt=manifest['webtoon']['count'], webDerivatives=manifest['webDerivatives']['count'], galleryLinks=len(parser.links),
                          videoReferences=11, videoPrompts=14), ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except (OSError, KeyError, ValueError, StopIteration) as error:
        print('FAIL: ' + str(error), file=sys.stderr)
        sys.exit(1)
