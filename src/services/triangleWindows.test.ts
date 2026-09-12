import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it } from 'vitest'
import original from '../../project-data/zielonki/project.json'
import front from '../../project-data/zielonki-v2/project.json'
import rear from '../../project-data/zielonki-rear-carport/project.json'
import originalBase from '../../project-data/zielonki/before-triangle-windows-r50.json'
import frontBase from '../../project-data/zielonki-v2/before-triangle-windows-r68.json'
import rearBase from '../../project-data/zielonki-rear-carport/before-triangle-windows-r89.json'
import { validateProject } from '../domain/commands'
import { gableGlazingProfile } from '../domain/gableGlazing'
import { pointInPolygon, polygonArea, polygonBounds, wallLength } from '../domain/geometry'
import { parseProject } from '../domain/schema'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'

beforeEach(() => { globalThis.indexedDB = new IDBFactory() })

for (const [data, before] of [[original, originalBase], [front, frontBase], [rear, rearBase]]) {
  it(`${data.ref}: changes only the two upper garage panes to triangles`, () => {
    const project = parseProject(data), baseline = parseProject(before)
    const building = project.buildings[0]
    const roof = building.roof.segments.find(s => s.ref.endsWith('/front-barn'))!
    const profile = gableGlazingProfile(roof, 'max', building)!
    expect(profile.panels).toHaveLength(2)
    for (const [index, panel] of profile.panels.entries()) {
      expect(panel.opening).toHaveLength(3)
      expect(polygonArea(panel.opening)).toBeGreaterThan(0)
      expect(panel.opening.every(p => pointInPolygon(p, profile.outline))).toBe(true)
      const ref = roof.gableGlazing!.max!.hostOpeningRefs![index]
      const wall = building.walls.find(w => w.openings.some(o => o.ref === ref))!
      const host = wall.openings.find(o => o.ref === ref)!
      const midpoint = wall.start.x + (wall.end.x - wall.start.x) * host.offsetM / wallLength(wall)
      const bounds = polygonBounds(panel.opening)
      expect(bounds.minX).toBeGreaterThanOrEqual(midpoint - host.widthM / 2 - 1e-8)
      expect(bounds.maxX).toBeLessThanOrEqual(midpoint + host.widthM / 2 + 1e-8)
      expect(bounds.maxX - bounds.minX).toBeGreaterThan(1.7)
      // Mullions must terminate on the triangle's diagonal, not the former trapezoid's top.
      for (const mullion of panel.mullions) {
        const bounds = polygonBounds(panel.opening)
        expect(mullion.top).toBeCloseTo(bounds.minZ + (bounds.maxZ - bounds.minZ) / 2)
      }
    }
    expect(profile.panels[0].opening[2].x).toBe(profile.panels[0].opening[1].x)
    expect(profile.panels[1].opening[2].x).toBe(profile.panels[1].opening[0].x)
    expect(validateProject(project).filter(i => i.severity === 'error')).toEqual([])
    delete roof.gableGlazing!.max!.shape
    project.revision = baseline.revision
    project.updatedAt = baseline.updatedAt
    expect(project).toEqual(baseline)
  })

  it(`${data.ref}: loads fresh and migrates saved panes without restoring deleted doors or furnishings`, async () => {
    const published = parseProject(data), baseline = parseProject(before)
    expect(await synchronizePublishedProject(published, baseline)).toEqual([])
    expect((await loadWorkspace(published.ref))!.project).toEqual(published)
    globalThis.indexedDB = new IDBFactory()
    await synchronizePublishedProject(baseline, baseline)
    const workspace = (await loadWorkspace(baseline.ref))!
    workspace.project.name = 'My retained variant name'
    const building = workspace.project.buildings[0]
    const hostRef = 'opening/reference-children-west-window'
    const wall = building.walls.find(w => w.openings.some(o => o.ref === hostRef))!
    wall.openings = wall.openings.filter(o => o.ref !== hostRef)
    const removed = building.furniture!.pop()!.ref
    await saveWorkspace(workspace)
    expect(await synchronizePublishedProject(published, baseline)).toEqual([])
    const migrated = (await loadWorkspace(baseline.ref))!
    expect(migrated.project.name).toBe(workspace.project.name)
    const house = migrated.project.buildings[0]
    const roof = house.roof.segments.find(s => s.ref.endsWith('/front-barn'))!
    expect(roof.gableGlazing!.max!.shape).toBe('triangle')
    expect(gableGlazingProfile(roof, 'max', house)!.panels).toHaveLength(1)
    expect(house.furniture!.some(f => f.ref === removed)).toBe(false)
    await saveWorkspace(migrated)
    expect(await synchronizePublishedProject(published, baseline)).toEqual([])
    expect((await loadWorkspace(baseline.ref))!.project).toEqual(migrated.project)
  })
}
