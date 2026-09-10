import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it } from 'vitest'
import data from '../../project-data/zielonki-v2/project.json'
import beforeShortHall from '../../project-data/zielonki-v2/before-short-hall-r55.json'
import before from '../../project-data/zielonki-v2/before-outbuilding-r50.json'
import beforeCompact from '../../project-data/zielonki-v2/before-compact-outbuilding-r51.json'
import beforeWide from '../../project-data/zielonki-v2/before-wide-site-outbuilding-r53.json'
import { validateProject } from '../domain/commands'
import { buildingFootprintsWorld, pointInPolygon, pointOnPolygonBoundary, polygonArea, polygonBounds, polygonCentroid, spaceFootprint } from '../domain/geometry'
import { itemFitsFloor } from '../domain/interior'
import { parseProject } from '../domain/schema'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'

beforeEach(() => { globalThis.indexedDB = new IDBFactory() })

it('adds a complete outbuilding by the field entrance while preserving the existing house and deletions', () => {
  const project = parseProject(data), baseline = parseProject(before)
  expect(beforeShortHall.buildings.slice(0, 2)).toEqual(baseline.buildings)
  expect(project.buildings[1]).toEqual(baseline.buildings[1])
  expect(project.site).toEqual(baseline.site)
  expect(project.landscape.plants).toEqual(baseline.landscape.plants)
  expect(project.landscape.fixtures.slice(0, baseline.landscape.fixtures.length)).toEqual(baseline.landscape.fixtures)
  const building = project.buildings.find(b => b.ref === 'building/garden-outbuilding')!
  expect(buildingFootprintsWorld(building).flat().every(p => pointInPolygon(p, project.site.boundary))).toBe(true)
  expect(building.spaces.map(s => s.usage)).toEqual(['garage', 'workshop', 'sauna', 'bathroom'])
  expect(polygonArea(spaceFootprint(building, building.spaces[0]))).toBeCloseTo(49.3)
  expect(polygonArea(building.slabs[0].footprint)).toBeCloseTo(99.3476)
  // The field road follows z; the extended long axis still runs perpendicular to it.
  expect(building.rotationDegrees).toBe(90)
  expect(building.roof.type).toBe('gable')
  expect(building.roof.segments[0].pitchDegrees).toBe(37)
  expect(building.roof.baseElevationM).toBeLessThan(4)
  const camper = building.furniture!.find(i => i.catalogId === 'camper')!
  const gate = building.walls.flatMap(w => w.openings).find(o => o.ref === 'opening/outbuilding/camper-gate')!
  expect(gate.widthM - camper.widthM).toBeGreaterThan(.6)
  expect(gate.heightM - camper.heightM).toBeGreaterThan(.25)
  const terrace = project.landscape.zones.find(z => z.ref === 'zone/outbuilding/terrace')!
  expect(polygonArea(terrace.footprint)).toBeCloseTo(81.92)
  const house = project.buildings[0].position, terraceCentre = polygonCentroid(terrace.footprint)
  expect(Math.hypot(terraceCentre.x - house.x, terraceCentre.z - house.z)).toBeLessThan(Math.hypot(building.position.x - house.x, building.position.z - house.z))
  const car = building.furniture!.find(i => i.ref === 'interior/outbuilding/car')!
  const garage = spaceFootprint(building, building.spaces[0])
  expect(itemFitsFloor(camper, garage)).toBe(true)
  expect(itemFitsFloor(car, garage)).toBe(true)
  expect(camper.position.z - camper.depthM / 2 - (car.position.z + car.depthM / 2)).toBeCloseTo(.4)
  const gateWall = building.walls.find(w => w.ref === gate.wallRef)!
  expect(gateWall.start.z).toBe(polygonBounds(garage).minZ)
  expect(project.landscape.fixtures.filter(f => f.ref.startsWith('fixture/outbuilding/')).every(f => pointInPolygon(f.position, terrace.footprint))).toBe(true)
  expect(validateProject(project).filter(i => i.severity === 'error')).toEqual([])
  expect(validateProject(project)).toContainEqual(expect.objectContaining({ code: 'building.site', severity: 'warning', subjectRef: building.ref }))
  delete building.designStatus
  expect(validateProject(project)).toContainEqual(expect.objectContaining({ code: 'building.site', severity: 'error', subjectRef: building.ref }))
  building.designStatus = 'concept'
  building.position.x = -100
  expect(validateProject(project)).toContainEqual(expect.objectContaining({ code: 'building.site', severity: 'error', subjectRef: building.ref }))
})

