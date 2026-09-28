"""Reproducible r80 -> r81 landscape-only edit. Stable refs and immutable r80 backup."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
folder = root / 'project-data/zielonki-rear-bath-room'
baseline = folder / 'before-integrated-garden-r80.json'
if not baseline.exists():
    baseline.write_bytes((folder / 'project.json').read_bytes())
p = json.loads(baseline.read_text(encoding='utf-8'))
assert p['revision'] == 80
fixtures = {f['ref']: f for f in p['landscape']['fixtures']}
prefix = 'fixture/kitchen-garden/'

def move(suffix, x, z, rotation=0):
    f = fixtures[prefix + suffix]
    f['position'] = {'x': x, 'z': z}
    f['rotationDegrees'] = rotation

for row, z in enumerate([-1.3, 3.5, 8.3, 13.1], 1):
    for side, x in [('w', 12.2), ('e', 16.6)]:
        for kind in ['bed', 'crop']:
            move(f'{kind}-n{side}{row}', x, z, 90)
move('greenhouse', 14.4, -6.3)
move('butt-1', 16.95, -6.1)
move('butt-2', 16.95, -7.0)
move('square-centre', 14.4, 5.9)
move('flowers-centre', 14.4, 5.9)
for side, x in [('west', 12.2), ('east', 16.6)]:
    move('square-' + side, x, 16.8)
    move('flowers-' + side, x, 16.8)
for side, x in [('west', 11.1), ('east', 17.75)]:
    for suffix, z in [('5.6', 3.5), ('12.8', 10.7)]:
        move('border-' + side + '-' + suffix, x, z, 90)
move('border-south-w', 11.1, 14.2, 90)
move('border-south-e', 17.75, 14.2, 90)
for name, x, z in [('gate-w', 12.0, 18.9), ('gate-e', 16.8, 18.9), ('north-w', 11.2, -3.9), ('north-e', 17.6, -3.9), ('gh-w', 11.3, -7.8)]:
    move('hydrangea-' + name, x, z)
move('flowers-gh', 11.5, -5.8)
move('dining', 8.0, -10.0)

# Reuse every fence ref, then extend the enclosure round the greenhouse.
panels = [f for f in fixtures.values() if f['ref'].startswith(prefix) and f['catalogId'] == 'timber-fence']
locations = [(x, z, 90) for x in [10.8, 18.05] for z in [-7.2 + i * 2.4 for i in range(11)]]
locations += [(x, z, 0) for z in [-8.4, 18.0] for x in [12.0, 16.85]]
for i, (x, z, rotation) in enumerate(locations):
    if i < len(panels):
        f = panels[i]
    else:
        f = {'ref': prefix + f'fence-extension-{i}', 'catalogId': 'timber-fence', 'name': 'Larch garden enclosure', 'locked': False}
        p['landscape']['fixtures'].append(f)
    f['position'] = {'x': round(x, 3), 'z': round(z, 3)}
    f['rotationDegrees'] = rotation
for side, x in [('w', 10.85), ('e', 18.0)]:
    move(f'lights-{side}-6.6', x, 3.5, 90)
    move(f'lights-{side}-12.6', x, 12.5, 90)
move('lights-cross', 14.4, -3.8)

def rectangle(x0, z0, x1, z1):
    return [{'x': x0, 'z': z0}, {'x': x1, 'z': z0}, {'x': x1, 'z': z1}, {'x': x0, 'z': z1}]
zones = {z['ref']: z for z in p['landscape']['zones']}
for name, bounds in [('potager', (10.8, -3.8, 18.05, 18)), ('greenhouse-apron', (10.8, -8.4, 18.05, -3.8)), ('link', (-0.8, -8.4, 10.8, -7.0)), ('orchard-path', (13.8, 18, 15, 25.5))]:
    zones['zone/kitchen-garden/' + name]['footprint'] = rectangle(*bounds)
def zone(ref, name, kind, bounds, texture='river-pebbles'):
    p['landscape']['zones'].append({'ref': ref, 'name': name, 'kind': kind, 'footprint': rectangle(*bounds), 'locked': False, 'textureId': texture})
zone('zone/kitchen-garden/dining', 'Garden table landing', 'path', (5.8, -11.5, 10.8, -8.4))
zone('zone/fire-lounge/approach', 'Gravel walk to the sunken lounge', 'path', (13.8, 25.5, 15, 31.5))
zone('zone/fire-lounge/apron', 'Non-combustible lounge surround', 'terrace', (5.8, 31.5, 15, 42.1), 'concrete-tiles')
p['landscape']['fixtures'].append({'ref': 'fixture/fire-lounge/sunken-court', 'catalogId': 'sunken-fire-lounge', 'name': 'Obniżone palenisko · ławy i osłona z drewnem', 'position': {'x': 10.4, 'z': 37.5}, 'rotationDegrees': 0, 'locked': False})
p['revision'] = 81
p['updatedAt'] = '2026-09-27T15:00:00.000Z'
(folder / 'project.json').write_text(json.dumps(p, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
print('Prepared GŁÓWNY r81: integrated garden and sunken fire lounge; buildings/site unchanged.')
