import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import data from '../../project-data/nowe-mpzp/project.json'
import previous from '../../project-data/nowe-mpzp/before-fence-r16.json'
import beforeExtension from '../../project-data/nowe-mpzp/before-fence-extend-r17.json'
import afterExtension from '../../project-data/nowe-mpzp/before-path-removal-r18.json'
import { parseProject } from '../domain/schema'
import { distanceToSegment, pointInPolygon, polygonArea } from '../domain/geometry'
import { diffProjects } from '../domain/diff'
import { mergeProjects } from '../domain/projectMerge'
import { fenceGeometry } from '../scene/fenceGeometry'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'

it('encloses the complete wide garden with two clear gates and the requested materials, preserving the whole design', () => {
  const p = parseProject(data), old = parseProject(previous), fences = p.site.fences!
  expect(p.buildings).toEqual(old.buildings)
  expect(afterExtension.landscape).toEqual(old.landscape)
  expect(p.site.boundary).toEqual(old.site.boundary)
  expect(p.site.parcels).toEqual(old.site.parcels)
  expect(p.site.entrances[0]).toEqual({ ...old.site.entrances[0], gate: { heightM: 1.8, colorHex: '#15191A' } })
  const gates = p.site.entrances.map(e => ({ start: e.end, end: e.start }))
  const edges = [...fences, ...gates], ordered = [edges[0]], remaining = edges.slice(1)
  while (remaining.length) {
    const end = ordered.at(-1)!.end
    const index = remaining.findIndex(e => Math.hypot(e.start.x - end.x, e.start.z - end.z) < 1e-7)
    expect(index).toBeGreaterThanOrEqual(0)
    ordered.push(remaining.splice(index, 1)[0])
  }
  expect(ordered.at(-1)!.end.x).toBeCloseTo(ordered[0].start.x, 8)
  expect(ordered.at(-1)!.end.z).toBeCloseTo(ordered[0].start.z, 8)
  expect(polygonArea(ordered.map(e => e.start))).toBeCloseTo(3189.4703984845, 7)
  expect(Math.max(...ordered.map(e => e.start.z))).toBe(69.05)
  const before = parseProject(beforeExtension)
  expect(p.site.entrances).toEqual(before.site.entrances)
  expect(fences.map(f => f.ref)).toEqual(before.site.fences!.map(f => f.ref))
  expect(diffProjects(before, p).changes.filter(c => c.kind === 'fence').map(c => c.ref)).toEqual([
    'fence/nowe-mpzp/4-1', 'fence/nowe-mpzp/5-1', 'fence/nowe-mpzp/6-1',
  ])
  const deletedRear = structuredClone(before)
  deletedRear.site.fences = deletedRear.site.fences!.filter(f => f.ref !== 'fence/nowe-mpzp/5-1')
  const merged = mergeProjects(before, deletedRear, p)
  expect(merged.conflicts).toContain('/site/fences/fence/nowe-mpzp/5-1')
  expect(merged.project.site.fences!.some(f => f.ref === 'fence/nowe-mpzp/5-1')).toBe(false)
  for (const f of fences) {
    const mid = { x: (f.start.x + f.end.x) / 2, z: (f.start.z + f.end.z) / 2 }
    expect(f.material).toBe(mid.z < -14.5 || (mid.x < -17 && mid.z < 18) ? 'concrete' : 'panel')
    expect(f.colorHex).toBe('#15191A')
    expect(f.heightM).toBe(1.8)
    const length = Math.hypot(f.end.x - f.start.x, f.end.z - f.start.z)
    expect(pointInPolygon({ x: mid.x - (f.end.z - f.start.z) / length * 0.1, z: mid.z + (f.end.x - f.start.x) / length * 0.1 }, p.site.boundary)).toBe(true)
    for (const e of gates) expect(distanceToSegment({ x: (e.start.x + e.end.x) / 2, z: (e.start.z + e.end.z) / 2 }, f.start, f.end)).toBeGreaterThan(1.99)
  }
  expect(Math.hypot(gates[1].end.x - gates[1].start.x, gates[1].end.z - gates[1].start.z)).toBe(4)
  expect(gates[1].start.z).toBeLessThan(Math.max(...ordered.map(e => e.start.z)))
  expect(diffProjects(old, p).changes.filter(c => c.kind === 'fence')).toHaveLength(fences.length)
})

it('rejects invalid fence dimensions and duplicate refs; generates finite solid, mesh and gate geometry', () => {
  for (const change of [{ heightM: -1 }, { colorHex: 'red' }, { end: data.site.fences[0].start }, { end: { x: 1e300, z: 0 } }]) {
    const p = structuredClone(data); Object.assign(p.site.fences[0], change)
    expect(() => parseProject(p)).toThrow()
  }
  const duplicate = structuredClone(data); duplicate.site.fences.push(duplicate.site.fences[0])
  expect(() => parseProject(duplicate)).toThrow()
  const wideGate = structuredClone(data); wideGate.site.entrances[0].end.x = 1000
  expect(() => parseProject(wideGate)).toThrow()
  for (const material of ['concrete', 'panel', 'gate'] as const) for(const width of [1.2,4]) {
    const geometry = fenceGeometry(width, 1.8, material)
    expect([...geometry.getAttribute('position').array].every(Number.isFinite)).toBe(true)
    geometry.computeBoundingBox()
    expect(geometry.boundingBox!.min.z).toBeGreaterThanOrEqual(-1e-7)
    expect(geometry.boundingBox!.max.y).toBeCloseTo(1.8)
    if(material==='gate'){
      expect(geometry.boundingBox!.min.x).toBeCloseTo(-width/2-.1)
      expect(geometry.boundingBox!.max.x).toBeCloseTo(width/2+.1)
    }
    geometry.dispose()
  }
})

it('retains fence deletion and independent edits through merge and save/reload', async () => {
  globalThis.indexedDB = new IDBFactory()
  const base = parseProject(data), local = structuredClone(base), incoming = structuredClone(base)
  const deleted = local.site.fences!.shift()!
  local.site.fences![0].heightM = 1.6
  incoming.site.fences!.at(-1)!.colorHex = '#222222'
  incoming.revision++
  const merged = mergeProjects(base, local, incoming)
  expect(merged.conflicts).toEqual([])
  expect(merged.project.site.fences!.some(f => f.ref === deleted.ref)).toBe(false)
  expect(merged.project.site.fences![0].heightM).toBe(1.6)
  await synchronizePublishedProject(base, parseProject(previous))
  const workspace = (await loadWorkspace(base.ref))!
  workspace.project = local
  await saveWorkspace(workspace)
  await synchronizePublishedProject(incoming, parseProject(previous))
  const saved = (await loadWorkspace(base.ref))!.project
  expect(saved.site.fences).toEqual(merged.project.site.fences)
  const conflictIncoming = structuredClone(base); conflictIncoming.site.fences![0].heightM = 2
  const conflict = mergeProjects(base, local, conflictIncoming)
  expect(conflict.conflicts.length).toBeGreaterThan(0)
  expect(conflict.project.site.fences!.some(f => f.ref === deleted.ref)).toBe(false)
})
