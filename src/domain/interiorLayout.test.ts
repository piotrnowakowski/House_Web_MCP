import { beforeEach, describe, expect, it } from 'vitest'
import { applyCommand, validateProject } from './commands'
import { sampleProject } from './sampleProject'
import { polygonArea, spaceFootprint } from './geometry'
import { createIkeaItem, ikeaCatalog } from './ikeaCatalog'
import { finishFromPreset } from './interiorFinishes'
import { interiorCorners, itemFitsFloor } from './interior'
import { footprintsOverlap, placementWarnings, snapFurniture } from './interiorPlacement'
import { parseProject } from './schema'
import { diffProjects } from './diff'
import { useStudioStore } from '../state/store'
import { furnitureCsv, interiorPlanSvg } from '../interior/interiorExports'
import type { InteriorCommand, ProjectV2 } from './types'

const base = { type: 'interior.update' as const, buildingRef: 'house/main', storeyRef: 'storey/ground' }
const split: InteriorCommand = {
  ...base,
  action: 'split',
  spaceRef: 'space/kitchen-studio',
  start: { x: -6, z: -1.5 },
  end: { x: 0, z: -1.5 },
  partitionRef: 'wall/new',
  newSpaceRef: 'space/new',
  name: 'Office',
  thicknessM: 0.12,
}
let project: ProjectV2
beforeEach(() => {
  project = structuredClone(sampleProject)
})
const errors = (value: ProjectV2) => validateProject(value).filter((issue) => issue.severity === 'error')

