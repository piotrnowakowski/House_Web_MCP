import { expect, it } from 'vitest'
import { Matrix4, Vector3 } from 'three'
import data from '../../project-data/nowe-mpzp-v2/project.json'
import architect from '../../project-data/architekt/project.json'
import parent from '../../project-data/nowe-mpzp/project.json'
import { parseProject } from './schema'
import { gardenFixtureById, solarTableDepthM, solarTable10WidthM } from './gardenFixtures'
import { polygonArea } from './geometry'
import { sitePlanBounds, sitePlanEdges, sitePlanElements, sitePlanZoningBoundaries } from './sitePlan'
import { zielonkiZoningBoundary } from '../../knowledge-bank/zielonki/zoning'
import { draftZoningBoundary } from '../../knowledge-bank/zielonki/draftPlan'

it('compares the two source planning traces without mutating either project or cadastral geometry', () => {
  for (const source of [data, architect]) {
    const project = parseProject(source), before = structuredClone(project)
    const boundaries = sitePlanZoningBoundaries(project)
    expect(boundaries.map(z => [z.code, z.proposed])).toEqual([['06.MNU.8', false], ['18.1.MU.1', true]])
    expect(boundaries.map(z => z.points)).toEqual([zielonkiZoningBoundary, draftZoningBoundary])
    expect(boundaries.map(z => z.points.length)).toEqual([3, 2])
    expect(draftZoningBoundary[1].z).toBeGreaterThan(zielonkiZoningBoundary[2].z)
    expect(project).toEqual(before)
  }
})

it('does not draw the Zielonki planning overlay on an unrelated site with the same parcel numbers', () => {
  const project = parseProject(data)
  project.site.knowledgeBase.datasetVersion = 'custom-site'
  for (const parcel of project.site.parcels) for (const zone of parcel.landUseZones ?? []) zone.sourceRef = 'custom-zoning'
  expect(sitePlanZoningBoundaries(project)).toEqual([])
})

it('covers every outdoor object without modifying the saved project', () => {
  const project = parseProject(data), original = structuredClone(project)
  const elements = sitePlanElements(project), refs = elements.map(e => e.ref)
  expect(new Set(refs).size).toBe(refs.length)
  for (const e of [...project.site.parcels, ...project.site.entrances, ...project.site.fences!, ...project.landscape.zones, ...project.landscape.fixtures, ...project.landscape.plants]) expect(refs).toContain(e.ref)
  for (const b of project.buildings) {
    expect(refs).toContain(b.storeys[0].baseSlabRef)
    for (const roof of b.roof.segments) expect(refs).toContain(roof.ref)
    if (!b.walls.length) for (const item of b.furniture ?? []) expect(refs).toContain(item.ref)
  }
  expect(elements.filter(e => e.category === 'Okna i drzwi').length).toBeGreaterThan(10)
  expect(elements.every(e => e.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.z)))).toBe(true)
  expect(project).toEqual(original)
  for (const source of [architect, parent]) expect(() => sitePlanElements(parseProject(source))).not.toThrow()
  expect(elements.find(e => e.name.startsWith('Oczyszczalnia biologiczna'))?.heightM).toBeUndefined()
})

it('projects fixtures with the same negative Y rotation as the 3D scene', () => {
  const project = parseProject(data), elements = sitePlanElements(project)
  for (const f of project.landscape.fixtures) {
    const d = gardenFixtureById(f.catalogId), plan = elements.find(e => e.ref === f.ref)!
    const matrix = new Matrix4().makeRotationY(-f.rotationDegrees * Math.PI / 180)
    const corner = new Vector3(-d.widthM / 2, 0, -d.depthM / 2).applyMatrix4(matrix)
    expect(plan.points[0].x).toBeCloseTo(corner.x + f.position.x, 9)
    expect(plan.points[0].z).toBeCloseTo(corner.z + f.position.z, 9)
    expect(polygonArea(plan.points)).toBeCloseTo(d.widthM * d.depthM, 7)
    if (f.catalogId === 'solar-table-10') {
      const edges = sitePlanEdges(plan).map(([a, b]) => Math.hypot(b.x - a.x, b.z - a.z))
      expect(edges[0]).toBeCloseTo(solarTable10WidthM, 9)
      expect(edges[1]).toBeCloseTo(solarTableDepthM + .03, 9)
    }
  }
})

it('measures gate lengths once, every polygon edge, and the complete tree canopy', () => {
  const elements = sitePlanElements(parseProject(data))
  const gate = elements.find(e => e.ref === 'entrance/house-road')!
  expect(sitePlanEdges(gate)).toHaveLength(1)
  expect(Math.hypot(gate.points[1].x - gate.points[0].x, gate.points[1].z - gate.points[0].z)).toBeCloseTo(6.4, 5)
  const site = elements[0]
  expect(sitePlanEdges(site)).toHaveLength(site.points.length)
  expect(sitePlanEdges(site).at(-1)![1]).toEqual(site.points[0])
  const pine = elements.find(e => e.ref === 'plant/survey-5012')!, bounds = sitePlanBounds([pine])
  expect(pine.heightM).toBe(15)
  expect(bounds.maxX - bounds.minX).toBeCloseTo(5.2)
  expect(bounds.maxZ - bounds.minZ).toBeCloseTo(5.2)
  expect(sitePlanBounds(elements).maxZ).toBeGreaterThan(180)
  expect(sitePlanBounds(elements.filter(e => e.developed)).maxZ).toBeLessThan(80)
})

it('uses current geometry after moving or deleting an object, not its descriptive name', () => {
  const p = parseProject(data), f = p.landscape.fixtures[0], removed = p.landscape.plants.pop()!
  const original = sitePlanElements(p).find(e => e.ref === f.ref)!
  f.position.x += 7
  f.name = 'Dimension text in this name is deliberately wrong: 99 m'
  const elements = sitePlanElements(p), changed = elements.find(e => e.ref === f.ref)!
  expect(changed.points[0].x - original.points[0].x).toBeCloseTo(7)
  expect(changed.summary).toBe(original.summary)
  expect(elements.some(e => e.ref === removed.ref)).toBe(false)
})
