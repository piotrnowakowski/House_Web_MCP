// Pin the ceiling-only historical layout; later bathroom edits are covered by mainBathroom.test.ts.
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import data from '../../project-data/zielonki-rear-bath-room/before-ground-bathroom-b-r7.json'
import previous from '../../project-data/zielonki-rear-bath-room/before-ceiling-r3.json'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { polygonBounds } from '../domain/geometry'
import { gableRoofJunction, roofWings } from '../domain/roofWings'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'

const project = parseProject(data), before = parseProject(previous)
const house = project.buildings[0], old = before.buildings[0]

it('joins floors with 50 cm concrete while retaining clear height, windows and both voids', () => {
  const slab = house.slabs.find(s => s.ref === 'slab/reference-upper')!
  expect(slab.thicknessM).toBe(0.5)
  expect(slab.topElevationM).toBe(house.storeys[1].elevationM)
  expect(slab.topElevationM - slab.thicknessM).toBeCloseTo(house.storeys[0].elevationM + house.storeys[0].clearHeightM)
  expect(slab.holes![1]).toEqual(old.slabs[1].holes![1])
  expect(slab.footprint).toEqual(old.slabs[1].footprint)
  expect(house.walls.filter(w => house.storeys[0].wallRefs.includes(w.ref))).toEqual(old.walls.filter(w => old.storeys[0].wallRefs.includes(w.ref)))
  expect(house.furniture).toEqual(old.furniture)
  expect(validateProject(project).filter(i => i.severity === 'error')).toEqual([])
})

it('keeps symmetric compliant slopes and a recognized equal-height ridge junction', () => {
  const ridges = house.roof.segments.filter(s => s.type === 'gable').map(s => {
    const b = polygonBounds(s.footprint), span = s.ridgeDirection === 'z' ? b.maxX - b.minX : b.maxZ - b.minZ
    const rise = Math.tan(s.pitchDegrees * Math.PI / 180) * span / 2
    for (const halfSpan of [span / 2, span / 2]) {
      const angle = Math.atan2(rise, halfSpan) * 180 / Math.PI
      expect(angle).toBeGreaterThanOrEqual(37); expect(angle).toBeLessThanOrEqual(45)
    }
    return s.baseElevationM + rise
  })
  expect(ridges[0]).toBeCloseTo(ridges[1], 8)
  expect(ridges[0]).toBeCloseTo(8.085693875413504, 8)
  const wings = roofWings(house)
  expect(wings.some(wing => gableRoofJunction(house, wing))).toBe(true)
})

it('migrates existing saves, retains independent deletions and persists the open void', async () => {
  globalThis.indexedDB = new IDBFactory()
  await synchronizePublishedProject(before, before)
  const saved = (await loadWorkspace(before.ref))!
  const deleted = saved.project.buildings[0].furniture!.pop()!.ref
  await saveWorkspace(saved)
  await synchronizePublishedProject(project, before)
  const after = (await loadWorkspace(project.ref))!
  expect(after.project.buildings[0].slabs).toEqual(house.slabs)
  expect(after.project.buildings[0].furniture!.some(f => f.ref === deleted)).toBe(false)
  await saveWorkspace(after)
  expect((await loadWorkspace(project.ref))!.project).toEqual(after.project)
})
