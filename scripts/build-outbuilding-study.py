"""Brief: Build the r51 garden outbuilding concept from the preserved v2 r50 project.

Inputs: --source JSON baseline (default before-outbuilding-r50.json); --output
JSON destination (default tmp/outbuilding-study.json). No environment variables.
Outputs: readable project JSON with stable new entity refs; logs dimensions.
Usage: python -m scripts.build-outbuilding-study --output tmp/outbuilding-study.json
The original house, landscape entities and immutable migration baselines are retained.
"""
import argparse
import json
import logging
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path('project-data/zielonki-v2/before-outbuilding-r50.json'), help='Preserved source project JSON')
    parser.add_argument('--output', type=Path, default=Path('tmp/outbuilding-study.json'), help='Generated project JSON; never overwrite a baseline')
    return parser.parse_args()


def rectangle(x0, z0, x1, z1):
    return [dict(x=x0, z=z0), dict(x=x1, z=z0), dict(x=x1, z=z1), dict(x=x0, z=z1)]


def build(project):
    if any(b['ref'] == 'building/garden-outbuilding' for b in project['buildings']):
        raise ValueError('Source already contains this study.')
    timber = dict(material='natural-timber', colorHex='#B89265', textureId='hinoki')
    charcoal = dict(material='charred-timber', colorHex='#333A38', textureId='none')
    roof_finish = dict(material='standing-seam-metal', colorHex='#303536')
    floor_ref, storey_ref, roof_ref = 'slab/outbuilding', 'storey/outbuilding', 'roof/outbuilding'
    # Rectangles share wall entities; every crossing endpoint splits both adjoining rooms.
    rooms = [
        ('camper', 'Garaż na kampera', 'garage', (-4.5, -2, .5, 8)),
        ('workshop', 'Stolarnia', 'workshop', (-4.5, -8, .5, -2)),
        ('sauna', 'Sauna', 'sauna', (.5, -8, 4.5, -4)),
        ('wc', 'WC i zaplecze', 'bathroom', (.5, -4, 2.5, 0)),
        ('shower', 'Prysznic i przebieralnia', 'bathroom', (2.5, -4, 4.5, 0)),
        ('relax', 'Pokój wypoczynku', 'living', (.5, 0, 4.5, 8)),
    ]
    vertices = {(p['x'], p['z']) for _, _, _, bounds in rooms for p in rectangle(*bounds)}
    walls, spaces, edges = [], [], {}
    for slug, name, usage, bounds in rooms:
        corners = [(p['x'], p['z']) for p in rectangle(*bounds)]
        boundary = []
        for start, end in zip(corners, corners[1:] + corners[:1]):
            axis = 0 if start[1] == end[1] else 1
            cuts = [p for p in vertices if p[1-axis] == start[1-axis] and min(start[axis], end[axis]) <= p[axis] <= max(start[axis], end[axis])]
            cuts.sort(key=lambda p: p[axis], reverse=start[axis] > end[axis])
            for a, b in zip(cuts, cuts[1:]):
                key = tuple(sorted((a, b)))
                if key not in edges:
                    ref = f'wall/outbuilding/{len(walls) + 1:02d}'
                    exterior = a[0] == b[0] and abs(a[0]) == 4.5 or a[1] == b[1] and abs(a[1]) == 8
                    walls.append(dict(ref=ref, start=dict(zip(('x', 'z'), a)), end=dict(zip(('x', 'z'), b)), thicknessM=.24 if exterior else .16, baseElevationM=.2, heightM=4.1, openings=[], finish=timber if a[0] == b[0] == 4.5 else charcoal, locked=False))
                    edges[key] = (ref, a)
                ref, direction_start = edges[key]
                boundary.append(dict(wallRef=ref, direction=1 if a == direction_start else -1))
        spaces.append(dict(ref=f'space/outbuilding/{slug}', name=name, usage=usage, boundary=boundary, baseSlabRef=floor_ref, topBoundaryRef=roof_ref, locked=False))

    def opening(slug, a, b, offset, width, height, sill=0, glazed=False, kind='door'):
        ref, _ = edges[tuple(sorted((a, b)))]
        wall = next(w for w in walls if w['ref'] == ref)
        wall['openings'].append(dict(ref=f'opening/outbuilding/{slug}', kind=kind, wallRef=ref, offsetM=offset, widthM=width, heightM=height, sillM=sill, glazed=glazed))

    opening('camper-gate', (-4.5, 8), (.5, 8), 2.5, 3.6, 3.7)
    opening('workshop-entry', (-4.5, -8), (-4.5, -2), 1.4, 1.2, 2.3)
    opening('workshop-window', (-4.5, -8), (-4.5, -2), 4.25, 2.0, 1.1, 1.25, True, 'window')
    opening('garage-workshop', (-4.5, -2), (.5, -2), 3.5, .95, 2.2)
    opening('sauna-glazing', (4.5, -8), (4.5, -4), 2, 2.5, 2.3, .25, True, 'window')
    opening('sauna-door', (2.5, -4), (4.5, -4), 1, .85, 2.1, 0, True)
    opening('wc-door', (2.5, -4), (2.5, 0), 1.2, .85, 2.1)
    opening('shower-door', (2.5, 0), (4.5, 0), 1, .95, 2.2)
    opening('relax-garden', (4.5, 0), (4.5, 8), 4, 5.5, 2.7, .02, True)
    opening('relax-entry', (.5, 8), (4.5, 8), 2, 1.2, 2.3, 0, True)
    opening('service-window', (4.5, -4), (4.5, 0), 1, .8, .75, 1.65, True, 'window')
    footprint = rectangle(-4.62, -8.12, 4.62, 8.12)
    segment = dict(ref=f'{roof_ref}/gable', footprint=rectangle(-4.5, -8, 4.5, 8), storeyRef=storey_ref, baseElevationM=4.3, type='gable', pitchDegrees=40.13423424862029, overhangM=.6, ridgeDirection='z', finish=roof_finish, adjacentSegmentRefs=[], gableWallFinishes=dict(min=charcoal, max=timber), gableFrame=dict(widthM=.12, depthM=.14, colorHex='#303536'))
    pergola = dict(ref=f'{roof_ref}/pergola', footprint=rectangle(4.62, -1, 11.5, 8), baseElevationM=2.86, type='flat', pitchDegrees=0, overhangM=0, ridgeDirection='z', finish=dict(material='membrane', colorHex='#303536'), adjacentSegmentRefs=[], canopy=dict(fasciaHeightM=.18, fasciaEdgeIndices=[0, 1, 2, 3], frameColorHex='#303536', soffitColorHex='#B89265', postWidthM=.14, postBaseElevationM=.02, posts=[dict(x=x, z=z) for x in [4.76, 11.36] for z in [-.86, 3.5, 7.86]], slats=dict(direction='x', spacingM=.45, widthM=.07)))
    furniture = []

    def item(slug, catalog, name, x, z, w, d, h, color='#B89265', rotation=0):
        furniture.append(dict(ref=f'interior/outbuilding/{slug}', catalogId=catalog, storeyRef=storey_ref, name=name, position=dict(x=x, z=z), widthM=w, depthM=d, heightM=h, rotationDegrees=rotation, color=color))

    item('camper', 'camper', 'Kamper 7,4 × 2,35 × 3,1 m', -2, 3, 2.35, 7.4, 3.1, '#deddd4')
    item('workbench', 'desk', 'Stół stolarski', -1.6, -4.8, 2.3, 1.1, .9)
    item('tool-storage', 'wardrobe', 'Szafy narzędziowe', -2, -7.45, 3.3, .65, 2.1, '#4b5250')
    item('timber-rack', 'wardrobe', 'Regał na drewno', -3.95, -6.0, .65, 1.1, 1.8)
    item('sauna-upper', 'coffee-table', 'Górna ława sauny', 2.5, -7.35, 3.3, .85, .9)
    item('sauna-lower', 'coffee-table', 'Dolna ława sauny', 2.5, -6.55, 3.3, .65, .45)
    item('sauna-heater', 'cooker', 'Piec sauny — obrys koncepcyjny', 1.15, -4.7, .6, .6, .85, '#434b4c')
    item('shower', 'shower', 'Prysznic', 3.8, -3.2, 1, 1.1, 2.2)
    item('wc', 'toilet', 'WC', 1.3, -3.3, .5, .75, .85, '#eeece6')
    item('washbasin', 'vanity', 'Umywalka', 1.25, -.6, 1, .5, .85)
    item('relax-sofa', 'sofa', 'Sofa wypoczynkowa', 1.25, 3.6, 2.8, .9, .85, '#c9bdab', -90)
    item('relax-table', 'coffee-table', 'Stolik kawowy', 2.6, 3.6, .8, 1.2, .42)
    item('relax-chair', 'armchair', 'Fotel przy ogrodzie', 3.4, 6.5, .8, .8, .85, '#c9bdab')
    building = dict(ref='building/garden-outbuilding', name='Budynek gospodarczy · kamper, stolarnia i SPA · koncepcja', kind='garage', architecturalStyle='barn', designStatus='concept', position=dict(x=-9, z=53), rotationDegrees=0, furniture=furniture, stairs=[], slabs=[dict(ref=floor_ref, footprint=footprint, topElevationM=.2, thicknessM=.2, locked=False)], walls=walls, spaces=spaces, platforms=[], ceilingFinishes=[], storeys=[dict(ref=storey_ref, name='Parter — garaż, stolarnia i relaks', level=0, elevationM=.2, clearHeightM=4.1, baseSlabRef=floor_ref, topBoundaryRef=roof_ref, wallRefs=[w['ref'] for w in walls], spaceRefs=[s['ref'] for s in spaces], platformRefs=[], ceilingFinishRefs=[])], roof=dict(ref=roof_ref, type='gable', baseElevationM=4.3, pitchDegrees=segment['pitchDegrees'], overhangM=.6, footprint=segment['footprint'], finish=roof_finish, segments=[segment, pergola], junctions=[]), interiorSource=dict(id='zielonki-garden-outbuilding-concept', notes=[
        'User screenshot: left field entrance at the end of the wider site, near z=70 m.',
        'Concept on agricultural 06.R.21; MPZP §28 prohibits new buildings here. Not approved for construction.',
        'Main mass 9 × 16 m; camper bay approximately 4.8 × 9.8 m clear, gate 3.6 × 3.7 m.',
        'Terrace 6.88 × 16.24 m; outdoor kitchen, dining pergola, jacuzzi and loungers.',
        'Existing 8 m user-marked field entrance retained. Apron is conceptual, not a checked vehicle swept path.',
    ]))
    project['buildings'].append(building)
    project['landscape']['zones'].extend([
        dict(ref='zone/outbuilding/terrace', name='Taras SPA — 112 m²', kind='terrace', footprint=rectangle(-4.38, 44.88, 2.5, 61.12), locked=False, textureId='concrete-tiles'),
        dict(ref='zone/outbuilding/apron', name='Wjazd i plac manewrowy kampera', kind='driveway', footprint=[dict(x=-18.403, z=66), dict(x=-13.62, z=61.12), dict(x=-4.38, z=61.12), dict(x=-4.38, z=74), dict(x=-18.403, z=74)], locked=False, textureId='concrete-tiles'),
        dict(ref='zone/outbuilding/workshop-path', name='Dojście do stolarni', kind='path', footprint=rectangle(-14.9, 44.88, -13.62, 65), locked=False, textureId='concrete-tiles'),
    ])
    fixtures = [('spa', 'jacuzzi', 'Jacuzzi przy saunie', -.1, 47.2, 0), ('kitchen', 'outdoor-kitchen', 'Kuchnia zewnętrzna pod pergolą', -3.6, 54.0, 90), ('dining', 'outdoor-dining-set', 'Stół pod pergolą', -.3, 57.7, 0), ('lounger-1', 'sun-lounger', 'Leżak przy jacuzzi', -.8, 51, 0), ('lounger-2', 'sun-lounger', 'Leżak przy jacuzzi', .4, 51, 0)]
    for slug, catalog, name, x, z, rotation in fixtures:
        project['landscape']['fixtures'].append(dict(ref=f'fixture/outbuilding/{slug}', catalogId=catalog, name=name, position=dict(x=x, z=z), rotationDegrees=rotation, locked=False))
    project['revision'] = 51
    project['updatedAt'] = '2026-09-10T18:32:08.000Z'
    return project


def main() -> None:
    args = parse_args()
    if args.output.resolve() == args.source.resolve():
        raise ValueError('Output must not overwrite the recovery baseline.')
    project = build(json.loads(args.source.read_text(encoding='utf-8')))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(project, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    logging.info('Wrote %s: 9 × 16 m outbuilding, 112 m² terrace, retained field entrance.', args.output)


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(message)s')
    main()
