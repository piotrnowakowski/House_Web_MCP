import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it } from 'vitest'
import source from '../../project-data/zielonki-v2/before-road-carport-r49.json'
import data from '../../project-data/zielonki-rear-carport/project.json'
import baseline from '../../project-data/zielonki-rear-carport/initial-r49.json'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
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

it('copies the screenshot-era r49 exactly apart from the independent project ref and name', () => {
  expect(data).toEqual({ ...source, ref: REAR_CARPORT_STUDY_REF, name: 'Z garażem za domem przy sąsiadach' })
  expect(data).toEqual(baseline)
  const project = parseProject(data)
  expect(validateProject(project).filter((issue) => issue.severity === 'error')).toEqual([])
  expect(project.buildings).toHaveLength(2)
  for (const segment of project.buildings[0].roof.segments.filter((item) => item.type === 'gable')) {
    expect(segment.pitchDegrees).toBeCloseTo(40.13423424862029)
  }
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
