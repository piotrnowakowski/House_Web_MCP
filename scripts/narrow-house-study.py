"""Prepare the user's narrower Zielonki v2 house from a saved project.

Inputs: --source ProjectV2 JSON, --output new draft JSON path,
--shift-m movement of the left facade above zero and up to 1.5 metres (default 1.5).
Outputs: a new draft JSON; no browser writes or canonical overwrite. No env vars.
Usage: python -m scripts.narrow-house-study --source source.json --output draft.json --shift-m 1.5
"""
import argparse
import json
import logging
import math
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True, help='Saved ProjectV2 JSON')
    parser.add_argument('--output', type=Path, required=True, help='New draft JSON path')
    parser.add_argument('--shift-m', type=float, default=1.5, help='Left facade movement in metres')
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    logging.basicConfig(level=logging.INFO, format='%(message)s')
    if not math.isfinite(args.shift_m) or not 0 < args.shift_m <= 1.5:
        raise ValueError('This layout supports a movement above zero and at most 1.5 m.')
    if args.output.exists():
        raise ValueError('Use a new output path to preserve earlier drafts.')
    project = json.loads(args.source.read_text(encoding='utf-8'))
    if project['ref'] != 'project/zielonki-v2':
        raise ValueError('Expected the existing Zielonki v2 project.')
    house = project['buildings'][0]
    shift = args.shift_m
    left = -5.495
    walls = {wall['ref']: wall for wall in house['walls']}
    prefix = 'wall/carport-layout/ground/'
    if walls[prefix + '8']['start']['x'] != left:
        raise ValueError('Source facade differs from the preserved layout; review it first.')
    for wall in house['walls']:
        upper = wall['ref'].startswith('wall/reference-upper/')
        for point in (wall['start'], wall['end']):
            x = point['x']
            if abs(x - left) < 1e-6 or (upper and abs(x + 1.705) < 1e-6):
                point['x'] = round(x + shift, 6)
            elif upper and any(abs(x - partition) < 1e-6 for partition in (-3.215, -3.195, -1.715, -.145)):
                # Share the reduction across laundry, landing, bathroom and end rooms.
                point['x'] = round(x + shift / 2, 6)
        if wall['ref'] == prefix + '10':
            wall['openings'] = [o for o in wall['openings'] if o['ref'] != 'opening/reference-pantry']
        for opening in wall['openings']:
            if wall['ref'] == 'wall/reference-ground/1':
                opening['offsetM'] = round(opening['offsetM'] - shift, 9)
            elif wall['ref'] == prefix + '7':
                opening['offsetM'] = round(opening['offsetM'] - shift / 2, 9)
            elif opening['ref'] == 'opening/reference-utility-exterior':
                opening['swing'] = 'out'
    for slab in house['slabs']:
        for point in slab['footprint']:
            if abs(point['x'] - left + .1) < 1e-6:
                point['x'] = round(point['x'] + shift, 6)
        for hole in slab.get('holes', []):
            stairs = max(p['x'] for p in hole) < -2
            for point in hole:
                if stairs or abs(point['x'] + 1.605) < 1e-6:
                    point['x'] = round(point['x'] + shift, 6)
    roof = house['roof']
    segment = next(s for s in roof['segments'] if s['ref'] == 'roof/reference/front-barn')
    for footprint in (roof['footprint'], segment['footprint']):
        for point in footprint:
            if abs(point['x'] - left) < 1e-6:
                point['x'] = round(point['x'] + shift, 6)
    # Reposition both end windows within their rooms and below the narrower gable.
    for number in (21, 24):
        wall = walls[f'wall/reference-upper/{number}']
        room_left = min(wall['start']['x'], wall['end']['x']) + wall['thicknessM'] / 2
        room_right = max(wall['start']['x'], wall['end']['x']) - wall['thicknessM'] / 2
        for opening in wall['openings']:
            inset = max(0, opening['sillM'] + opening['heightM'] - 1.4) / math.tan(math.radians(segment['pitchDegrees']))
            minimum = max(room_left, left + shift + inset) + opening['widthM'] / 2
            maximum = min(room_right, 2.085 - inset) - opening['widthM'] / 2
            if minimum > maximum:
                raise ValueError('An end window no longer fits below the roof.')
            center = (minimum + maximum) / 2
            opening['offsetM'] = round(wall['start']['x'] - center, 9)
    # Retain pitch/eaves/knee height: a narrower symmetric gable has a lower ridge.
    for stair in house['stairs']:
        stair['start']['x'] = round(stair['start']['x'] + shift, 6)
    moved = {
        'island', 'stool-one', 'stool-two', 'cabinet-one', 'sink', 'counter',
        'fridge', 'understairs', 'parents-bed',
    }
    moved_refs = {'interior/reference-' + name for name in moved} | {'interior/carport-study/wc', 'interior/carport-study/washer'}
    for item in house['furniture']:
        if item['ref'] in moved_refs:
            item['position']['x'] = round(item['position']['x'] + shift, 6)
        elif item['ref'] == 'interior/carport-study/storage':
            item['position']['x'] = round(item['position']['x'] + shift / 2, 6)
    # Extend only the approach edge that meets the relocated facade and its doors.
    angle = math.radians(house['rotationDegrees'])
    path = next(zone for zone in project['landscape']['zones'] if zone['ref'] == 'zone/path')
    for point in path['footprint']:
        dx, dz = point['x'] - house['position']['x'], point['z'] - house['position']['z']
        local_x = dx * math.cos(angle) - dz * math.sin(angle)
        if abs(local_x - left + .1) < 1e-6:
            point['x'] += shift * math.cos(angle)
            point['z'] -= shift * math.sin(angle)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(project, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    logging.info('Draft: facade moved %.2f m; bathroom/storage internal door removed.', shift)


if __name__ == '__main__':
    main()
