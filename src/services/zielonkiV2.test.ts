import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import data from '../../project-data/zielonki-v2/before-carport-r46.json'
import before from '../../project-data/zielonki-v2/before-pergola-r45.json'
import { calculateMetrics, validateProject } from '../domain/commands'
import { parseProject } from '../domain/schema'
import { useStudioStore } from '../state/store'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'
import { legacyProjectBase, publishedProject } from './publishedProject'

it('keeps the v2 garage and roof terrace removed across storage, restore migrations and published synchronization', async () => {
  globalThis.indexedDB = new IDBFactory()
  const project = parseProject(data)
  const workspace = { version: 1 as const, project, proposals: [], draftChangeSets: [] }
  await saveWorkspace({ ...workspace, project: structuredClone(publishedProject) })
  await saveWorkspace(workspace)
  await synchronizePublishedProject(publishedProject, legacyProjectBase)
  const saved = await loadWorkspace(project.ref)
  expect(saved).toEqual(workspace)
  useStudioStore.getState().restoreWorkspace(saved!)
  const restored = useStudioStore.getState().project
  expect(restored).toEqual(project)
  expect(validateProject(restored).filter(issue => issue.severity === 'error')).toEqual([])
  expect(calculateMetrics(restored).garageAreaM2).toBe(0)
  const house = restored.buildings[0]
  expect(house.roof.segments.some(segment => segment.ref.endsWith('/garage-cap') || segment.terrace)).toBe(false)
  expect(house.walls.flatMap(wall => wall.openings).some(opening => opening.ref === 'opening/reference-garage-gate')).toBe(false)
  expect(house.furniture?.some(item => item.catalogId === 'car' || item.ref === 'interior/reference-garage-storage')).toBe(false)
  expect(house.roof.segments.filter(segment => segment.canopy?.slats)).toHaveLength(2)
  expect(house.roof.segments.filter(segment => segment.type === 'gable')).toEqual(before.project.buildings[0].roof.segments.filter(segment => segment.type === 'gable'))
  expect(house.spaces.filter(space => space.usage === 'bedroom')).toEqual(before.project.buildings[0].spaces.filter(space => space.usage === 'bedroom'))
  expect(restored.landscape.plants).toEqual(before.project.landscape.plants)
  expect((await loadWorkspace(publishedProject.ref))?.project).toEqual(publishedProject)
})
