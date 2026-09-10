import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it } from 'vitest'
import source from '../../project-data/zielonki-v2/before-road-carport-r49.json'
import data from '../../project-data/zielonki-rear-carport/project.json'
import baseline from '../../project-data/zielonki-rear-carport/initial-r49.json'
import front from '../../project-data/zielonki-v2/project.json'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { buildingFootprintsWorld, distanceToSegment } from '../domain/geometry'
import { mergeProjects } from '../domain/projectMerge'
import { publishedProject } from './publishedProject'
import { loadWorkspace, listWorkspaces, saveWorkspace } from './persistence'
import { REAR_CARPORT_STUDY_REF, synchronizePublishedRearCarport } from './publishedRearCarport'
import { groupWorkspaces } from './workspaceGroups'
import { openHouseStudy, HOUSE_STUDY_REF, CARPORT_STUDY_REF } from './houseStudies'
import { useStudioStore } from '../state/store'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  useStudioStore.setState({ project: structuredClone(publishedProject), proposals: [], draftChangeSets: [], hydrated: true })
})

it('preserves the screenshot-era baseline and fits the compact house to the rear-carport site', () => {
  expect(baseline).toEqual({ ...source, ref: REAR_CARPORT_STUDY_REF, name: 'Z garażem za domem przy sąsiadach' })
  const project = parseProject(data)
  expect(validateProject(project).filter((issue) => issue.severity === 'error')).toEqual([])
  expect(project.buildings).toHaveLength(2)
  for (const segment of project.buildings[0].roof.segments.filter((item) => item.type === 'gable')) {
    expect(segment.pitchDegrees).toBeCloseTo(40.13423424862029)
  }
  const house = project.buildings[0]
  for (const key of ['walls', 'spaces', 'furniture', 'stairs', 'slabs', 'storeys'] as const) {
    expect(house[key]).toEqual(front.buildings[0][key])
  }
  expect(project.site).toEqual(baseline.site)
  expect(project.buildings[1].slabs).toEqual(baseline.buildings[1].slabs)
  expect(project.buildings[1].furniture).toEqual(baseline.buildings[1].furniture)
  const roadStart = { x: -19.778, z: -15.1 }; const roadEnd = { x: -18.403, z: 10.53 }
  expect(Math.min(...buildingFootprintsWorld(house).flat().map((point) => distanceToSegment(point, roadStart, roadEnd)))).toBeCloseTo(4, 3)
  const divisionStart = { x: -18.403, z: 10.53 }; const divisionEnd = { x: 17.384, z: -4.833 }
  expect(Math.min(...buildingFootprintsWorld(house).flat().map((point) => distanceToSegment(point, divisionStart, divisionEnd)))).toBeCloseTo(.15, 6)
})

it('migrates r49 with independent edits and deletions and preserves conflicting wall changes', async () => {
  const local = parseProject(baseline)
  local.name = 'My rear garage'
  local.buildings[1].furniture!.pop()
  await saveWorkspace({ version: 1, project: local, proposals: [], draftChangeSets: [] })
  expect(await synchronizePublishedRearCarport()).toEqual([])
  const saved = (await loadWorkspace(REAR_CARPORT_STUDY_REF))!.project
  expect(saved.name).toBe(local.name)
  expect(saved.buildings[0].walls).toEqual(data.buildings[0].walls)
  expect(saved.buildings[1].furniture).toEqual(local.buildings[1].furniture)
  expect(saved.buildings[0].walls.flatMap((wall) => wall.openings).some((opening) => opening.ref === 'opening/reference-pantry')).toBe(false)
  expect(await synchronizePublishedRearCarport()).toEqual([])
  expect((await loadWorkspace(REAR_CARPORT_STUDY_REF))!.project).toEqual(saved)
  const editedWall = local.buildings[0].walls.find((wall) => wall.ref === 'wall/carport-layout/ground/8')!
  editedWall.start.x += .2
  const result = mergeProjects(parseProject(baseline), local, parseProject(data))
  expect(result.conflicts.some((path) => path.includes(editedWall.ref))).toBe(true)
  expect(result.project.buildings[0].walls.find((wall) => wall.ref === editedWall.ref)!.start.x).toBe(editedWall.start.x)
})

it('seeds one independent third project and preserves deletions and names across sync, switching and reload', async () => {
  await openHouseStudy(CARPORT_STUDY_REF)
  const v2 = await loadWorkspace(CARPORT_STUDY_REF)
  const original = await loadWorkspace(HOUSE_STUDY_REF)
  await openHouseStudy(REAR_CARPORT_STUDY_REF)
  expect(useStudioStore.getState().project).toEqual(parseProject(data))
  expect(await loadWorkspace(CARPORT_STUDY_REF)).toEqual(v2)
  expect(await loadWorkspace(HOUSE_STUDY_REF)).toEqual(original)
  const edited = structuredClone(useStudioStore.getState().project)
  edited.name = 'Mój garaż za domem'
  edited.buildings[1].furniture!.pop()
  edited.revision++
  useStudioStore.setState({ project: edited })
  await openHouseStudy(CARPORT_STUDY_REF)
  await openHouseStudy(REAR_CARPORT_STUDY_REF)
  expect(useStudioStore.getState().project).toEqual(edited)
  expect(await synchronizePublishedRearCarport()).toEqual([])
  expect((await loadWorkspace(REAR_CARPORT_STUDY_REF))?.project).toEqual(edited)
  const backup = { ...structuredClone(edited), ref: `${REAR_CARPORT_STUDY_REF}/before-published-51-20260910` }
  await saveWorkspace({ version: 1, project: backup, proposals: [], draftChangeSets: [] })
  const groups = groupWorkspaces(await listWorkspaces())
  expect(groups).toHaveLength(3)
  expect(groups[2]).toMatchObject({ ref: REAR_CARPORT_STUDY_REF, current: { name: edited.name }, versions: [{ ref: backup.ref }] })
})
