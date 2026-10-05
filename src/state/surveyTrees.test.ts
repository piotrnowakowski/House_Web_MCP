import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import { modernBarnProject } from '../domain/sampleProject'
import { saveWorkspace } from '../services/persistence'
import { useStudioStore } from './store'

it('corrects trees when opening a saved copy, preserves tree edits and deletions, and runs once', async () => {
  globalThis.indexedDB = new IDBFactory()
  const project = structuredClone(modernBarnProject)
  project.ref = 'project/saved-zielonki-copy'
  project.landscape.orchardCatalogVersion = 5
  project.landscape.plants = project.landscape.plants.filter((plant) => plant.surveyHandle !== '5015')
  const tree = project.landscape.plants.find((plant) => plant.surveyHandle === '5012')!
  tree.position = { x: -13.630719206747763, z: 8.78545496595353 }
  tree.name = 'My pine'; tree.matureHeightM = 12; tree.canopyM = 8; tree.locked = false
  await saveWorkspace({ version: 1, project, proposals: [], draftChangeSets: [] })
  await useStudioStore.getState().openWorkspace(project.ref)
  const corrected = useStudioStore.getState().project
  const correctedTree = corrected.landscape.plants.find((plant) => plant.ref === tree.ref)!
  expect(correctedTree.position.x).toBeCloseTo(-14.62626, 4)
  expect(correctedTree.position.z).toBeCloseTo(2.77505, 4)
  expect(correctedTree).toMatchObject({ name: 'My pine', matureHeightM: 12, canopyM: 8, locked: false })
  expect(corrected.landscape.plants).toHaveLength(project.landscape.plants.length)
  expect(corrected.landscape.plants.some((plant) => plant.surveyHandle === '5015')).toBe(false)
  expect(corrected.buildings).toEqual(project.buildings)
  expect(corrected.site).toEqual(project.site)
  expect(corrected.revision).toBe(project.revision + 1)
  expect(corrected.landscape.orchardCatalogVersion).toBe(6)
  correctedTree.position.x += 2
  await saveWorkspace({ version: 1, project: corrected, proposals: [], draftChangeSets: [] })
  await useStudioStore.getState().openWorkspace(project.ref)
  expect(useStudioStore.getState().project).toEqual(corrected)
})
