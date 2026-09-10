import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it } from 'vitest'
import data from '../../project-data/zielonki-v2/project.json'
import source from '../../project-data/zielonki-v2/before-carport-r46.json'
import { validateProject } from '../domain/commands'
import { buildingFootprintsWorld, pointInPolygon, spaceFootprint } from '../domain/geometry'
import { parseProject } from '../domain/schema'
import { buildingCrossesAgriculturalZone, landUseAreas } from '../domain/zoning'
import { houseEnvelopeWorld, zielonkiSetbackLines } from '../domain/zielonkiPlacement'
import { useStudioStore } from '../state/store'
import { CARPORT_STUDY_REF, HOUSE_STUDY_REF, openHouseStudy } from './houseStudies'
import { listWorkspaces, loadWorkspace, saveWorkspace } from './persistence'
import { publishedProject } from './publishedProject'

beforeEach(() => { globalThis.indexedDB = new IDBFactory(); useStudioStore.getState().restoreWorkspace({ version: 1, project: structuredClone(publishedProject), proposals: [], draftChangeSets: [] }) })

it('validates room connections, openings, furnishings, canopy and roof constraints', () => {
  const project = parseProject(data)
  expect(validateProject(project).filter(i => i.severity === 'error')).toEqual([])
  const house = project.buildings[0]
  expect(house.spaces.some(s => s.usage === 'garage')).toBe(false)
  expect(house.spaces.find(s => s.ref === 'space/reference-office')?.usage).toBe('bedroom')
  expect(house.storeys[1].kneeWallHeightM).toBe(1.4)
  expect(house.roof.segments).toEqual(source.buildings[0].roof.segments)
  expect(house.roof.segments.filter(s => s.canopy?.slats)).toHaveLength(2)
  const roomArea = house.spaces.filter(s => s.baseSlabRef === 'slab/reference-ground').map(s => spaceFootprint(house, s))
  expect(roomArea).toHaveLength(4)
  expect(project.landscape.plants).toEqual(source.landscape.plants.filter(p => p.ref === 'plant/orchard-plum'))
  expect(source.landscape.plants).toHaveLength(6)
  expect(project.site.neighbors).toEqual(publishedProject.site.neighbors)
})

it('fits the complete house and carport in MNU and measures 4 m to outside house walls', () => {
  const project = parseProject(data)
  const { corner, roadNormal } = zielonkiSetbackLines(project)
  const distances = houseEnvelopeWorld(project.buildings[0]).map(p => (p.x - corner.x) * roadNormal.x + (p.z - corner.z) * roadNormal.z)
  expect(Math.min(...distances)).toBeCloseTo(4, 3)
  for (const building of project.buildings) {
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
  const a = center(house), b = center(canopy), north = project.site.northDegrees * Math.PI / 180
  expect((b.x - a.x) * Math.sin(north) + (b.z - a.z) * Math.cos(north)).toBeLessThan(0)
  expect(project.buildings[1].furniture).toHaveLength(2)
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

it('upgrades the actual existing v2 identity, preserving independent edits and both pergolas', async () => {
  const existing = parseProject(source)
  existing.buildings[0].spaces.find(s => s.ref === 'space/reference-parents')!.name = 'Our bedroom'
  await saveWorkspace({ version: 1, project: existing, proposals: [], draftChangeSets: [] })
  await openHouseStudy(CARPORT_STUDY_REF)
  const updated = useStudioStore.getState().project
  expect(updated.ref).toBe('project/zielonki-v2')
  expect(updated.name).toBe('zielonki v2')
  expect(updated.buildings[0].spaces.find(s => s.ref === 'space/reference-parents')!.name).toBe('Our bedroom')
  expect(updated.buildings[0].roof.segments.filter(s => s.canopy?.slats)).toEqual(source.buildings[0].roof.segments.filter(s => 'canopy' in s))
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
