"""Apply the requested six-bed layout to canonical GLOWNY r81, preserving its snapshot."""
import json
from datetime import datetime, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[1]
folder = root / 'project-data/zielonki-rear-bath-room'
path = folder / 'project.json'
baseline = folder / 'before-compact-garden-r81.json'
source = path.read_bytes()
p = json.loads(source)
assert p['ref'] == 'project/zielonki-rear-bath-room' and p['revision'] == 81, 'Start from the reviewed r81 project'
if baseline.exists():
    assert baseline.read_bytes() == source, 'Never replace an existing recovery snapshot'
else:
    baseline.write_bytes(source)

prefix = 'fixture/kitchen-garden/'
fixtures = {f['ref']: f for f in p['landscape']['fixtures']}
removed = set()

def move(suffix, x, z, rotation=0):
    f = fixtures[prefix + suffix]
    f['position'] = {'x': x, 'z': z}
    f['rotationDegrees'] = rotation

def remove(suffix):
    assert prefix + suffix in fixtures
    removed.add(prefix + suffix)

# Six existing beds, turned across the plot in two banks of three.
# 1.30 m between timber boxes leaves about 1.26 m between the capping rails.
for row, z in enumerate([-3.0, -0.5, 2.0], 1):
    for side, x in [('w', 11.15), ('e', 16.05)]:
        for kind in ['bed', 'crop']:
            move(f'{kind}-n{side}{row}', x, z)
for side in ['w', 'e']:
    for kind in ['bed', 'crop']:
        remove(f'{kind}-n{side}4')
for suffix in ['square-centre', 'flowers-centre', 'square-west', 'flowers-west', 'square-east', 'flowers-east']:
    remove(suffix)
# Remove redundant perimeter strips as well as the surplus planters.
for f in fixtures.values():
    if f['ref'].startswith(prefix + 'border-'):
        removed.add(f['ref'])

move('greenhouse', 13.6, -6.3)
move('butt-1', 16.15, -6.1)
move('butt-2', 16.15, -7.0)
for name, x, z in [('gate-w', 10.3, 4.5), ('gate-e', 16.9, 4.5), ('north-w', 10.2, -4.6), ('north-e', 17.0, -4.6), ('gh-w', 10.2, -7.4)]:
    move('hydrangea-' + name, x, z)
move('flowers-gh', 10.2, -5.9)

# Keep nearby fence identities. The west rear opening connects to the existing
# house/dining walk; the south opening connects to the orchard.
fence_locations = {
    'fence-s-6.5': (9.1, -4.8, 90),
    'fence-n-8.9': (9.1, -2.4, 90),
    'fence-s-8.9': (9.1, 0, 90),
    'fence-n-13.7': (9.1, 2.4, 90),
    'fence-e-7.2': (18.1, -7.2, 90),
    'fence-w-9.6': (18.1, -4.8, 90),
    'fence-e-9.6': (18.1, -2.4, 90),
    'fence-w-12': (18.1, 0, 90),
    'fence-e-12': (18.1, 2.4, 90),
    'fence-extension-22': (10.3, -8.4, 0),
    'fence-extension-23': (16.9, -8.4, 0),
    'fence-extension-24': (10.3, 3.6, 0),
    'fence-extension-25': (16.9, 3.6, 0),
}
for f in fixtures.values():
    if f['ref'].startswith(prefix) and f['catalogId'] == 'timber-fence':
        suffix = f['ref'][len(prefix):]
        if suffix in fence_locations:
            move(suffix, *fence_locations[suffix])
        else:
            removed.add(f['ref'])
move('lights-w-6.6', 9.15, 0, 90)
move('lights-e-6.6', 18.05, 0, 90)
move('lights-cross', 13.6, -3.8)
remove('lights-w-12.6')
remove('lights-e-12.6')
p['landscape']['fixtures'] = [f for f in p['landscape']['fixtures'] if f['ref'] not in removed]

def rectangle(x0, z0, x1, z1):
    return [{'x': x0, 'z': z0}, {'x': x1, 'z': z0}, {'x': x1, 'z': z1}, {'x': x0, 'z': z1}]

zones = {z['ref']: z for z in p['landscape']['zones']}
for name, bounds in [('potager', (9.1, -3.8, 18.1, 3.6)), ('greenhouse-apron', (9.1, -8.4, 18.1, -3.8)), ('link', (-0.8, -8.4, 9.1, -7.0))]:
    zones['zone/kitchen-garden/' + name]['footprint'] = rectangle(*bounds)
# Gentle transition from the centred garden aisle to the retained orchard path.
zones['zone/kitchen-garden/orchard-path']['footprint'] = [
    {'x': 13.0, 'z': 3.6}, {'x': 14.2, 'z': 3.6},
    {'x': 15.0, 'z': 17.95}, {'x': 15.0, 'z': 25.5},
    {'x': 13.8, 'z': 25.5}, {'x': 13.8, 'z': 18.05},
]
p['revision'] = 82
p['updatedAt'] = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
path.write_text(json.dumps(p, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
print(json.dumps({'revision': 82, 'beds': 6, 'enclosureM': [9, 12], 'deletedRefs': sorted(removed)}, ensure_ascii=True, indent=2))
