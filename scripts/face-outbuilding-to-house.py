"""Brief: Turn the r52 outbuilding toward the house and extend its enclosed garage.

Inputs: --source preserved project JSON; --output destination JSON. No environment variables.
Outputs: r53 JSON with a tandem car/camper garage and a 37-degree gable; logs dimensions.
Usage: python scripts/face-outbuilding-to-house.py --output tmp/house-facing-outbuilding.json
The source recovery snapshot and all unrelated project entities remain unchanged.
"""
import argparse
import json
import logging
from pathlib import Path


def extend_and_turn(project):
    building = next(b for b in project['buildings'] if b['ref'] == 'building/garden-outbuilding')
    old_position = building['position'].copy()
    building.update(name='Budynek gospodarczy · 99 m² · garaż na kampera i auto', position=dict(x=-9, z=64.8), rotationDegrees=90)
    # Extend the far end by 4.5 m while retaining wall/room refs and shared boundaries.
    for wall in building['walls']:
        for point in [wall['start'], wall['end']]:
            if point['z'] == 5:
                point['z'] = 9.5
    for point in building['slabs'][0]['footprint']:
        if point['z'] == 5.12:
            point['z'] = 9.62
    building['storeys'][0]['name'] = 'Parter · 99 m²'
    building['spaces'][0]['name'] = 'Garaż tandemowy · samochód przed kamperem'

    walls = {wall['ref'].rsplit('/', 1)[-1]: wall for wall in building['walls']}
    # After the half-turn, the opposite gable faces the unchanged west entrance.
    gate = walls['04']['openings'].pop()
    gate.update(wallRef=walls['06']['ref'], offsetM=1.7)
    walls['06']['openings'].append(gate)
    entry = walls['19']['openings'].pop()
    entry.update(wallRef=walls['18']['ref'], offsetM=3.5)
    walls['18']['openings'][0]['offsetM'] = 7.4
    walls['18']['openings'].append(entry)

    roof = building['roof']
    finish = dict(material='standing-seam-metal', colorHex='#303536')
    main = roof['segments'][0]
    for point in main['footprint']:
        if point['z'] == 5:
            point['z'] = 9.5
    main.update(type='gable', pitchDegrees=37, overhangM=.6, finish=finish,
                gableWallFinishes=dict(min=walls['06']['finish'], max=walls['04']['finish']))
    roof.update(type='gable', pitchDegrees=37, overhangM=.6, finish=finish, footprint=main['footprint'])
    camper = next(i for i in building['furniture'] if i['ref'] == 'interior/outbuilding/camper')
    camper.update(position=dict(x=-1.55, z=4.7), rotationDegrees=180)
    building['furniture'].append(dict(ref='interior/outbuilding/car', catalogId='car',
        storeyRef=building['storeys'][0]['ref'], name='Samochód 1,90 × 4,70 m · przed kamperem',
        position=dict(x=-1.55, z=-1.75), widthM=1.9, depthM=4.7, heightM=1.5,
        rotationDegrees=180, color='#879997'))
    workshop_positions = {'workbench': (2.15, 5.4), 'tool-storage': (.55, 5.1), 'timber-rack': (2.82, 8.1)}
    for item in building['furniture']:
        slug = item['ref'].rsplit('/', 1)[-1]
        if slug in workshop_positions:
            x, z = workshop_positions[slug]
            item['position'] = dict(x=x, z=z)

    def turn(point):
        return {axis: round(building['position'][axis] + old_position[axis] - point[axis], 8) for axis in ['x', 'z']}

    for zone in project['landscape']['zones']:
        if zone['ref'].startswith('zone/outbuilding/'):
            zone['footprint'] = [turn(point) for point in zone['footprint']]
        if zone['ref'] == 'zone/outbuilding/apron':
            zone['footprint'] = [dict(x=-18.403, z=63.2), dict(x=-14.12, z=63.2), dict(x=-14.12, z=74), dict(x=-18.403, z=74)]
        elif zone['ref'] == 'zone/outbuilding/workshop-path':
            zone['footprint'] = [dict(x=-15.32, z=53.43), dict(x=-14.12, z=53.43), dict(x=-14.12, z=66), dict(x=-15.32, z=66)]
    for fixture in project['landscape']['fixtures']:
        if fixture['ref'].startswith('fixture/outbuilding/'):
            fixture['position'] = turn(fixture['position'])
            fixture['rotationDegrees'] = (fixture['rotationDegrees'] + 180) % 360

    building['interiorSource']['notes'] = [
        'User requested the terrace toward the house, an enclosed car space and accepted exceeding 70 m².',
        'External enclosed footprint 14.74 × 6.74 m = 99.3476 m²; extension 4.5 m along the long axis.',
        'Rotation 90 degrees: the terrace faces the house, the long axis remains perpendicular to the field road.',
        'Garage approximately 3.20 × 14.26 m clear. Car 4.70 m before camper 7.40 m, with a 0.40 m longitudinal gap.',
        'Tandem layout: the car must leave before the camper can drive out. Gate moved to the west gable.',
        'Main outbuilding roof changed to a symmetric 37-degree gable with 0.60 m overhangs; eaves 3.80 m, ridge about 6.25 m.',
        'MPZP IX/55/2007 §13(6)(4) and §13(9) do not establish permission for a flat roof here; 2020 amendment retains the roof provisions.',
        'Concept remains on agricultural 06.R.21, where §28 prohibits new buildings. Roof correction does not approve this location.',
        'Existing open terrace/pergola retained as concept, not certified for planning compliance. Main-house roofs remain unchanged.',
    ]
    project.update(revision=53, updatedAt='2026-09-10T19:15:00.000Z')
    return project


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path('project-data/zielonki-v2/before-house-facing-outbuilding-r52.json'))
    parser.add_argument('--output', type=Path, default=Path('tmp/house-facing-outbuilding.json'))
    args = parser.parse_args()
    if args.source.resolve() == args.output.resolve():
        raise ValueError('Output must not overwrite the recovery baseline.')
    project = extend_and_turn(json.loads(args.source.read_text(encoding='utf-8')))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(project, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    logging.info('Wrote %s: 99.35 m², 90° orientation, tandem garage, 37° gable.', args.output)


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(message)s')
    main()
