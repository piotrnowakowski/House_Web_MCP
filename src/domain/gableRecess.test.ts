import { describe, expect, it } from 'vitest'
import project from '../../project-data/zielonki-rear-bath-room/project.json'
import baseline from '../../project-data/zielonki-rear-bath-room/before-dark-side-r2.json'
import { parseProject } from './schema'
import { gableFrameBottom, recessSideLayout } from './gableRecess'
import { mergeProjects } from './projectMerge'
import { IDBFactory } from 'fake-indexeddb'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from '../services/persistence'

describe('recessed facade lining', () => {
  const building = parseProject(project).buildings[0]
  const segment = building.roof.segments[0]
  it('covers both staggered wall ends with one edge and non-coplanar faces', () => {
    const panel = recessSideLayout(building, segment, 'max')
    expect(panel.inner).toBeCloseTo(4.395)
    expect(panel.edge).toBeCloseTo(5.585)
    expect(panel.depth).toBeCloseTo(1.19)
    expect(panel.thickness / 2).toBeGreaterThan(.1)
    expect(gableFrameBottom(segment, 'max', 3.45)).toBe(.45)
    expect(gableFrameBottom(segment, 'min', 3.45)).toBe(3.45)
  })
  it('works when the recess faces the opposite direction or the z axis', () => {
    const mirrored = structuredClone(building)
    mirrored.walls.forEach(w => { w.start.x *= -1; w.end.x *= -1 })
    const roof = mirrored.roof.segments[0]
    roof.footprint.forEach(p => { p.x *= -1 })
    roof.gableRecess = { min: roof.gableRecess!.max }
    expect(recessSideLayout(mirrored, roof, 'min').inner).toBeCloseTo(-4.395)
    mirrored.walls.forEach(w => { [w.start.x, w.start.z] = [w.start.z, w.start.x]; [w.end.x, w.end.z] = [w.end.z, w.end.x] })
    roof.footprint.forEach(p => { [p.x, p.z] = [p.z, p.x] })
    roof.ridgeDirection = 'z'
    expect(recessSideLayout(mirrored, roof, 'min').inner).toBeCloseTo(-4.395)
  })
  it('preserves roof geometry, deck colour and independent deletions during colour migration', () => {
    const before = parseProject(baseline); const incoming = structuredClone(before)
    incoming.revision++
    incoming.buildings[0].roof.segments[0].gableRecess!.max!.sideColorHex = '#65432E'
    expect(segment.gableRecess!.max!.sideColorHex).toBe('#65432E')
    const local = structuredClone(before)
    const deletedRef = local.buildings[0].furniture!.pop()!.ref
    const merged = mergeProjects(before, local, incoming)
    expect(merged.conflicts).toEqual([])
    expect(merged.project.buildings[0].furniture!.some(f => f.ref === deletedRef)).toBe(false)
    const recess = merged.project.buildings[0].roof.segments[0].gableRecess!.max!
    expect(recess.sideColorHex).toBe('#65432E')
    expect(recess.soffitColorHex).toBe('#B78F60')
    const roof = structuredClone(incoming.buildings[0].roof)
    delete roof.segments[0].gableRecess!.max!.sideColorHex
    expect(roof).toEqual(before.buildings[0].roof)
  })
  it('persists the new finish and a user deletion through synchronization and reload', async () => {
    globalThis.indexedDB = new IDBFactory()
    const before = parseProject(baseline); const incoming = structuredClone(before)
    incoming.revision++
    incoming.buildings[0].roof.segments[0].gableRecess!.max!.sideColorHex = '#65432E'
    await synchronizePublishedProject(before, before)
    const workspace = (await loadWorkspace(before.ref))!
    const deleted = workspace.project.buildings[0].furniture!.pop()!.ref
    await saveWorkspace(workspace)
    expect(await synchronizePublishedProject(incoming, before)).toEqual([])
    await synchronizePublishedProject(incoming, before)
    const loaded = (await loadWorkspace(before.ref))!.project
    expect(loaded.buildings[0].furniture!.some(f => f.ref === deleted)).toBe(false)
    expect(loaded.buildings[0].roof.segments[0].gableRecess!.max!.sideColorHex).toBe('#65432E')
  })
})
