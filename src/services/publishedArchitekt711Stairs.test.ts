import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it } from 'vitest'
import data from '../../project-data/architekt-7-11-stairs-12-6/project.json'
import source from '../../project-data/architekt-7-11-stairs-12-6/source-architekt-711-r6.json'
import parent from '../../project-data/architekt-7-11/project.json'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { pointInPolygon, polygonArea } from '../domain/geometry'
import { uStairExitGuards, uStairGlassPanels, uStairHeadroom, uStairLayout, uStairOpening, uStairSurfaces } from '../domain/stairs'
import { saveWorkspace, loadWorkspace, deleteWorkspace, synchronizePublishedProject } from './persistence'
import { ARCHITEKT_711_STAIRS_REF, synchronizePublishedArchitekt711Stairs } from './publishedArchitekt711Stairs'

beforeEach(() => { globalThis.indexedDB = new IDBFactory() })

it('preserves the original r6 cabinetry, house and garden outside the stair and local slab infill', () => {
  expect(source).toEqual(parent)
  const p = parseProject(data), before = parseProject(source), actual = structuredClone(p)
  expect(p.ref).toBe(ARCHITEKT_711_STAIRS_REF)
  expect(p.buildings[0].furniture!.some(f => f.cabinetry === 'under-stair')).toBe(true)
  actual.ref = before.ref; actual.name = before.name; actual.revision = before.revision; actual.updatedAt = before.updatedAt
  actual.buildings[0].stairs = before.buildings[0].stairs
  actual.buildings[0].slabs[1].holes![0] = before.buildings[0].slabs[1].holes![0]
  actual.buildings[0].interiorSource = before.buildings[0].interiorSource
  expect(actual).toEqual(before)
})

it('reaches the kitchen front with 18 equal risers, a higher landing and headroom under the existing slab', () => {
  const p = parseProject(data), b = p.buildings[0], s = b.stairs![0], rise = 3.25
  const layout = uStairLayout(s, rise)!, surfaces = uStairSurfaces(s, rise)
  expect(layout.lowerSteps).toBe(12); expect(layout.upperSteps).toBe(6)
  expect(layout.tread).toBeCloseTo(.264); expect(layout.riser).toBeCloseTo(3.25/18)
  expect(2*layout.riser+layout.tread).toBeCloseTo(.6251111111)
  expect(layout.landingHeight).toBeCloseTo(2.1666666667)
  const heights = [...surfaces.map(t => t.top), rise].sort((a,b) => a-b)
  expect(heights).toHaveLength(18)
  heights.forEach((height,i) => expect(height).toBeCloseTo((i+1)*rise/18,10))
  expect(s.start.x+layout.upperLength).toBeCloseTo(-2.295)
  expect(s.start.x+layout.lowerLength).toBeCloseTo(-.711)
  expect(uStairHeadroom(b,s)).toBeCloseTo(2.3783333333)
  expect(validateProject(p).filter(i => i.severity === 'error')).toEqual([])
  const hole = uStairOpening(b,s)!, old = parseProject(source).buildings[0].slabs[1].holes![0]
  expect(polygonArea(old)-polygonArea(hole)).toBeCloseTo(.84*.95)
  expect(pointInPolygon({ x: -1.8, z: -1.6 },hole)).toBe(false)
  expect(pointInPolygon({ x: -1.8, z: -.6 },hole)).toBe(true)
  // Filling the whole width would put the slab directly over high lower-flight treads.
  b.slabs[1].holes![0] = [{x:-4.615,z:-.085},{x:-4.615,z:-2.085},{x:-2.295,z:-2.085},{x:-2.295,z:-.085}]
  expect(uStairHeadroom(b,s)).toBeLessThan(2.1)
  expect(validateProject(p).some(i => i.code === 'stairs.headroom')).toBe(true)
})

