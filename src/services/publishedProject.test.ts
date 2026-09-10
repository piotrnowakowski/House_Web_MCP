import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it } from 'vitest'
import { mergeProjects } from '../domain/projectMerge'
import { validateProject } from '../domain/commands'
import { parseProject } from '../domain/schema'
import { legacyProjectBase, publishedProject } from './publishedProject'
import { listWorkspaces, loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'
import { useStudioStore } from '../state/store'
import type { ProjectV2 } from '../domain/types'

const envelope = (project: ProjectV2) => ({ version: 1 as const, project, proposals: [], draftChangeSets: [] })
beforeEach(() => { globalThis.indexedDB = new IDBFactory() })

it('publishes the recovered geometry, six surviving plants and the adjusted roof', () => {
  expect(parseProject(publishedProject)).toEqual(publishedProject)
  expect(validateProject(publishedProject).filter((issue) => issue.severity === 'error')).toEqual([])
  expect(publishedProject.revision).toBe(45)
  expect(publishedProject.landscape.plants.map((plant) => plant.ref)).toEqual([
    'plant/survey-5012', 'plant/survey-5015', 'plant/survey-5018', 'plant/survey-501b', 'plant/apple', 'plant/orchard-plum',
  ])
  expect(publishedProject.buildings[0].roof.pitchDegrees).toBeCloseTo(40.13423424862029)
})

it('seeds a fresh browser and survives opening and saving with current migrations', async () => {
  expect(await synchronizePublishedProject(publishedProject, legacyProjectBase)).toEqual([])
  await useStudioStore.getState().openWorkspace(publishedProject.ref)
  const loaded = useStudioStore.getState().project
  expect(loaded.landscape.plants).toEqual(publishedProject.landscape.plants)
  expect(loaded.buildings).toEqual(publishedProject.buildings)
  await saveWorkspace(envelope(loaded))
  expect((await loadWorkspace())?.project).toEqual(loaded)
})

it('merges deletions into old browser data with a backup and preserves independent edits', async () => {
  const local = structuredClone(legacyProjectBase)
  local.buildings[0].name = 'My house name'
  local.landscape.plants.find((plant) => plant.ref === 'plant/apple')!.matureHeightM = 12
  local.landscape.plants.reverse()
  await saveWorkspace(envelope(local))
  expect(await synchronizePublishedProject(publishedProject, legacyProjectBase)).toEqual([])
  const result = (await loadWorkspace(local.ref))!.project
  expect(result.landscape.plants).toHaveLength(6)
  expect(result.landscape.plants.find((plant) => plant.ref === 'plant/apple')!.matureHeightM).toBe(12)
  expect(result.buildings[0].name).toBe('My house name')
  expect(result.buildings[0].roof.pitchDegrees).toBe(publishedProject.buildings[0].roof.pitchDegrees)
  const backup = (await listWorkspaces()).find((item) => item.ref.includes('/before-published-'))!
  expect((await loadWorkspace(backup.ref))!.project.landscape.plants).toHaveLength(20)
  expect(await synchronizePublishedProject(publishedProject, legacyProjectBase)).toEqual([])
  expect((await loadWorkspace(local.ref))!.project).toEqual(result)
})

it('retains newer local deletions across subsequent published changes and does not recreate objects', async () => {
  await synchronizePublishedProject(publishedProject, legacyProjectBase)
  const local = structuredClone(publishedProject)
  local.landscape.plants.pop()
  await saveWorkspace(envelope(local))
  const incoming = structuredClone(publishedProject)
  incoming.name += ' updated'
  incoming.revision++
  expect(await synchronizePublishedProject(incoming, legacyProjectBase)).toEqual([])
  expect((await loadWorkspace(local.ref))!.project.landscape.plants).toHaveLength(5)
  expect((await loadWorkspace(local.ref))!.project.name).toBe(incoming.name)
})

it('preserves both whole projects on edit/delete and same-field conflicts, including edited published copies', async () => {
  const local = structuredClone(legacyProjectBase)
  local.landscape.plants.find((plant) => plant.ref === 'plant/survey-5024')!.matureHeightM = 10
  local.buildings[0].roof.pitchDegrees = 39
  await saveWorkspace(envelope(local))
  const conflicts = await synchronizePublishedProject(publishedProject, legacyProjectBase)
  expect(conflicts).toContain('/landscape/plants/plant/survey-5024')
  expect(conflicts).toContain('/buildings/house/main/roof/pitchDegrees')
  expect((await loadWorkspace(local.ref))!.project).toEqual(local)
  const copy = (await listWorkspaces()).find((item) => item.ref.includes('/published-'))!
  const workspace = (await loadWorkspace(copy.ref))!
  expect(workspace.project.landscape.plants).toHaveLength(6)
  workspace.project.name = 'Edited published alternative'
  await saveWorkspace(workspace)
  await synchronizePublishedProject(publishedProject, legacyProjectBase)
  expect((await loadWorkspace(copy.ref))!.project.name).toBe(workspace.project.name)
})

it('rejects an invalid published snapshot without modifying the working copy', async () => {
  await synchronizePublishedProject(publishedProject, legacyProjectBase)
  const invalid = structuredClone(publishedProject)
  invalid.site.boundary = [{ x: 0, z: 0 }, { x: 2, z: 2 }, { x: 0, z: 2 }, { x: 2, z: 0 }]
  invalid.revision++
  await expect(synchronizePublishedProject(invalid, legacyProjectBase)).rejects.toThrow('Invalid published project')
  expect((await loadWorkspace(publishedProject.ref))!.project).toEqual(publishedProject)
})

it('blocks a merge when individually valid opening edits exceed the host wall together', async () => {
  const base = structuredClone(publishedProject)
  const wall = base.buildings[0].walls.find((wall) => wall.openings.length)!
  wall.openings[0].sillM = 0
  wall.openings[0].heightM = wall.heightM - 0.6
  await synchronizePublishedProject(base, legacyProjectBase)
  const local = structuredClone(base), incoming = structuredClone(base)
  local.buildings[0].walls.find((w) => w.ref === wall.ref)!.openings[0].sillM = 0.4
  incoming.buildings[0].walls.find((w) => w.ref === wall.ref)!.openings[0].heightM = wall.heightM - 0.2
  incoming.revision++
  expect(validateProject(local).filter((issue) => issue.severity === 'error')).toEqual([])
  expect(validateProject(incoming).filter((issue) => issue.severity === 'error')).toEqual([])
  await saveWorkspace(envelope(local))
  expect(await synchronizePublishedProject(incoming, legacyProjectBase)).toContain(`${wall.openings[0].ref} exceeds wall height.`)
  expect((await loadWorkspace(local.ref))!.project).toEqual(local)
})

it('treats conflicting numeric geometry arrays atomically and conflicting additions as conflicts', () => {
  const local = structuredClone(publishedProject), incoming = structuredClone(publishedProject)
  local.site.boundary[0].x++
  incoming.site.boundary[0].x--
  const newPlant = { ...structuredClone(local.landscape.plants[0]), ref: 'plant/new' }
  local.landscape.plants.push(newPlant)
  incoming.landscape.plants.push({ ...newPlant, matureHeightM: 4 })
  const result = mergeProjects(publishedProject, local, incoming)
  expect(result.conflicts).toContain('/site/boundary')
  expect(result.conflicts).toContain('/landscape/plants/plant/new')
})