describe('Interior layout topology', () => {
  it('splits both hosts, keeps adjacent rooms connected and preserves world opening positions', () => {
    const next = applyCommand(project, split)
    const house = next.buildings[0]
    expect(house.spaces).toHaveLength(3)
    expect(house.walls).toHaveLength(10)
    expect(house.spaces.reduce((area, room) => area + polygonArea(spaceFootprint(house, room)), 0)).toBeCloseTo(108)
    const doorWall = house.walls.find((wall) => wall.openings.some((o) => o.ref === 'opening/internal-door'))!
    const door = doorWall.openings[0]
    expect(doorWall.start.z + door.offsetM).toBeCloseTo(0)
    expect(door.wallRef).toBe(doorWall.ref)
    expect(errors(next)).toEqual([])
    expect(project.buildings[0].walls).toHaveLength(7)
  })
  it('merges rooms without leaving roof, slab or room references dangling', () => {
    const next = applyCommand(applyCommand(project, split), { ...base, action: 'merge', wallRef: 'wall/new' })
    expect(next.buildings[0].spaces).toHaveLength(2)
    expect(
      next.buildings[0].spaces.reduce((a, r) => a + polygonArea(spaceFootprint(next.buildings[0], r)), 0),
    ).toBeCloseTo(108)
    expect(errors(next)).toEqual([])
  })
  it('moves a connected partition and resizes a room while the exterior stays on the slab boundary', () => {
    const next = applyCommand(project, {
      ...base,
      action: 'room',
      spaceRef: 'space/kitchen-studio',
      name: 'Kitchen',
      widthM: 5.4,
    })
    const house = next.buildings[0]
    expect(house.walls.find((w) => w.ref === 'wall/partition')!.start.x).toBeCloseTo(-0.6)
    expect(house.slabs).toEqual(project.buildings[0].slabs)
    expect(house.walls.find((w) => w.ref === 'wall/north-left')!.end.x).toBeCloseTo(-0.6)
    expect(house.walls.find((w) => w.ref === 'wall/north-right')!.start.x).toBeCloseTo(-0.6)
    expect(errors(next)).toEqual([])
  })
  it('rejects exterior edits, crossing geometry, locked connected rooms and floor voids atomically', () => {
    const before = structuredClone(project)
    expect(() =>
      applyCommand(project, {
        ...base,
        action: 'wall',
        wallRef: 'wall/west',
        start: { x: -7, z: 4.5 },
        end: { x: -7, z: -4.5 },
      }),
    ).toThrow(/exterior/)
    expect(() =>
      applyCommand(project, {
        ...base,
        action: 'wall',
        wallRef: 'wall/partition',
        start: { x: 0, z: 6 },
        end: { x: 0, z: 4.5 },
      }),
    ).toThrow()
    project.buildings[0].spaces.find((r) => r.ref === 'space/living')!.locked = true
    expect(() => applyCommand(project, split)).toThrow(/locked/)
    project = before
    project.buildings[0].slabs[0].holes = [
      [
        { x: -4, z: -2 },
        { x: -2, z: -2 },
        { x: -2, z: -1 },
        { x: -4, z: -1 },
      ],
    ]
    expect(() => applyCommand(project, split)).toThrow(/opening|void/)
    expect(project.buildings[0].walls).toHaveLength(7)
  })
  it('validates opening bounds, overlaps, hinge and swing through round trips', () => {
    const door = {
      ref: 'opening/new',
      wallRef: 'wall/west',
      kind: 'door' as const,
      offsetM: 2,
      widthM: 0.9,
      heightM: 2.1,
      sillM: 0,
      hinge: 'right' as const,
      swing: 'out' as const,
    }
    const next = applyCommand(project, { ...base, action: 'opening', wallRef: 'wall/west', opening: door })
    expect(
      parseProject(JSON.parse(JSON.stringify(next))).buildings[0].walls.find((w) => w.ref === 'wall/west')!.openings[0],
    ).toEqual(door)
    expect(() =>
      applyCommand(next, { ...base, action: 'opening', wallRef: 'wall/west', opening: { ...door, ref: 'overlap' } }),
    ).toThrow(/space/)
    expect(() =>
      applyCommand(next, { ...base, action: 'opening', wallRef: 'wall/west', opening: { ...door, offsetM: 0.1 } }),
    ).toThrow(/fit/)
    expect(() =>
      applyCommand(next, { ...base, action: 'opening', wallRef: 'wall/west', opening: { ...door, heightM: 4 } }),
    ).toThrow(/fit/)
    expect(
      applyCommand(next, {
        ...base,
        action: 'opening-remove',
        wallRef: 'wall/west',
        openingRef: door.ref,
      }).buildings[0].walls.find((w) => w.ref === 'wall/west')!.openings,
    ).toEqual([])
  })
  it('keeps separate wall faces and room surfaces in persistence and proposal diffs', () => {
    const finish = { ...finishFromPreset('light-wood'), rotationDegrees: 90, tileM: 0.7 }
    let next = applyCommand(project, {
      ...base,
      action: 'finish',
      targetRef: 'wall/partition',
      surface: 'left',
      finish,
    })
    next = applyCommand(next, { ...base, action: 'finish', targetRef: 'space/living', surface: 'floor', finish })
    const saved = parseProject(JSON.parse(JSON.stringify(next)))
    expect(saved.buildings[0].walls.find((w) => w.ref === 'wall/partition')!.faceFinishes).toEqual({ left: finish })
    expect(saved.buildings[0].spaces.find((r) => r.ref === 'space/living')!.floorFinish).toEqual(finish)
    expect(diffProjects(project, saved).changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ref: 'wall/partition', fields: ['faceFinishes'] }),
        expect.objectContaining({ ref: 'space/living', fields: ['floorFinish'] }),
      ]),
    )
  })
})

