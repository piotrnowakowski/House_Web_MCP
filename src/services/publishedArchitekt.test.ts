import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it } from 'vitest'
import data from '../../project-data/architekt/project.json'
import source from '../../project-data/architekt/source-glowny-r79.json'
import main from '../../project-data/zielonki-rear-bath-room/project.json'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { polygonArea, polygonBounds } from '../domain/geometry'
import { roomDimensions } from '../domain/roomDimensions'
import { roofWings, gableRoofJunction, gableWallsForBuilding } from '../domain/roofWings'
import { uStairHeadroom } from '../domain/stairs'
import { placementWarnings } from '../domain/interiorPlacement'
import { availableInteriorHeight, itemFitsFloor } from '../domain/interior'
import { ARCHITEKT_REF, synchronizePublishedArchitekt } from './publishedArchitekt'
import { loadWorkspace, saveWorkspace, deleteWorkspace } from './persistence'

beforeEach(() => { globalThis.indexedDB = new IDBFactory() })

it('matches the printed footprint and clear rectangular room dimensions without altering GŁÓWNY', () => {
  // The launcher rename changes only identity metadata, not the source house design.
  expect({ ...main, name: source.name, revision: source.revision, updatedAt: source.updatedAt }).toEqual(source)
  const project = parseProject(data), house = project.buildings[0]
  expect(project.ref).toBe(ARCHITEKT_REF)
  expect(project.name).toBe('architekt')
  expect(validateProject(project).filter(i => i.severity === 'error')).toEqual([])
  const bounds = polygonBounds(house.slabs[0].footprint)
  expect(bounds.maxX - bounds.minX).toBeCloseTo(10.13, 6)
  expect(bounds.maxZ - bounds.minZ).toBeCloseTo(13.21, 6)
  expect(polygonArea(house.slabs[0].footprint)).toBeCloseTo(13.21 * 10.13 - 5.57 * 2.38, 6)
  for (const [ref, width, depth] of [
    ['pantry', 3.73, 1.80], ['wc', 3.73, 2.05], ['office', 3, 3.97],
    ['child-one', 3.62, 3.45], ['child-two', 3.11, 4.80],
    ['parents', 5.10, 3.95], ['wardrobe', 1.63, 3.95], ['bathroom', 2.3, 2.55],
  ] as const) {
    const dimensions = roomDimensions(house, house.spaces.find(s => s.ref === `space/reference-${ref}`)!)
    expect(dimensions.width, ref).toBeCloseTo(width, 5)
    expect(dimensions.depth, ref).toBeCloseTo(depth, 5)
  }
  expect(house.slabs[1].holes).toHaveLength(2)
  expect(house.spaces.some(s => s.usage === 'void')).toBe(false)
  expect(uStairHeadroom(house, house.stairs![0])).toBeGreaterThan(2)
  expect(house.storeys[1].kneeWallHeightM).toBe(1.4)
  expect(house.roof.baseElevationM).toBeCloseTo(source.buildings[0].roof.baseElevationM, 8)
  for (const item of house.furniture!) {
    const storey = house.storeys.find(s => s.ref === item.storeyRef)!
    const slab = house.slabs.find(s => s.ref === storey.baseSlabRef)!
    expect(itemFitsFloor(item, slab.footprint, slab.holes), item.ref).toBe(true)
    expect(availableInteriorHeight(item, house, storey), item.ref).toBeGreaterThanOrEqual(item.heightM)
    expect(placementWarnings(item, house, storey).filter(w => w.kind !== 'circulation'), item.ref).toEqual([])
  }
  expect(project.buildings.some(b => b.ref === 'building/south-carport')).toBe(false)
  expect(project.buildings.find(b => b.ref === 'building/garden-outbuilding')).toEqual(source.buildings.find(b => b.ref === 'building/garden-outbuilding'))
})

it('recomputes symmetric compliant main slopes and recognizes the perpendicular roof junction', () => {
  const house = parseProject(data).buildings[0], wings = roofWings(house)
  expect(wings).toHaveLength(2)
  for (const wing of wings) {
    const b = polygonBounds(wing.footprint)
    const halfSpan = (wing.ridgeAxis === 'x' ? b.maxZ - b.minZ : b.maxX - b.minX) / 2
    const angle = Math.atan2(wing.ridgeElevationM - wing.baseElevationM, halfSpan) * 180 / Math.PI
    expect(angle).toBeGreaterThanOrEqual(37)
    expect(angle).toBeLessThanOrEqual(45)
  }
  expect(wings[0].ridgeElevationM).toBeCloseTo(wings[1].ridgeElevationM, 8)
  expect(gableRoofJunction(house, wings[1])?.side).toBe('min')
  expect(gableWallsForBuilding(house).some(w => w.segmentRef === wings[1].ref && w.side === 'min')).toBe(false)
})

it('adds an independent saved project and preserves existing source edits and deletions', async () => {
  const original = { version:1 as const, project:parseProject(source), proposals:[], draftChangeSets:[] }
  original.project.name = 'My independently edited GŁÓWNY'
  await saveWorkspace(original)
  expect(await synchronizePublishedArchitekt()).toEqual([])
  expect(await loadWorkspace(original.project.ref)).toEqual(original)
  const workspace = (await loadWorkspace(ARCHITEKT_REF))!
  const deleted = workspace.project.buildings[0].furniture!.pop()!.ref
  await saveWorkspace(workspace)
  expect(await synchronizePublishedArchitekt()).toEqual([])
  expect((await loadWorkspace(ARCHITEKT_REF))!.project.buildings[0].furniture!.some(i => i.ref === deleted)).toBe(false)
  await deleteWorkspace(ARCHITEKT_REF)
  await synchronizePublishedArchitekt()
  expect(await loadWorkspace(ARCHITEKT_REF)).toBeNull()
  expect(await loadWorkspace(original.project.ref)).toEqual(original)
})
