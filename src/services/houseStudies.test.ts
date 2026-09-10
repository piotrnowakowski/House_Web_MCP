import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it } from 'vitest'
import data from '../../project-data/zielonki-v2/project.json'
import beforeShortHall from '../../project-data/zielonki-v2/before-short-hall-r55.json'
import source from '../../project-data/zielonki-v2/before-carport-r46.json'
import beforeRotation from '../../project-data/zielonki-v2/before-rotation-r47.json'
import beforeTrim from '../../project-data/zielonki-v2/before-terrace-trim-r48.json'
import beforeMove from '../../project-data/zielonki-v2/before-road-carport-r49.json'
import { pergolaMembers } from '../domain/pergola'
import { validateProject } from '../domain/commands'
import { buildingFootprintsWorld, pointInPolygon, spaceFootprint } from '../domain/geometry'
import { parseProject } from '../domain/schema'
import { buildingCrossesAgriculturalZone, landUseAreas } from '../domain/zoning'
import { houseEnvelopeWorld, zielonkiSetbackLines } from '../domain/zielonkiPlacement'
import { useStudioStore } from '../state/store'
import { CARPORT_STUDY_REF, HOUSE_STUDY_REF, openHouseStudy } from './houseStudies'
import { listWorkspaces, loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'
import { publishedProject } from './publishedProject'

beforeEach(() => { globalThis.indexedDB = new IDBFactory(); useStudioStore.getState().restoreWorkspace({ version: 1, project: structuredClone(publishedProject), proposals: [], draftChangeSets: [] }) })

it('removes the front terrace and aligns the remaining paving and pergola outside face with the house', () => {
  const house = parseProject(beforeMove).buildings[0]
  const wall = house.walls.find(w => w.start.z === 8.385 && w.end.z === 8.385)!
  const outside = wall.start.z + wall.thicknessM / 2
  const pergola = house.roof.segments.find(s => s.canopy?.slats)!
  expect(house.roof.segments.some(s => s.ref === 'roof/zielonki-v2/garden-pergola')).toBe(false)
  const edge = Math.max(...pergolaMembers(pergola).map(m => m.centre.z + Math.abs(Math.sin(m.yaw)) * m.size.x / 2 + Math.abs(Math.cos(m.yaw)) * m.size.z / 2))
  expect(edge).toBeCloseTo(outside, 8)
  const angle = house.rotationDegrees * Math.PI / 180
  const terrace = beforeMove.landscape.zones.find(z => z.ref === 'zone/terrace')!
  const local = terrace.footprint.map(p => {
    const x = p.x - house.position.x, z = p.z - house.position.z
    return { x: x * Math.cos(angle) - z * Math.sin(angle), z: x * Math.sin(angle) + z * Math.cos(angle) }
  })
  expect(Math.max(...local.map(p => p.z))).toBeCloseTo(outside, 8)
  expect(Math.min(...local.map(p => p.x))).toBeCloseTo(2.185, 8)
  expect(house.position).toEqual(beforeTrim.buildings[0].position)
  expect(house.walls).toEqual(beforeTrim.buildings[0].walls)
  expect(beforeMove.buildings[1]).toEqual(beforeTrim.buildings[1])
})

it('validates room connections, openings, furnishings, canopy and roof constraints', () => {
  const project = parseProject(data)
  expect(validateProject(project).filter(i => i.severity === 'error')).toEqual([])
  const house = project.buildings[0]
  expect(house.spaces.some(s => s.usage === 'garage')).toBe(false)
  expect(house.spaces.find(s => s.ref === 'space/reference-office')?.usage).toBe('bedroom')
  expect(house.storeys[1].kneeWallHeightM).toBe(1.4)
  for (const segment of house.roof.segments.filter(s => s.type === 'gable')) {
    const original = source.buildings[0].roof.segments.find(s => s.ref === segment.ref)!
    expect(segment.pitchDegrees).toBe(original.pitchDegrees)
    expect(segment.baseElevationM).toBe(original.baseElevationM)
  }
  expect(house.roof.segments.filter(s => s.canopy?.slats)).toHaveLength(1)
  const roomArea = house.spaces.filter(s => s.baseSlabRef === 'slab/reference-ground').map(s => spaceFootprint(house, s))
  expect(roomArea).toHaveLength(4)
  expect(project.landscape.plants).toEqual(source.landscape.plants.filter(p => p.ref === 'plant/orchard-plum'))
  expect(source.landscape.plants).toHaveLength(6)
  expect(project.site.neighbors).toEqual(publishedProject.site.neighbors)
})

it('fits the shorter house and road-facing carport in MNU with the house set back 14.21 m', () => {
  const project = parseProject(data)
  const { corner, roadNormal } = zielonkiSetbackLines(project)
  const distances = houseEnvelopeWorld(project.buildings[0]).map(p => (p.x - corner.x) * roadNormal.x + (p.z - corner.z) * roadNormal.z)
  expect(Math.min(...distances)).toBeCloseTo(14.210776, 3)
  for (const building of project.buildings.filter(b => b.ref === 'house/main' || b.ref === 'building/south-carport')) {
    expect(buildingCrossesAgriculturalZone(project, building)).toBe(false)
    const zones = landUseAreas(project).filter(z => z.landRole === 'construction')
    expect(buildingFootprintsWorld(building).flat().every(p => zones.some(z => pointInPolygon(p, z.boundary)))).toBe(true)
    const angle = building.rotationDegrees * Math.PI / 180
    for (const segment of building.roof.segments) for (const p of segment.footprint) {
      const world = { x: building.position.x + p.x * Math.cos(angle) + p.z * Math.sin(angle), z: building.position.z - p.x * Math.sin(angle) + p.z * Math.cos(angle) }
      expect(zones.some(z => pointInPolygon(world, z.boundary))).toBe(true)
    }
  }
  const [house, canopy] = project.buildings.map(b => buildingFootprintsWorld(b)[0])
  const center = (points: typeof house) => points.reduce((a, p) => ({ x: a.x + p.x / points.length, z: a.z + p.z / points.length }), { x: 0, z: 0 })
  const a = center(house), b = center(canopy)
  expect((b.x - a.x) * roadNormal.x + (b.z - a.z) * roadNormal.z).toBeLessThan(-6)
  const canopyRoad = canopy.map(p => (p.x - corner.x) * roadNormal.x + (p.z - corner.z) * roadNormal.z)
  expect(Math.min(...canopyRoad)).toBeCloseTo(6.310796, 3)
  expect(project.buildings[1].furniture).toHaveLength(2)
})

it('keeps orientation and rooms, places the canopy at the road facade and reaches the mapped rear limit', () => {
  const project = parseProject(beforeShortHall), house = project.buildings[0], carport = project.buildings[1]
  expect(house.rotationDegrees).toBe(beforeMove.buildings[0].rotationDegrees)
  expect(house.walls).toEqual(beforeMove.buildings[0].walls)
  expect(house.roof).toEqual(beforeMove.buildings[0].roof)
  expect(carport.slabs).toEqual(beforeMove.buildings[1].slabs)
  expect(carport.furniture).toEqual(beforeMove.buildings[1].furniture)
  const angle = house.rotationDegrees * Math.PI / 180
  const local = buildingFootprintsWorld(carport)[0].map(p => {
    const x=p.x-house.position.x, z=p.z-house.position.z
    return { x:x*Math.cos(angle)-z*Math.sin(angle), z:x*Math.sin(angle)+z*Math.cos(angle) }
  })
  expect(Math.min(...local.map(p => p.z))).toBeCloseTo(8.485, 7)
  expect(Math.min(...local.map(p => p.x))).toBeCloseTo(-4.905, 7)
  expect(Math.max(...local.map(p => p.x))).toBeCloseTo(1.495, 7)
  const { corner, neighbourNormal, roadNormal } = zielonkiSetbackLines(project)
  const sideGap = Math.min(...houseEnvelopeWorld(house).map(p => (p.x-corner.x)*neighbourNormal.x+(p.z-corner.z)*neighbourNormal.z))
  expect(sideGap).toBeCloseTo(4, 3)
  const moved = structuredClone(house)
  moved.position.x += roadNormal.x * .5; moved.position.z += roadNormal.z * .5
  expect(buildingCrossesAgriculturalZone(project, moved)).toBe(true)
  expect(project.landscape.zones.some(z => z.ref === 'zone/zielonki-v2/pergola-paving')).toBe(false)
})

it('merges r50 into a saved r49 and preserves independent furniture deletion and room edits', async () => {
  await synchronizePublishedProject(parseProject(beforeMove), parseProject(source))
  const existing = (await loadWorkspace(CARPORT_STUDY_REF))!
  existing.project.buildings[0].spaces[0].name = 'Keep my room name'
  existing.project.buildings[1].furniture!.pop()
  await saveWorkspace(existing)
  await openHouseStudy(CARPORT_STUDY_REF)
  const merged = useStudioStore.getState().project
  expect(merged.buildings[0].position).toEqual(data.buildings[0].position)
  expect(merged.buildings[1].position).toEqual(data.buildings[1].position)
  expect(merged.buildings[0].spaces[0].name).toBe('Keep my room name')
  expect(merged.buildings[1].furniture).toHaveLength(1)
  expect(merged.landscape.zones.some(z => z.ref === 'zone/zielonki-v2/pergola-paving')).toBe(false)
  await openHouseStudy(HOUSE_STUDY_REF)
  await openHouseStudy(CARPORT_STUDY_REF)
  expect(useStudioStore.getState().project).toEqual(merged)
})

it('rotates the complete existing v2 by 180 degrees without changing rooms, roof pitch or site evidence', () => {
  for (const building of beforeTrim.buildings) {
    const previous = beforeRotation.buildings.find(b => b.ref === building.ref)!
    expect(building.rotationDegrees).toBeCloseTo((previous.rotationDegrees + 180) % 360, 9)
    const { position, rotationDegrees, name, interiorSource, ...geometry } = building
    const { position: oldPosition, rotationDegrees: oldRotation, name: oldName, interiorSource: oldSource, ...oldGeometry } = previous
    expect(geometry).toEqual(oldGeometry)
  }
  expect(data.landscape.plants).toEqual(beforeRotation.landscape.plants)
  expect(data.site.neighbors).toEqual(beforeRotation.site.neighbors)
  expect(data.site.northDegrees).toBe(beforeRotation.site.northDegrees)
})

it('merges terrace removal into a saved r48 while preserving independent edits and deletions across reload', async () => {
  await synchronizePublishedProject(parseProject(beforeTrim), parseProject(source))
  const existing = (await loadWorkspace(CARPORT_STUDY_REF))!
  existing.project.buildings[0].spaces[0].name = 'My living room'
  existing.project.buildings[1].furniture!.pop()
  existing.project.revision++
  await saveWorkspace(existing)
  await openHouseStudy(CARPORT_STUDY_REF)
  const updated = useStudioStore.getState().project
  expect(updated.buildings[0].rotationDegrees).toBe(data.buildings[0].rotationDegrees)
  expect(updated.buildings[0].position).toEqual(data.buildings[0].position)
  expect(updated.buildings[0].spaces[0].name).toBe('My living room')
  expect(updated.buildings[1].furniture).toHaveLength(1)
  expect(updated.buildings[0].roof.segments.some(s => s.ref === 'roof/zielonki-v2/garden-pergola')).toBe(false)
  await openHouseStudy(HOUSE_STUDY_REF)
  await openHouseStudy(CARPORT_STUDY_REF)
  expect(useStudioStore.getState().project).toEqual(updated)
})

it('saves both alternatives and preserves a deletion across switching, reopening and restore migrations', async () => {
  const original = structuredClone(useStudioStore.getState().project)
  original.landscape.plants.pop()
  useStudioStore.setState({ project: original })
  await openHouseStudy(CARPORT_STUDY_REF)
  expect((await loadWorkspace(HOUSE_STUDY_REF))?.project).toEqual(original)
  expect(useStudioStore.getState().project).toEqual(parseProject(data))
  const edited = structuredClone(useStudioStore.getState().project)
  edited.buildings[1].furniture!.pop()
  edited.revision++
  useStudioStore.setState({ project: edited })
  await openHouseStudy(HOUSE_STUDY_REF)
  expect(useStudioStore.getState().project).toEqual(original)
  await openHouseStudy(CARPORT_STUDY_REF)
  expect(useStudioStore.getState().project).toEqual(edited)
  expect((await loadWorkspace())?.project).toEqual(edited)
})

it('upgrades the actual existing v2 identity, preserving independent edits and the trimmed side pergola', async () => {
  const existing = parseProject(source)
  existing.buildings[0].spaces.find(s => s.ref === 'space/reference-parents')!.name = 'Our bedroom'
  await saveWorkspace({ version: 1, project: existing, proposals: [], draftChangeSets: [] })
  await openHouseStudy(CARPORT_STUDY_REF)
  const updated = useStudioStore.getState().project
  expect(updated.ref).toBe('project/zielonki-v2')
  expect(updated.name).toBe(data.name)
  expect(updated.buildings[0].spaces.find(s => s.ref === 'space/reference-parents')!.name).toBe('Our bedroom')
  expect(updated.buildings[0].roof.segments.filter(s => s.canopy?.slats)).toEqual(data.buildings[0].roof.segments.filter(s => 'canopy' in s))
  expect(updated.buildings[1].furniture).toHaveLength(2)
  expect(updated.landscape.plants).toHaveLength(1)
  expect((await listWorkspaces()).some(w => w.ref === 'project/zielonki-south-carport')).toBe(false)
  await useStudioStore.getState().openWorkspace(CARPORT_STUDY_REF)
  expect(useStudioStore.getState().project).toEqual(updated)
})

it('retains both versions when existing v2 placement conflicts with the incoming move', async () => {
  const existing = parseProject(source)
  existing.buildings[0].position.x += .25
  await saveWorkspace({ version: 1, project: existing, proposals: [], draftChangeSets: [] })
  await openHouseStudy(CARPORT_STUDY_REF)
  expect(useStudioStore.getState().project).toEqual(existing)
  expect(useStudioStore.getState().projectSyncConflicts).toContain('/buildings/house/main/position/x')
  expect((await listWorkspaces()).some(w => w.ref.startsWith('project/zielonki-v2/published-'))).toBe(true)
})