describe('Furniture placement and project history', () => {
  it('uses exact catalogue variants, rejects rescaling, elevation overflow and lowered ceilings', () => {
    const item = createIkeaItem('pax', base.storeyRef, { x: -3, z: 2 })
    expect(ikeaCatalog).toHaveLength(24)
    expect(() => applyCommand(project, { ...base, action: 'put', item: { ...item, widthM: 2 } })).toThrow(/dimensions/)
    expect(() => applyCommand(project, { ...base, action: 'put', item: { ...item, elevationM: 2 } })).toThrow(/taller/)
    project.buildings[0].ceilingFinishes.push({
      ref: 'ceiling/test',
      spaceRef: 'space/kitchen-studio',
      hostBoundaryRef: 'roof/main',
      elevationM: 2.45,
      thicknessM: 0.08,
    })
    expect(() => applyCommand(project, { ...base, action: 'put', item })).toThrow(/taller/)
  })
  it('accounts for rotation, elevation, rugs, doors and circulation', () => {
    const table = createIkeaItem('lack', base.storeyRef, { x: -3, z: 2 })
    const rug = createIkeaItem('lohals', base.storeyRef, table.position)
    const house = project.buildings[0]
    const floor = house.storeys[0]
    house.furniture = [table, rug]
    expect(placementWarnings(table, house, floor).filter((w) => w.kind === 'overlap')).toEqual([])
    const upper = { ...table, ref: 'upper', elevationM: 1.5 }
    house.furniture.push(upper)
    expect(placementWarnings(upper, house, floor).filter((w) => w.kind === 'overlap')).toEqual([])
    house.furniture.push({ ...table, ref: 'collision', rotationDegrees: 45 })
    expect(placementWarnings(table, house, floor).some((w) => w.kind === 'overlap')).toBe(true)
    expect(
      footprintsOverlap(
        interiorCorners(table),
        interiorCorners({ ...table, position: { x: 4, z: 2 }, rotationDegrees: 45 }),
      ),
    ).toBe(false)
    expect(
      placementWarnings({ ...table, position: { x: -0.4, z: 0 } }, house, floor).some((w) => w.kind === 'door'),
    ).toBe(true)
    const slab = house.slabs[0]
    expect(itemFitsFloor({ ...table, position: { x: 5.8, z: 4 }, rotationDegrees: 45 }, slab.footprint)).toBe(false)
  })
  it('snaps to a configurable grid and aligns furniture clear of walls', () => {
    const item = createIkeaItem('lack', base.storeyRef, { x: -3.14, z: 2.18 })
    const house = project.buildings[0]
    expect(snapFurniture(item, house, house.storeys[0], { enabled: true, gridM: 0.25, alignment: false })).toEqual({
      x: -3.25,
      z: 2.25,
    })
    expect(snapFurniture(item, house, house.storeys[0], { enabled: false, gridM: 0.25, alignment: true })).toEqual(
      item.position,
    )
  })
  it('commits groups once, restores undo/redo, rejects a whole locked batch and clears redo after a new edit', () => {
    useStudioStore.setState({ project, history: [], future: [], variants: [], proposals: [], draftChangeSets: [] })
    const first = { ...createIkeaItem('lack', base.storeyRef, { x: -3, z: 2 }), groupRef: 'group/test' }
    const second = { ...createIkeaItem('poang', base.storeyRef, { x: -4, z: 2 }), groupRef: 'group/test' }
    const store = useStudioStore.getState
    store().commitCommands([first, second].map((item) => ({ ...base, action: 'put', item })))
    expect(store().history).toHaveLength(1)
    store().undo()
    expect(store().project.buildings[0].furniture).toBeUndefined()
    store().redo()
    expect(store().project.buildings[0].furniture).toHaveLength(2)
    store().commitCommand({ ...base, action: 'lock', itemRefs: [second.ref], locked: true })
    const before = store().project
    expect(() =>
      store().commitCommands(
        [first, second].map((item) => ({
          ...base,
          action: 'put',
          item: { ...item, position: { x: item.position.x + 0.1, z: 2 } },
        })),
      ),
    ).toThrow(/Unlock/)
    expect(store().project).toBe(before)
    store().undo()
    store().commitCommand({ ...base, action: 'put', item: { ...first, rotationDegrees: 90 } })
    expect(store().future).toEqual([])
  })
  it('preserves old projects and exports dimensions, quantities and product links', () => {
    const old = parseProject(JSON.parse(JSON.stringify(project)))
    expect(old.buildings[0].furniture).toBeUndefined()
    const item = createIkeaItem('lack', base.storeyRef, { x: -3, z: 2 })
    const next = applyCommand(project, { ...base, action: 'put', item })
    const csv = furnitureCsv(next)
    expect(csv).toContain('90449905')
    expect(csv).toContain('https://www.ikea.com/pl/pl/p/')
    expect(csv).toContain('90 × 55 × 45')
    const svg = interiorPlanSvg(next.buildings[0], next.buildings[0].storeys[0])
    expect(svg).toContain('<svg')
    expect(svg).toContain('m²')
  })
})