it('guards the notched slab edge without blocking the upper exit or following the extended lower flight into the hall', () => {
  const b = parseProject(data).buildings[0], s = b.stairs![0]
  const guards = uStairExitGuards(s,uStairOpening(b,s))
  expect(guards.some(g => Math.abs(g.start.z-.95)<1e-6 && Math.abs(g.end.z-.95)<1e-6 && Math.abs(g.end.x-g.start.x)>.83)).toBe(true)
  expect(Math.max(...guards.flatMap(g=>[g.start.x,g.end.x]))).toBeCloseTo(3.13)
  expect(guards.some(g => Math.abs(g.start.x-2.29)<1e-6 && Math.abs(g.end.x-2.29)<1e-6 && Math.min(g.start.z,g.end.z)<.95)).toBe(false)
  const legacy = parseProject(source).buildings[0], old = legacy.stairs![0]
  const prior = uStairExitGuards(old,uStairOpening(legacy,old))
  expect(prior).toHaveLength(1)
  expect(Math.abs(prior[0].end.z-prior[0].start.z)).toBeCloseTo(1.05)
})

it('keeps flight glass above every tread edge, including the first riser of each unequal flight', () => {
  const s = parseProject(data).buildings[0].stairs![0], panels = uStairGlassPanels(s,3.25)
  const surfaces = uStairSurfaces({...s,uTurn:{...s.uTurn!,entrySide:'min-z'}},3.25).slice(1)
  const heights = panels.flatMap(panel => surfaces.filter(t => t.x>=panel.x1 && t.x<=panel.x2 && Math.abs(Math.abs(t.z-panel.z)-t.depth/2)<1e-6).flatMap(t =>
    [t.x-t.width/2,t.x+t.width/2].map(x => panel.bottom1+(panel.bottom2-panel.bottom1)*(x-panel.x1)/(panel.x2-panel.x1)+panel.height-t.top)))
  expect(heights.length).toBeGreaterThan(30)
  expect(Math.min(...heights)).toBeCloseTo(.92)
  const landingRails = panels.filter(panel=>panel.x1===0)
  expect(landingRails).toHaveLength(2)
  expect(landingRails.every(panel=>panel.height===1 && panel.x2===.97)).toBe(true)
  const old = parseProject(source).buildings[0].stairs![0]
  expect(uStairGlassPanels(old,3.25).every(panel=>panel.height===1)).toBe(true)
})

it('persists the independent variant and preserves deletions and the parent during later updates', async () => {
  const original = {version:1 as const,project:parseProject(source),proposals:[],draftChangeSets:[]}
  original.project.landscape.plants.pop(); await saveWorkspace(original)
  expect(await synchronizePublishedArchitekt711Stairs()).toEqual([])
  const saved = (await loadWorkspace(ARCHITEKT_711_STAIRS_REF))!
  saved.project.landscape.plants.pop(); saved.project.buildings[0].furniture!.pop()
  await saveWorkspace(saved)
  expect(await loadWorkspace(ARCHITEKT_711_STAIRS_REF)).toEqual(saved)
  const next = parseProject(data); next.revision=2; next.name+=' updated'; next.updatedAt='2026-11-10T12:00:00.000Z'
  expect(await synchronizePublishedProject(next,parseProject(data))).toEqual([])
  const loaded = (await loadWorkspace(ARCHITEKT_711_STAIRS_REF))!
  expect(loaded.project.landscape).toEqual(saved.project.landscape)
  expect(loaded.project.buildings[0].furniture).toEqual(saved.project.buildings[0].furniture)
  expect(loaded.project.buildings[0].stairs![0].uTurn!.lowerSteps).toBe(12)
  expect(await loadWorkspace(original.project.ref)).toEqual(original)
  await deleteWorkspace(ARCHITEKT_711_STAIRS_REF); await synchronizePublishedArchitekt711Stairs()
  expect(await loadWorkspace(ARCHITEKT_711_STAIRS_REF)).toBeNull()
})
