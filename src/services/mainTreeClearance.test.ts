import { expect, it } from 'vitest'
import currentData from '../../project-data/zielonki-rear-bath-room/project.json'
import previousData from '../../project-data/zielonki-rear-bath-room/before-house-tree-clearance-r41.json'
import { buildingFootprintsWorld, distanceToSegment, pointInPolygon } from '../domain/geometry'
import { parseProject } from '../domain/schema'

const removedRefs = [
  'plant/survey-501b',
  'plant/survey-501e',
  'plant/survey-5021',
  'plant/survey-5024',
  'plant/survey-503a',
  'plant/apple',
]

const crownOverlaps = (plant: ReturnType<typeof parseProject>['landscape']['plants'][number], building: ReturnType<typeof parseProject>['buildings'][number]) =>
  buildingFootprintsWorld(building).some((footprint) => pointInPolygon(plant.position, footprint) || footprint.some((start, index) =>
    distanceToSegment(plant.position, start, footprint[(index + 1) % footprint.length]) < plant.canopyM / 2))

it('removes only the six trees whose crowns overlap the GŁÓWNY house', () => {
  const previous = parseProject(previousData)
  const current = parseProject(currentData)
  const house = previous.buildings.find((building) => building.ref === 'house/main')!
  const removed = previous.landscape.plants.filter((plant) => removedRefs.includes(plant.ref))

  expect(current.revision).toBe(previous.revision + 1)
  expect(removed).toHaveLength(removedRefs.length)
  expect(removed.every((plant) => plant.kind === 'tree' && crownOverlaps(plant, house))).toBe(true)
  expect(current.landscape.plants.map((plant) => plant.ref)).not.toEqual(expect.arrayContaining(removedRefs))
  expect(current.landscape.plants).toEqual(previous.landscape.plants.filter((plant) => !removedRefs.includes(plant.ref)))
  expect(current.buildings).toEqual(previous.buildings)
  expect(current.site).toEqual(previous.site)
})
