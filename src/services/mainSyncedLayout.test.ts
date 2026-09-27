import { expect, it } from 'vitest'
// r79 is the release this test covers; the r80 kitchen garden changed only landscape.
import currentData from '../../project-data/zielonki-rear-bath-room/before-kitchen-garden-r79.json'
import previousData from '../../project-data/zielonki-rear-bath-room/before-mikrus-sync-r42.json'
import { validateProject } from '../domain/commands'
import { parseProject } from '../domain/schema'

const current = parseProject(currentData)
const previous = parseProject(previousData)
const house = (project: typeof current) => project.buildings.find((building) => building.ref === 'house/main')!
const content = (project: typeof current) => ({ ...project, revision: 0, updatedAt: '', buildings: project.buildings.map(({ furniture, walls, ...rest }) => rest) })

it('publishes the Mikrus-synced GŁÓWNY r78 layout with the study door inside its wall', () => {
  const furniture = house(current).furniture ?? []
  expect(current.revision).toBe(79)
  // Deletions made on the synced device remain deletions.
  expect(furniture.some((item) => item.ref === 'interior/entry-hall/wardrobe')).toBe(false)
  expect(furniture.some((item) => item.ref === 'interior/carport-study/washer')).toBe(false)
  expect(furniture.filter((item) => item.name === 'PAX / FORSAND Wardrobe')).toHaveLength(5)
  expect(furniture.find((item) => item.ref === 'interior/office-c5/desk')).toMatchObject({ position: { x: expect.closeTo(1.13, 6), z: 5.38 }, rotationDegrees: 180 })

  const wall = house(current).walls.find((item) => item.ref === 'wall/carport-layout/ground/5')!
  const door = wall.openings.find((item) => item.ref === 'opening/reference-office')!
  const length = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z)
  expect(door.offsetM + door.widthM).toBeLessThanOrEqual(length + 1e-9)
  expect(validateProject(current).filter((issue) => issue.severity === 'error')).toEqual([])
})

it('changes only furniture and the study door, leaving rooms, storeys, slabs, roofs and site intact', () => {
  expect(content(current)).toEqual(content(previous))
  const otherWalls = (project: typeof current) => house(project).walls.filter((wall) => wall.ref !== 'wall/carport-layout/ground/5')
  expect(otherWalls(current)).toEqual(otherWalls(previous))
})
