"""Prepare a shorter-hall layout from an exported Zielonki v2 working copy.

Inputs: --source is a ProjectV2 JSON file; --output is a new draft JSON path;
--shift-m is the movement toward the day area in metres (default 1).
--shorten-shell also moves the end wall on both storeys and shortens slabs/roof.
Outputs: a draft with aligned bathroom/office fronts and relocated doors/furniture.
Without --shorten-shell the outer shell and upper storey remain fixed.
No browser or canonical file is changed. No environment variables are required.
Usage: python -m scripts.shorten-hall-study --source source.json --output draft.json --shift-m 1.5 --shorten-shell
"""
import argparse
import copy
import json
import logging
import math
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, type=Path, help='Exported ProjectV2 JSON')
    parser.add_argument('--output', required=True, type=Path, help='New draft JSON file')
    parser.add_argument('--shift-m', type=float, default=1, help='Movement toward kitchen in metres')
    parser.add_argument('--shorten-shell', action='store_true', help='Shorten both storeys and the main roof by the same distance')
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    logging.basicConfig(level=logging.INFO, format='%(message)s')
    if not math.isfinite(args.shift_m) or args.shift_m <= 0:
        raise ValueError('Movement must be a finite positive number.')
    if args.output.exists():
        raise ValueError('Use a new output path to preserve earlier drafts.')
    project = json.loads(args.source.read_text(encoding='utf-8'))
    if project['ref'] != 'project/zielonki-v2':
        raise ValueError('Expected the existing Zielonki v2 project.')
    building = project['buildings'][0]
    floor = next(s for s in building['storeys'] if s['ref'] == 'storey/reference-ground')
    walls = {w['ref']: w for w in building['walls']}
    prefix = 'wall/carport-layout/ground/'
    original = copy.deepcopy(walls)
    front = walls[prefix + '7']['start']['z'] - args.shift_m
    office_delta = front - walls[prefix + '5']['start']['z']
    old_office_front = walls[prefix + '5']['start']['z']
    old_bath_front = walls[prefix + '7']['start']['z']
    old_utility_front = walls[prefix + '10']['start']['z']
    old_end = walls[prefix + '13']['start']['z']
    if args.shorten_shell:
        # Keep both levels supported by the same end wall; the ridge runs along Z,
        # so shortening its length preserves roof width, pitch and ridge height.
        for wall in building['walls']:
            for point in (wall['start'], wall['end']):
                if abs(point['z'] - old_end) < .0001:
                    point['z'] = round(old_end - args.shift_m, 6)
        for slab in building['slabs']:
            for point in slab['footprint']:
                if abs(point['z'] - old_end - .1) < .0001:
                    point['z'] = round(point['z'] - args.shift_m, 6)
        roof = building['roof']
        main_segment = next(s for s in roof['segments'] if s['ref'] == 'roof/reference/front-barn')
        if main_segment['ridgeDirection'] != 'z':
            raise ValueError('Shortening requires the main ridge to run along Z.')
        for footprint in (roof['footprint'], main_segment['footprint']):
            for point in footprint:
                if abs(point['z'] - old_end) < .0001:
                    point['z'] = round(old_end - args.shift_m, 6)
    for ref in floor['wallRefs']:
        wall = walls[ref]
        for point in (wall['start'], wall['end']):
            if abs(point['z'] - old_office_front) < .0001 or abs(point['z'] - old_bath_front) < .0001:
                point['z'] = round(front, 6)
            elif abs(point['z'] - old_utility_front) < .0001:
                point['z'] = round(old_utility_front - args.shift_m, 6)
        before = original[ref]
        dx = before['end']['x'] - before['start']['x']
        dz = before['end']['z'] - before['start']['z']
        length = math.hypot(dx, dz)
        for opening in wall['openings']:
            if ref not in {prefix + str(i) for i in (5, 7, 8, 10, 14, 15)}:
                continue
            # Preserve world position, then translate the opening with its room.
            old = next(o for o in before['openings'] if o['ref'] == opening['ref'])
            center = {'x': before['start']['x'] + dx / length * old['offsetM'],
                      'z': before['start']['z'] + dz / length * old['offsetM']}
            center['z'] += office_delta if ref in (prefix + '5', prefix + '15') else -args.shift_m
            new_dx = wall['end']['x'] - wall['start']['x']
            new_dz = wall['end']['z'] - wall['start']['z']
            new_length = math.hypot(new_dx, new_dz)
            opening['offsetM'] = round(((center['x'] - wall['start']['x']) * new_dx + (center['z'] - wall['start']['z']) * new_dz) / new_length, 9)
    # The 18.5 cm return disappears when the two room fronts meet in one line.
    return_ref = prefix + '6'
    if walls[return_ref]['openings'] or walls[return_ref].get('locked'):
        raise ValueError('The return must be unlocked and free of openings.')
    building['walls'] = [w for w in building['walls'] if w['ref'] != return_ref]
    floor['wallRefs'].remove(return_ref)
    for room in building['spaces']:
        room['boundary'] = [use for use in room['boundary'] if use['wallRef'] != return_ref]
    office_items = {'interior/carport-study/bed', 'interior/carport-study/desk'}
    for item in building.get('furniture', []):
        if item['storeyRef'] == floor['ref'] and item['ref'].startswith('interior/carport-study/'):
            item['position']['z'] = round(item['position']['z'] + (office_delta if item['ref'] in office_items else -args.shift_m), 6)
        if item['ref'] == 'interior/reference-understairs':
            entrance = next(o for o in walls[prefix + '8']['openings'] if o['ref'] == 'opening/reference-entrance')
            door_edge = walls[prefix + '8']['start']['z'] - entrance['offsetM'] - entrance['widthM'] / 2
            # Keep 12.5 cm between this cabinet and the entrance's opening arc.
            item['position']['z'] = round(min(item['position']['z'], door_edge - .125 - item['depthM'] / 2), 6)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(project, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    logging.info('Draft only: shift %.3f m, aligned fronts at Z=%.3f m; shell shortened: %s.', args.shift_m, front, args.shorten_shell)


if __name__ == '__main__':
    main()
