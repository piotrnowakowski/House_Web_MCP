"""Build the independent south-carport concept from its immutable house baseline.

Inputs: --source tracked v2 baseline JSON, --output destination JSON; surveyed neighbor data
and the common before-pergola baseline in the repository. No environment variables.
Output: deterministic, readable ProjectV2 JSON; never changes the original house or browser.
Usage from repository root: python scripts/build-carport-study.py --output tmp/carport.json
"""
import argparse
from copy import deepcopy
import json
import logging
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def point(x, z):
    return dict(x=round(x, 9), z=round(z, 9))


def rect(x1, z1, x2, z2):
    return [point(x1, z1), point(x2, z1), point(x2, z2), point(x1, z2)]


def dot(a, b):
    return a['x'] * b['x'] + a['z'] * b['z']


def world(building, p):
    a = math.radians(building['rotationDegrees'])
    return point(building['position']['x'] + p['x'] * math.cos(a) + p['z'] * math.sin(a),
                 building['position']['z'] - p['x'] * math.sin(a) + p['z'] * math.cos(a))


def build(source):
    project = deepcopy(source)
    if source['ref'] != 'project/zielonki-v2':
        raise ValueError('This change continues the existing zielonki v2 project.')
    project.update(revision=source['revision'] + 1, updatedAt='2026-09-10T16:12:00.000Z')
    house = project['buildings'][0]
    house['name'] = 'House · south carport layout'
    house.pop('garageMode', None)
    # Reverse the road-facing end: the kitchen side now faces south-southeast.
    # This preserves upstairs topology and the stair connection without reflecting stair ascent.
    house['rotationDegrees'] = (house['rotationDegrees'] + 180) % 360
    house['position'] = point(0, 0)
    house['interiorSource']['notes'] += [
        'South-carport revision 2026-09-10 continues the existing zielonki v2 project, retaining both pergolas and the upper floor. Ground-floor rooms follow the supplied screenshot, not a measured architectural plan.',
        'The house is rotated 180 degrees from the source study so the kitchen-side carport faces south-southeast and opens toward the road. The original house remains a separate project.',
        'Placement target: 4.00 m outside-wall distance from the surveyed road parcel edge, not a confirmed statutory minimum or verified MPZP building line. The whole roof envelope stays approximately 0.15 m inside MNU; carport corner governs placement.',
        'Two 3.20 m parking modules within a 6.40 x 6.40 m canopy. Vehicle envelopes are 1.90 x 4.70 m; access is direct from the road. Vehicle turning paths, road access consent, structure and canopy planning permission need design verification.',
        'Five surveyed trees conflict with the carport and are proposed removals in v2 only: plant/survey-5012, plant/survey-5015, plant/survey-5018, plant/survey-501b, plant/apple. Their source records remain in before-carport-r46.json and the original house. This is not tree-removal authorization.',
    ]
    ground, upper = house['storeys']
    old_rooms = {r['ref']: r for r in house['spaces']}
    old_walls = {tuple(sorted(((w['start']['x'], w['start']['z']), (w['end']['x'], w['end']['z'])))): w
                 for w in house['walls'] if w['ref'] in ground['wallRefs']}
    house['walls'] = [w for w in house['walls'] if w['ref'] not in ground['wallRefs']]
    house['spaces'] = [r for r in house['spaces'] if r['ref'] not in ground['spaceRefs']]
    ground['wallRefs'], ground['spaceRefs'] = [], []
    outline = [point(-5.495, -6.555), point(5.495, -6.555), point(5.495, .995),
               point(2.085, .995), point(2.085, 8.385), point(-5.495, 8.385)]
    rooms = [
        ('living', 'Living, kitchen & entrance hall', 'living', [*outline[:4], point(2.085, 4), point(-1.63, 4), point(-1.63, 3.415), point(-5.495, 3.415)]),
        ('wc', 'Bathroom', 'bathroom', rect(-5.495, 3.415, -1.63, 5.575)),
        ('pantry', 'Utility & bicycles storage', 'utility', rect(-5.495, 5.575, -1.63, 8.385)),
        ('office', 'Guest bedroom & study', 'bedroom', rect(-1.63, 4, 2.085, 8.385)),
    ]
    vertices = [p for *_, polygon in rooms for p in polygon]
    walls = {}
    for rid, name, usage, polygon in rooms:
        boundary = []
        for start, end in zip(polygon, polygon[1:] + polygon[:1]):
            dx, dz = end['x'] - start['x'], end['z'] - start['z']
            length2 = dx * dx + dz * dz
            points = {0: start, 1: end}
            for p in vertices:
                t = ((p['x'] - start['x']) * dx + (p['z'] - start['z']) * dz) / length2
                cross = (p['x'] - start['x']) * dz - (p['z'] - start['z']) * dx
                if 0 < t < 1 and abs(cross) < 1e-7:
                    points[t] = p
            ordered = [p for _, p in sorted(points.items())]
            for a, b in zip(ordered, ordered[1:]):
                key = tuple(sorted(((a['x'], a['z']), (b['x'], b['z']))))
                if key not in walls:
                    previous = old_walls.get(key)
                    ref = previous['ref'] if previous else f'wall/carport-layout/ground/{len(walls) + 1}'
                    wall = dict(ref=ref, start=a, end=b, thicknessM=.2, baseElevationM=.45, heightM=2.8,
                                openings=[], locked=False, finish=dict(material='natural-timber', colorHex='#BD9C73'))
                    if previous:
                        for field in ['finish', 'faceFinishes', 'locked']:
                            if field in previous:
                                wall[field] = deepcopy(previous[field])
                    walls[key] = wall
                    house['walls'].append(wall)
                    ground['wallRefs'].append(ref)
                wall = walls[key]
                boundary.append(dict(wallRef=wall['ref'], direction=1 if a == wall['start'] else -1))
        ref = 'space/reference-' + rid
        room = deepcopy(old_rooms[ref])
        room.update(name=name, usage=usage, boundary=boundary)
        house['spaces'].append(room)
        ground['spaceRefs'].append(ref)

    def opening(rid, x, z, width, kind='door', sill=0, height=2.1, glazed=False):
        for wall in walls.values():
            a, b = wall['start'], wall['end']
            if (min(a['x'], b['x']) - 1e-6 <= x <= max(a['x'], b['x']) + 1e-6 and
                min(a['z'], b['z']) - 1e-6 <= z <= max(a['z'], b['z']) + 1e-6):
                offset = math.hypot(x - a['x'], z - a['z'])
                if offset < width / 2 or offset + width / 2 > math.hypot(b['x'] - a['x'], b['z'] - a['z']):
                    continue
                wall['openings'].append(dict(ref='opening/reference-' + rid, wallRef=wall['ref'], kind=kind,
                                            offsetM=offset, widthM=width, heightM=height, sillM=sill, glazed=glazed))
                return
        raise ValueError(f'No fitting wall for opening {rid}')

    opening('terrace-north', -1.0, -6.555, 4.5, 'window', 0, 2.8, True)
    opening('terrace-east', 5.495, -2.8, 5.3, 'window', 0, 2.8, True)
    opening('kitchen', -5.495, -3.9, 3.4, 'window', 1.05, 1.2, True)
    opening('entrance', -5.495, 1.95, 1.1)
    opening('wc', -3.5, 3.415, .9)
    opening('pantry', -3.5, 5.575, .9)
    opening('office', .1, 4, .9)
    opening('office-window', 2.085, 6.7, 1.8, 'window', .8, 1.5, True)
    opening('utility-exterior', -5.495, 7.3, .95)
    house['slabs'][0]['footprint'] = [point(-5.595, -6.655), point(5.595, -6.655), point(5.595, 1.095),
                                    point(2.185, 1.095), point(2.185, 8.485), point(-5.595, 8.485)]
    # Former terrace exits now face an ordinary facade: retain glazing, add safe sills.
    for wall in house['walls']:
        for o in wall['openings']:
            if o['kind'] == 'door' and o['ref'] in ['opening/reference-children-west-window', 'opening/reference-children-east-window']:
                o.update(kind='window', sillM=1, heightM=1.2, glazed=True)
    retained = [f for f in house['furniture'] if f['storeyRef'] == upper['ref'] or
                f['ref'].split('interior/reference-')[-1] in ['sofa', 'media', 'dining', 'island', 'stool-one', 'stool-two', 'cabinet-one', 'sink', 'counter', 'fridge', 'understairs']]
    house['furniture'] = retained

    def item(ref, catalog, name, x, z, width, depth, height, color='#bda17a'):
        return dict(ref=ref, catalogId=catalog, storeyRef=ground['ref'], name=name, position=point(x, z),
                    widthM=width, depthM=depth, heightM=height, rotationDegrees=0, color=color)

    house['furniture'] += [
        item('interior/carport-study/bed', 'bed', 'Guest bed', .15, 6.8, 1.6, 2.05, .85),
        item('interior/carport-study/desk', 'desk', 'Guest desk', .9, 4.65, 1.4, .6, .75),
        item('interior/carport-study/wc', 'toilet', 'Toilet', -4.95, 4.75, .45, .7, .8),
        item('interior/carport-study/shower', 'shower', 'Shower', -2.25, 4.9, .9, .9, 2.1),
        item('interior/carport-study/vanity', 'vanity', 'Vanity', -2.25, 3.85, .85, .5, .85),
        item('interior/carport-study/washer', 'washer', 'Washer', -4.95, 6.1, .6, .65, .85),
        item('interior/carport-study/storage', 'wardrobe', 'Utility storage', -3.5, 7.95, 2, .6, 2.2),
    ]
    footprint = rect(-12.095, -6.555, -5.695, -.155)
    segment = dict(ref='roof/carport/south', footprint=footprint, storeyRef='storey/carport', baseElevationM=2.95,
                   type='flat', pitchDegrees=0, overhangM=0, ridgeDirection='z',
                   finish=dict(material='membrane', colorHex='#303536'), adjacentSegmentRefs=[],
                   canopy=dict(fasciaHeightM=.3, fasciaEdgeIndices=[0, 1, 2, 3], frameColorHex='#303536',
                               soffitColorHex='#D0AB7C', postWidthM=.16, postBaseElevationM=.45,
                               posts=[point(x, z) for x in [-11.935, -5.855] for z in [-6.395, -.315]]))
    carport = dict(ref='building/south-carport', name='South carport · 2 cars', kind='garage', architecturalStyle='barn',
                   position=point(0, 0), rotationDegrees=house['rotationDegrees'], walls=[], spaces=[], platforms=[], ceilingFinishes=[],
                   slabs=[dict(ref='slab/carport', footprint=footprint, topElevationM=.45, thicknessM=.18, locked=False)],
                   storeys=[dict(ref='storey/carport', name='Parking', level=0, elevationM=.45, clearHeightM=2.5,
                                 baseSlabRef='slab/carport', topBoundaryRef='roof/carport', wallRefs=[], spaceRefs=[], platformRefs=[], ceilingFinishRefs=[])],
                   roof=dict(ref='roof/carport', type='flat', baseElevationM=2.95, pitchDegrees=0, overhangM=0,
                             footprint=footprint, finish=segment['finish'], segments=[segment], junctions=[]), furniture=[])
    for i, x in enumerate([-10.495, -7.295]):
        car = item(f'interior/carport/car-{i+1}', 'car', f'Car {i+1} · 1.90 × 4.70 m', x, -3.355, 1.9, 4.7, 1.5, ['#89969e', '#d1cfc6'][i])
        car['storeyRef'] = 'storey/carport'
        carport['furniture'].append(car)
    project['buildings'].append(carport)
    # Solve two signed clearances in the same survey coordinate frame; include roofs/fascia.
    road_corner = point(-19.778, -15.1)
    rn = point(25.63 / math.hypot(25.63, 1.375), -1.375 / math.hypot(25.63, 1.375))
    zn = point(15.363 / math.hypot(15.363, 35.787), 35.787 / math.hypot(15.363, 35.787))
    envelope = [world(house, p) for slab in house['slabs'] for p in slab['footprint']]
    pergolas = [world(house, p) for s in house['roof']['segments'] if s.get('canopy') for p in s['footprint']]
    canopy_edge = [world(carport, p) for p in rect(-12.155, -6.615, -5.635, -.095)]
    road_offset = 4 + dot(rn, road_corner) - min(dot(rn, p) for p in envelope)
    zone_offset = dot(zn, point(-18.403, 10.530)) - .15 - max(dot(zn, p) for p in envelope + canopy_edge + pergolas)
    determinant = rn['x'] * zn['z'] - rn['z'] * zn['x']
    position = point((road_offset * zn['z'] - rn['z'] * zone_offset) / determinant,
                     (rn['x'] * zone_offset - road_offset * zn['x']) / determinant)
    house['position'] = position
    carport['position'] = deepcopy(position)
    # Site-fixed trees/fixtures remain survey anchored. Rebuild only house-related surfaces.
    zones = {z['ref']: z for z in project['landscape']['zones']}
    front = [world(carport, p) for p in [point(-12.095, -6.555), point(-5.595, -6.555)]]
    def road_projection(p):
        # Inset 1 cm to avoid roundoff placing the apron outside the surveyed polygon.
        d = dot(rn, point(p['x'] - road_corner['x'], p['z'] - road_corner['z'])) - .01
        return point(p['x'] - d * rn['x'], p['z'] - d * rn['z'])
    zones['zone/driveway'].update(name='Direct road access · two-car apron', footprint=[road_projection(front[0]), front[0], front[1], road_projection(front[1])])
    zones['zone/path'].update(name='Carport to entrance', footprint=[world(house, p) for p in rect(-6.995, -.155, -5.595, 8.485)])
    terrace = [point(-5.595, 8.485), point(2.185, 8.485), point(2.185, 1.095), point(5.595, 1.095), point(5.595, 11.655), point(-5.595, 11.655)]
    zones['zone/terrace'].update(name='Garden terrace beneath retained pergolas', footprint=[world(house, p) for p in terrace])
    entrance = next(e for e in project['site']['entrances'] if e['ref'] == 'entrance/house-road')
    entrance.update(start=road_projection(front[0]), end=road_projection(front[1]))
    proposed_removals = {'plant/survey-5012', 'plant/survey-5015', 'plant/survey-5018', 'plant/survey-501b', 'plant/apple'}
    project['landscape']['plants'] = [p for p in project['landscape']['plants'] if p['ref'] not in proposed_removals]
    common = json.loads((ROOT / 'project-data/zielonki-v2/before-pergola-r45.json').read_text(encoding='utf8'))['project']
    revised_neighbors = json.loads((ROOT / 'knowledge-bank/zielonki/neighbors.json').read_text(encoding='utf8'))
    base_neighbors = {n['ref']: n for n in common['site']['neighbors']}
    incoming = {n['ref']: n for n in revised_neighbors}
    for neighbor in project['site']['neighbors']:
        base, revised = base_neighbors[neighbor['ref']], incoming[neighbor['ref']]
        for key, value in revised.items():
            if neighbor.get(key) != base.get(key) and value != base.get(key) and neighbor.get(key) != value:
                raise ValueError(f"Unresolved neighbor conflict: {neighbor['ref']}/{key}")
            if neighbor.get(key) == base.get(key):
                neighbor[key] = deepcopy(value)
    return project


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT / 'project-data/zielonki-v2/before-carport-r46.json', help='Immutable v2 source project JSON')
    parser.add_argument('--output', type=Path, required=True, help='Destination JSON; use tmp/ for a comparison build')
    return parser.parse_args()


def main():
    args = parse_args()
    logging.basicConfig(level=logging.INFO, format='%(message)s')
    project = build(json.loads(args.source.read_text(encoding='utf8')))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(project, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    logging.info('Wrote %s r%s to %s', project['ref'], project['revision'], args.output)


if __name__ == '__main__':
    main()
