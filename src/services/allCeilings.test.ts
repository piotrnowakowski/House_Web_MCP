import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import original from '../../project-data/zielonki/project.json'
import originalBefore from '../../project-data/zielonki/before-ceiling-r53.json'
import front from '../../project-data/zielonki-v2/project.json'
import frontBefore from '../../project-data/zielonki-v2/before-ceiling-r71.json'
import rear from '../../project-data/zielonki-rear-carport/before-ground-reference-r131.json'
import rearBefore from '../../project-data/zielonki-rear-carport/before-ceiling-r117.json'
import bath from '../../project-data/zielonki-rear-bath-room/project.json'
import bathBefore from '../../project-data/zielonki-rear-bath-room/before-ceiling-r3.json'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { polygonBounds } from '../domain/geometry'
import { roofWings, gableRoofJunction } from '../domain/roofWings'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'

for (const [data, base] of [[original, originalBefore], [front, frontBefore], [rear, rearBefore], [bath, bathBefore]]) {
  const project = parseProject(data), before = parseProject(base)
  it(`${project.ref}: joins floors while keeping its own layout and open living/dining volume`, () => {
    const house = project.buildings[0], old = before.buildings[0]
    const slab = house.slabs.find(s => s.ref === house.storeys[1].baseSlabRef)!
    expect(slab.thicknessM).toBe(0.5)
    expect(slab.topElevationM).toBe(house.storeys[1].elevationM)
    expect(slab.topElevationM - slab.thicknessM).toBeCloseTo(house.storeys[0].elevationM + house.storeys[0].clearHeightM)
    expect(slab.holes![1]).toEqual(old.slabs[1].holes![1])
    expect(house.spaces).toEqual(old.spaces)
    expect(house.furniture).toEqual(old.furniture)
    expect(validateProject(project).filter(i => i.severity === 'error')).toEqual([])
    const ridges = house.roof.segments.filter(s => s.type === 'gable').map(s => {
      const bounds = polygonBounds(s.footprint)
      const span = s.ridgeDirection === 'z' ? bounds.maxX - bounds.minX : bounds.maxZ - bounds.minZ
      const rise = Math.tan(s.pitchDegrees * Math.PI / 180) * span / 2
      const angle = Math.atan2(rise, span / 2) * 180 / Math.PI
      expect(angle).toBeGreaterThanOrEqual(37); expect(angle).toBeLessThanOrEqual(45)
      return s.baseElevationM + rise
    })
    expect(ridges[0]).toBeCloseTo(ridges[1], 8)
    expect(roofWings(house).some(w => gableRoofJunction(house, w))).toBe(true)
  })

  it(`${project.ref}: seeds fresh saves and migrates independent deletion without closing the void`, async () => {
    globalThis.indexedDB = new IDBFactory()
    expect(await synchronizePublishedProject(before, before)).toEqual([])
    const saved = (await loadWorkspace(before.ref))!
    const removed = saved.project.buildings[0].furniture!.pop()!.ref
    await saveWorkspace(saved)
    expect(await synchronizePublishedProject(project, before)).toEqual([])
    const next = (await loadWorkspace(project.ref))!
    expect(next.project.buildings[0].slabs).toEqual(project.buildings[0].slabs)
    expect(next.project.buildings[0].furniture!.some(f => f.ref === removed)).toBe(false)
    await saveWorkspace(next)
    expect((await loadWorkspace(project.ref))!.project).toEqual(next.project)
    globalThis.indexedDB = new IDBFactory()
    await synchronizePublishedProject(project, before)
    expect((await loadWorkspace(project.ref))!.project.buildings).toEqual(project.buildings)
  })
}
