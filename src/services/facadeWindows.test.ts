import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import original from '../../project-data/zielonki/project.json'
import originalBase from '../../project-data/zielonki/before-facade-windows-r52.json'
import front from '../../project-data/zielonki-v2/project.json'
import frontBase from '../../project-data/zielonki-v2/before-facade-windows-r70.json'
import rear from '../../project-data/zielonki-rear-carport/project.json'
import rearBase from '../../project-data/zielonki-rear-carport/before-facade-windows-r91.json'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { gableGlazingProfile } from '../domain/gableGlazing'
import { roofSegmentRidgeElevation } from '../domain/roofs'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'

for (const [data, beforeData] of [[original, originalBase], [front, frontBase], [rear, rearBase]]) {
  it(`${data.ref}: aligns four front openings and the kitchen-bedroom composition without moving the building`, () => {
    const project = parseProject(data), before = parseProject(beforeData), b = project.buildings[0]
    expect(validateProject(project).filter(i => i.severity === 'error')).toEqual([])
    const unchanged = structuredClone(project)
    unchanged.revision = before.revision; unchanged.updatedAt = before.updatedAt
    unchanged.buildings[0].walls.forEach(w => { w.openings = before.buildings[0].walls.find(old => old.ref === w.ref)!.openings })
    unchanged.buildings[0].roof.segments.forEach(r => { r.gableGlazing = before.buildings[0].roof.segments.find(old => old.ref === r.ref)!.gableGlazing })
    expect(unchanged).toEqual(before)
    const upperRefs = ['roof/reference/rear-barn/glazing-upper', 'roof/reference/rear-barn/glazing-upper/right', 'roof/reference/front-barn/glazing-upper']
    const lowerRefs = ['opening/reference-terrace-east', 'opening/reference-terrace-east/right', 'opening/reference-terrace-north']
    const opening = (ref: string) => b.walls.flatMap(w => w.openings).find(o => o.ref === ref)!
    upperRefs.forEach((ref, i) => {
      const upper = opening(ref), lower = opening(lowerRefs[i])
      expect(upper.widthM).toBeCloseTo(lower.widthM, 7)
      expect(upper.offsetM).toBeCloseTo(lower.offsetM, 7)
      expect(upper.mullionFractions).toEqual(lower.mullionFractions)
    })
    const frontRoof = b.roof.segments.find(r => r.ref.endsWith('/rear-barn'))!
    const panels = gableGlazingProfile(frontRoof, 'max', b)!.panels
    expect(panels).toHaveLength(2)
    expect(panels[1].opening[0].x - panels[0].opening[1].x).toBeCloseTo(0.4)
    for (const panel of panels) {
      expect(panel.connected).toBe(true)
      expect(panel.opening).toHaveLength(4)
      expect(panel.opening[0].z).toBeCloseTo(4.851)
      expect(panel.mullions).toHaveLength(1)
    }
    const kitchenRoof = b.roof.segments.find(r => r.ref.endsWith('/front-barn'))!
    const kitchen = gableGlazingProfile(kitchenRoof, 'min', b)!.panels
    expect(kitchen).toHaveLength(1)
    expect(kitchen[0].connected).toBe(true)
    expect(kitchen[0].transoms).toHaveLength(2)
    expect(kitchenRoof.gableGlazing!.max).toEqual(before.buildings[0].roof.segments.find(r => r.ref === kitchenRoof.ref)!.gableGlazing!.max)
    for (const r of b.roof.segments.filter(r => r.type === 'gable')) {
      const ridge = roofSegmentRidgeElevation(r)
      const across = r.ridgeDirection === 'x' ? 'z' : 'x'
      const span = Math.max(...r.footprint.map(p => p[across])) - Math.min(...r.footprint.map(p => p[across]))
      const slope = Math.atan2(ridge - r.baseElevationM, span / 2) * 180 / Math.PI
      expect(slope).toBeGreaterThanOrEqual(37); expect(slope).toBeLessThanOrEqual(45)
      expect(ridge).toBeCloseTo(roofSegmentRidgeElevation(before.buildings[0].roof.segments.find(old => old.ref === r.ref)!), 7)
      // The original historical design already has a 12.65 mm ridge offset.
      if (data.ref !== original.ref) expect(ridge).toBeCloseTo(roofSegmentRidgeElevation(frontRoof), 7)
    }
  })

  it(`${data.ref}: preserves independent edits and deleted new windows through migration and reload`, async () => {
    globalThis.indexedDB = new IDBFactory()
    const baseline = parseProject(beforeData), published = parseProject(data)
    await synchronizePublishedProject(baseline, baseline)
    const saved = (await loadWorkspace(baseline.ref))!
    const removed = saved.project.buildings[0].furniture!.pop()!.ref
    saved.project.name = 'My window study'
    await saveWorkspace(saved)
    expect(await synchronizePublishedProject(published, baseline)).toEqual([])
    const migrated = (await loadWorkspace(baseline.ref))!
    expect(migrated.project.name).toBe('My window study')
    expect(migrated.project.buildings[0].furniture!.some(f => f.ref === removed)).toBe(false)
    const b = migrated.project.buildings[0], ref = 'roof/reference/rear-barn/glazing-upper/right'
    const wall = b.walls.find(w => w.openings.some(o => o.ref === ref))!
    wall.openings = wall.openings.filter(o => o.ref !== ref)
    await saveWorkspace(migrated)
    await synchronizePublishedProject(published, baseline)
    const reloaded = (await loadWorkspace(baseline.ref))!
    expect(reloaded.project).toEqual(migrated.project)
    expect(gableGlazingProfile(b.roof.segments.find(r => r.ref.endsWith('/rear-barn'))!, 'max', reloaded.project.buildings[0])!.panels).toHaveLength(1)
  })
}