it('migrates the larger outbuilding by ref without restoring deleted furniture or losing independent finishes', async () => {
  const baseline = parseProject(beforeWide), incoming = parseProject(data)
  await synchronizePublishedProject(baseline, baseline)
  const workspace = (await loadWorkspace(baseline.ref))!
  const removed = workspace.project.buildings[1].furniture!.pop()!.ref
  workspace.project.buildings[2].furniture!.find(i => i.ref === 'interior/outbuilding/workbench')!.color = '#123456'
  await saveWorkspace(workspace)
  expect(await synchronizePublishedProject(incoming, baseline)).toEqual([])
  const saved = (await loadWorkspace(baseline.ref))!.project
  expect(saved.buildings[2].rotationDegrees).toBe(90)
  expect(polygonArea(saved.buildings[2].slabs[0].footprint)).toBeCloseTo(99.3476)
  expect(saved.buildings[2].furniture!.find(i => i.ref === 'interior/outbuilding/workbench')!.color).toBe('#123456')
  expect(saved.buildings[2].spaces.some(s => s.ref === 'space/outbuilding/relax')).toBe(false)
  expect(saved.buildings[1].furniture!.some(f => f.ref === removed)).toBe(false)
})

it('keeps the building and relaxation area inside the wide site with a margin before its neck', () => {
  const project = parseProject(data), baseline = parseProject(beforeWide)
  const building = project.buildings[2], previous = baseline.buildings[2]
  const wideEnd = 69.05
  const bounds = polygonBounds(buildingFootprintsWorld(building).flat())
  expect(wideEnd - bounds.maxZ - building.roof.overhangM).toBeGreaterThan(10)
  for (const zone of project.landscape.zones.filter(z => ['zone/outbuilding/terrace', 'zone/outbuilding/workshop-path'].includes(z.ref))) {
    expect(zone.footprint.every(p => p.z < wideEnd && pointInPolygon(p, project.site.boundary))).toBe(true)
  }
  expect(building.position.z).toBeCloseTo(previous.position.z - 10)
  expect({ ...building, position: previous.position, interiorSource: previous.interiorSource }).toEqual(previous)
  const entrance = project.site.entrances.find(e => e.ref === 'entrance/field-road')!
  const access = project.landscape.zones.find(z => z.ref === 'zone/outbuilding/apron')!
  expect([entrance.start, entrance.end].every(p => pointOnPolygonBoundary(p, access.footprint))).toBe(true)
})

it('reports a conflict when the moved jacuzzi was independently deleted', async () => {
  const baseline = parseProject(beforeCompact)
  await synchronizePublishedProject(baseline, baseline)
  const workspace = (await loadWorkspace(baseline.ref))!
  workspace.project.landscape.fixtures = workspace.project.landscape.fixtures.filter(f => f.ref !== 'fixture/outbuilding/spa')
  await saveWorkspace(workspace)
  expect(await synchronizePublishedProject(parseProject(data), baseline)).toContain('/landscape/fixtures/fixture/outbuilding/spa')
  expect((await loadWorkspace(baseline.ref))!.project).toEqual(workspace.project)
})

it('merges into an existing v2, retains furniture deletion and room edits, and saves the same identity', async () => {
  const baseline = parseProject(before), incoming = parseProject(data)
  await synchronizePublishedProject(baseline, baseline)
  const workspace = (await loadWorkspace(baseline.ref))!
  const removed = workspace.project.buildings[1].furniture!.pop()!.ref
  workspace.project.buildings[0].spaces[0].name = 'My retained room'
  await saveWorkspace(workspace)
  expect(await synchronizePublishedProject(incoming, baseline)).toEqual([])
  const saved = (await loadWorkspace(baseline.ref))!
  expect(saved.project.ref).toBe('project/zielonki-v2')
  expect(saved.project.buildings).toHaveLength(3)
  expect(saved.project.buildings[1].furniture!.some(i => i.ref === removed)).toBe(false)
  expect(saved.project.buildings[0].spaces[0].name).toBe('My retained room')
  saved.project.landscape.fixtures = saved.project.landscape.fixtures.filter(f => f.catalogId !== 'jacuzzi')
  await saveWorkspace(saved)
  expect(await synchronizePublishedProject(incoming, baseline)).toEqual([])
  expect((await loadWorkspace(baseline.ref))!.project.landscape.fixtures.some(f => f.catalogId === 'jacuzzi')).toBe(false)
})

it('does not overwrite a conflicting outbuilding location', async () => {
  const incoming = parseProject(data)
  await synchronizePublishedProject(incoming, incoming)
  const saved = (await loadWorkspace(incoming.ref))!
  saved.project.buildings[2].position.z -= 1
  await saveWorkspace(saved)
  const update = structuredClone(incoming)
  update.revision += 1
  update.buildings[2].position.z -= 2
  expect(await synchronizePublishedProject(update, incoming)).not.toEqual([])
  expect((await loadWorkspace(incoming.ref))!.project).toEqual(saved.project)
})
