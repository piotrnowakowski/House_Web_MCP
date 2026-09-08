import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import { createReferenceHouse } from '../domain/referenceHouse'
import { modernBarnProject } from '../domain/sampleProject'
import { listWorkspaces, loadWorkspace, saveWorkspace } from '../services/persistence'
import { useStudioStore } from './store'

it('starts a fresh Zielonki workspace with the furnished reference and preserves subsequent edits', async () => {
  globalThis.indexedDB = new IDBFactory()
  await useStudioStore.getState().openZielonkiStudy()
  const project = useStudioStore.getState().project
  expect(project.buildings[0].furniture).toHaveLength(22)
  expect(project.buildings[0].interiorSource).toBeDefined()
  expect(project.buildings[0].rotationDegrees).toBe(270)
  expect(project.buildings[0].position).toEqual({ x: 2.5, z: 1.5 })
  expect((await loadWorkspace(project.ref))?.project.buildings).toEqual(project.buildings)
  project.buildings[0].spaces[0].name = 'My saved room'
  await saveWorkspace({ version: 1, project, proposals: [], draftChangeSets: [] })
  await useStudioStore.getState().openZielonkiStudy()
  expect(useStudioStore.getState().project.buildings[0].spaces[0].name).toBe('My saved room')
})

it('fits saved reference edits into saved Zielonki, backs up the previous house, and opens the fitted model unchanged', async () => {
  globalThis.indexedDB = new IDBFactory()
  const reference = createReferenceHouse()
  reference.buildings[0].spaces[0].name = 'Our living room'
  const target = structuredClone(modernBarnProject)
  target.buildings[0].rotationDegrees = 5
  await saveWorkspace({ version: 1, project: target, proposals: [], draftChangeSets: [] })
  useStudioStore.getState().replaceProject(reference)
  await useStudioStore.getState().fitReferenceToZielonki()
  const fitted = useStudioStore.getState().project
  expect(fitted.ref).toBe(target.ref)
  expect(fitted.buildings[0].spaces[0].name).toBe('Our living room')
  expect(fitted.buildings[0].rotationDegrees).toBe(5)
  const backup = (await listWorkspaces()).find((s) => s.ref.includes('/before-interior-'))!
  expect((await loadWorkspace(backup.ref))?.project.buildings).toEqual(target.buildings)
  useStudioStore.getState().undo()
  expect(useStudioStore.getState().project.buildings).toEqual(target.buildings)
  await useStudioStore.getState().openZielonkiStudy()
  expect(useStudioStore.getState().project.buildings).toEqual(fitted.buildings)
  expect(useStudioStore.getState().history).toEqual([])
})
