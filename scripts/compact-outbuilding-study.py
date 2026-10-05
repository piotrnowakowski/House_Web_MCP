"""Brief: Resize the preserved r51 outbuilding to a low, perpendicular 69 m² concept.

Inputs: --source project JSON; --output destination JSON. No environment variables.
Outputs: r52 project JSON; unrelated entities and retained entity refs are preserved.
Usage: python scripts/compact-outbuilding-study.py --output tmp/compact-outbuilding.json
The preserved source and immutable publication baselines must not be overwritten.
"""
import argparse
import json
import logging
from pathlib import Path


def rectangle(x0, z0, x1, z1):
    return [dict(x=x0, z=z0), dict(x=x1, z=z0), dict(x=x1, z=z1), dict(x=x0, z=z1)]


def compact(project):
    building = next(b for b in project['buildings'] if b['ref'] == 'building/garden-outbuilding')
    building.update(name='Budynek gospodarczy · 69 m² · kamper, stolarnia i sauna', position=dict(x=-8, z=68.5), rotationDegrees=270)
    timber = dict(material='natural-timber', colorHex='#B89265', textureId='hinoki')
    charcoal = dict(material='charred-timber', colorHex='#333A38', textureId='none')
    # Reuse surviving exterior/partition refs. The merged walls retain one source ref;
    # removed partitions and the former indoor lounge remain explicit deletions.
    specifications = [
        ('06', (-3.25, -5), (.15, -5)),
        ('07', (.15, -5), (.15, -2.7)),
        ('02', (.15, -2.7), (.15, 0)),
        ('03', (.15, 0), (.15, 5)),
        ('04', (.15, 5), (-3.25, 5)),
        ('05', (-3.25, 5), (-3.25, -5)),
        ('17', (.15, 0), (3.25, 0)),
        ('18', (3.25, 0), (3.25, 5)),
        ('19', (3.25, 5), (.15, 5)),
        ('10', (.15, -5), (3.25, -5)),
        ('11', (3.25, -5), (3.25, -2.7)),
        ('12', (3.25, -2.7), (.15, -2.7)),
        ('16', (3.25, -2.7), (3.25, 0)),
    ]
    old_walls = {w['ref']: w for w in building['walls']}
    walls = {}
    for suffix, start, end in specifications:
        wall = old_walls[f'wall/outbuilding/{suffix}']
        exterior = start[0] == end[0] and abs(start[0]) == 3.25 or start[1] == end[1] and abs(start[1]) == 5
        wall.update(start=dict(zip(('x', 'z'), start)), end=dict(zip(('x', 'z'), end)), thicknessM=.24 if exterior else .16, heightM=3.6, openings=[], finish=timber if start[0] == end[0] == 3.25 else charcoal)
        walls[suffix] = wall
    building['walls'] = list(walls.values())
    room_specs = [
        ('camper', 'Garaż na kampera', [('06', 1), ('07', 1), ('02', 1), ('03', 1), ('04', 1), ('05', 1)]),
        ('workshop', 'Stolarnia', [('17', 1), ('18', 1), ('19', 1), ('03', -1)]),
        ('sauna', 'Sauna', [('10', 1), ('11', 1), ('12', 1), ('07', -1)]),
        ('wc', 'Zaplecze SPA · prysznic, WC i przebieralnia', [('12', -1), ('16', 1), ('17', -1), ('02', -1)]),
    ]
    old_spaces = {s['ref']: s for s in building['spaces']}
    spaces = []
    for slug, name, boundary in room_specs:
        room = old_spaces[f'space/outbuilding/{slug}']
        room.update(name=name, boundary=[dict(wallRef=walls[suffix]['ref'], direction=direction) for suffix, direction in boundary])
        spaces.append(room)
    building['spaces'] = spaces

    def opening(slug, wall_suffix, offset, width, height, sill=0, glazed=False, kind='door'):
        wall = walls[wall_suffix]
        wall['openings'].append(dict(ref=f'opening/outbuilding/{slug}', kind=kind, wallRef=wall['ref'], offsetM=offset, widthM=width, heightM=height, sillM=sill, glazed=glazed))

    opening('camper-gate', '04', 1.7, 3.0, 3.4)
    opening('workshop-entry', '19', 1.55, 1.2, 2.3)
    opening('workshop-window', '18', 2.8, 2.4, 1.25, 1.05, True, 'window')
    opening('sauna-glazing', '11', 1.15, 1.5, 2.1, .25, True, 'window')
    opening('sauna-door', '12', 1.55, .85, 2.1, 0, True)
    opening('wc-door', '17', 1.55, .85, 2.1)
    opening('shower-door', '16', 1.35, 1, 2.3, 0, True)

    building['slabs'][0]['footprint'] = rectangle(-3.37, -5.12, 3.37, 5.12)
    storey = building['storeys'][0]
    storey.update(name='Parter · 69 m²', clearHeightM=3.6, wallRefs=[w['ref'] for w in building['walls']], spaceRefs=[s['ref'] for s in spaces])
    roof = building['roof']
    finish = dict(material='membrane', colorHex='#303536')
    footprint = rectangle(-3.25, -5, 3.25, 5)
    roof.update(type='flat', baseElevationM=3.8, pitchDegrees=0, overhangM=.16, footprint=footprint, finish=finish)
    main = roof['segments'][0]
    main.update(type='flat', baseElevationM=3.8, pitchDegrees=0, overhangM=.16, footprint=footprint, finish=finish)
    for field in ['gableWallFinishes', 'gableFrame', 'gableGlazing']:
        main.pop(field, None)
    pergola = roof['segments'][1]
    pergola.update(footprint=rectangle(3.37, -1, 9.2, 5), baseElevationM=2.86)
    pergola['canopy']['posts'] = [dict(x=x, z=z) for x in [3.51, 9.06] for z in [-.86, 2, 4.86]]

    # A full-size camper still fits. Indoor lounge items are removed; relaxation is outside.
    placements = {
        'camper': (-1.55, .15, 2.35, 7.4, 3.1),
        'workbench': (2.15, 2.2, 1.6, .8, .9),
        'tool-storage': (.55, 1.7, .6, 2.2, 2.1),
        'timber-rack': (2.82, 3.6, .5, 1.1, 1.8),
        'sauna-upper': (1.7, -4.42, 2.5, .8, .9),
        'sauna-lower': (1.7, -3.82, 2.5, .5, .45),
        'sauna-heater': (.65, -3.0, .4, .4, .85),
        'shower': (2.55, -.65, 1, 1, 2.2),
        'wc': (.65, -.65, .5, .75, .85),
        'washbasin': (.63, -1.85, .55, .8, .85),
    }
    furniture = []
    for item in building['furniture']:
        slug = item['ref'].rsplit('/', 1)[-1]
        if slug not in placements:
            continue
        x, z, width, depth, height = placements[slug]
        item.update(position=dict(x=x, z=z), widthM=width, depthM=depth, heightM=height, rotationDegrees=0)
        furniture.append(item)
    building['furniture'] = furniture
    building['interiorSource']['notes'] = [
        'User correction: low outbuilding under 70 m², long axis perpendicular to the field road.',
        'External enclosed footprint 10.24 × 6.74 m = 69.0176 m²; flat roof at 3.80 m, approximately 3.9 m overall.',
        'Camper bay approximately 3.20 × 9.76 m clear; gate 3.0 × 3.4 m faces the existing west field entrance.',
        'Workshop, sauna and combined sanitary/changing room. Relaxation moved to the separate 81.92 m² open terrace.',
        'Graphite and timber finishes match the house garage and pergola. Main-house pitched roofs are unchanged.',
        'Concept on agricultural 06.R.21; MPZP §28 prohibits new buildings here. Not approved for construction.',
        'Terrace and open pergola are separate from the enclosed footprint; this is not a statutory floor-area calculation.',
        'Existing 8 m entrance retained; vehicle movement is conceptual, not a checked swept path.',
    ]
    for zone in project['landscape']['zones']:
        if zone['ref'] == 'zone/outbuilding/terrace':
            zone.update(name='Taras SPA — 82 m²', footprint=rectangle(-13.12, 71.87, -2.88, 79.87))
        elif zone['ref'] == 'zone/outbuilding/apron':
            zone['footprint'] = rectangle(-18.403, 66, -13.12, 74)
        elif zone['ref'] == 'zone/outbuilding/workshop-path':
            zone['footprint'] = rectangle(-14.32, 71.87, -13.12, 79.87)
    fixture_positions = {'spa': (-5, 76.9, 0), 'kitchen': (-8.6, 72.6, 0), 'dining': (-10.5, 75.4, 0), 'lounger-1': (-5, 73.8, 90), 'lounger-2': (-8, 78.5, 90)}
    for fixture in project['landscape']['fixtures']:
        if fixture['ref'].startswith('fixture/outbuilding/'):
            x, z, rotation = fixture_positions[fixture['ref'].rsplit('/', 1)[-1]]
            fixture.update(position=dict(x=x, z=z), rotationDegrees=rotation)
    project.update(revision=52, updatedAt='2026-09-10T19:00:00.000Z')
    return project


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path('project-data/zielonki-v2/before-compact-outbuilding-r51.json'))
    parser.add_argument('--output', type=Path, default=Path('tmp/compact-outbuilding.json'))
    args = parser.parse_args()
    if args.source.resolve() == args.output.resolve():
        raise ValueError('Output must not overwrite the recovery baseline.')
    project = compact(json.loads(args.source.read_text(encoding='utf-8')))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(project, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    logging.info('Wrote %s: 69.02 m² enclosed building, rotation 270°, 81.92 m² separate terrace.', args.output)


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(message)s')
    main()
