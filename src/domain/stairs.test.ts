import { expect, it } from 'vitest'
import current from '../../project-data/zielonki-rear-carport/project.json'
import furnished from '../../project-data/zielonki-rear-carport/proposed-u-stairs-r81.json'
import previous from '../../project-data/zielonki-rear-carport/before-u-stairs-r50.json'
import { parseProject } from './schema'
import { validateProject } from './commands'
import { mergeProjects } from './projectMerge'
import { uStairHeadroom, uStairSurfaces } from './stairs'
import { polygonBounds } from './geometry'

it('fits sixteen equal risers, two flights and storage below the return flight', () => {
  const project = parseProject(current), house = project.buildings[0], stair = house.stairs![0]
  const rise = house.storeys[1].elevationM - house.storeys[0].elevationM
  expect(rise).toBe(3)
  expect(rise / stair.steps).toBe(.1875)
  expect(stair.widthM - .04).toBeCloseTo(.85)
  expect(stair.start.z).toBe(-1.735)
  const enclosure = house.walls.filter(w => w.groupRef === 'wall-group/stair-enclosure')
  expect(enclosure).toHaveLength(3)
  expect(enclosure.every(w => house.storeys[0].wallRefs.includes(w.ref))).toBe(true)
  const kitchenWall = enclosure.find(w => w.ref.endsWith('/kitchen'))!
  const fridge = house.furniture!.find(item => item.catalogId === 'fridge')!
  expect(kitchenWall.start.z - kitchenWall.thicknessM / 2).toBeCloseTo(fridge.position.z + fridge.widthM / 2)
  expect(stair.start.z - (kitchenWall.start.z + kitchenWall.thicknessM / 2)).toBeCloseTo(.02)
  const storageDoor = enclosure.flatMap(w => w.openings)[0]
  expect(storageDoor).toMatchObject({ widthM: .8, heightM: 2 })
  expect(stair.runM / (stair.steps / 2 - 1)).toBe(.25)
  const surfaces = uStairSurfaces(stair, rise)
  expect(surfaces).toHaveLength(15)
  expect(surfaces[0].top).toBe(1.5)
  expect([...surfaces.map(s => s.top), rise].sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => (i + 1) * .1875))
  expect(uStairHeadroom(house, stair)).toBeGreaterThan(3)
  const hole = polygonBounds(house.slabs[1].holes![0])
  expect(-.305 - hole.maxX).toBeCloseTo(.9)
  expect(house.walls.find(w => w.ref === 'wall/reference-upper/3')!.openings[0].offsetM).toBe(.55)
  // The user subsequently deleted these three proposed cabinets; retain their fit audit.
  const cabinets = parseProject(furnished).buildings[0].furniture!.filter(item => item.groupRef === 'interior-group/understairs')
  expect(cabinets).toHaveLength(3)
  expect(house.furniture!.filter(item => item.groupRef === 'interior-group/understairs')).toHaveLength(0)
  for (const cabinet of cabinets) {
    const left = cabinet.position.x - cabinet.widthM / 2 - stair.start.x
    const right = cabinet.position.x + cabinet.widthM / 2 - stair.start.x
    const overhead = surfaces.filter(s => s.z > stair.widthM && s.x + s.width / 2 > left && s.x - s.width / 2 < right)
    expect(overhead.length).toBeGreaterThan(0)
    expect(cabinet.heightM).toBeLessThan(Math.min(...overhead.map(s => s.top - .08)))
  }
  expect(validateProject(project).filter(i => i.severity === 'error')).toEqual([])
})

it('rejects unequal flights, excessive risers and a missing slab opening', () => {
  const project = parseProject(current), house = project.buildings[0], stair = house.stairs![0]
  stair.steps = 15
  expect(validateProject(project).some(i => i.code === 'stairs.dimensions')).toBe(true)
  stair.steps = 14
  expect(validateProject(project).some(i => i.code === 'stairs.dimensions')).toBe(true)
  stair.steps = 16
  house.slabs[1].holes!.shift()
  expect(validateProject(project).some(i => i.code === 'stairs.headroom')).toBe(true)
})

it('preserves independent saved edits and reports conflicting stair edits', () => {
  const base = parseProject(previous), local = structuredClone(base)
  local.name = 'My house'
  local.buildings[1].furniture!.pop()
  const merged = mergeProjects(base, local, parseProject(current))
  expect(merged.conflicts).toEqual([])
  expect(merged.project.name).toBe(local.name)
  expect(merged.project.buildings[1].furniture).toEqual(local.buildings[1].furniture)
  expect(merged.project.buildings[0].stairs![0].uTurn).toEqual(current.buildings[0].stairs![0].uTurn)
  local.buildings[0].stairs![0].runM = 4
  expect(mergeProjects(base, local, parseProject(current)).conflicts.some(path => path.includes('stairs/reference-main/runM'))).toBe(true)
  expect(parseProject(previous).buildings[0].stairs![0].uTurn).toBeUndefined()
  const afterDeletion = mergeProjects(parseProject(furnished), parseProject(current), parseProject(furnished))
  expect(afterDeletion.conflicts).toEqual([])
  expect(afterDeletion.project.buildings[0].furniture!.some(item => item.groupRef === 'interior-group/understairs')).toBe(false)
})
