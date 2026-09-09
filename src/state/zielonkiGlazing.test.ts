import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import { calculateMetrics } from '../domain/commands'
import { diffProjects } from '../domain/diff'
import { createReferenceHouse } from '../domain/referenceHouse'
import { modernBarnProject } from '../domain/sampleProject'
import { fitZielonkiInterior } from '../domain/zielonkiInterior'
import { upgradeZielonkiPlacement } from '../domain/zielonkiPlacement'
import { saveWorkspace } from '../services/persistence'
import { useStudioStore } from './store'

it('opens a saved copy with glazed gables and a living void, then preserves later edits', async () => {
  globalThis.indexedDB = new IDBFactory()
  const reference = createReferenceHouse()
  const project = upgradeZielonkiPlacement(fitZielonkiInterior(modernBarnProject, reference))
  project.ref = 'project/old-interior-copy'
  const house = project.buildings[0]
  house.interiorSource!.notes = house.interiorSource!.notes.filter((n) => !n.startsWith('ICON glazing'))
  house.roof.segments.forEach((s) => { delete s.gableGlazing })
  house.slabs[1].holes!.pop()
  const mezzanine = structuredClone(reference.buildings[0].spaces.find((s) => s.ref === 'space/reference-mezzanine')!)
  house.spaces.push(mezzanine)
  house.storeys[1].spaceRefs.push(mezzanine.ref)
  await saveWorkspace({ version: 1, project, proposals: [], draftChangeSets: [] })
  await useStudioStore.getState().openWorkspace(project.ref)
  const restored = useStudioStore.getState().project
  expect(restored.revision).toBe(project.revision + 1)
  expect(restored.buildings[0].slabs[1].holes).toHaveLength(2)
  expect(restored.site).toEqual(project.site)
  expect(restored.landscape).toEqual(project.landscape)
  expect(restored.buildings[0].furniture).toEqual(house.furniture)
  expect(calculateMetrics(project).homeAreaM2 - calculateMetrics(restored).homeAreaM2).toBeCloseTo(5.53 * 7.35, 4)
  const diff = diffProjects(project, restored)
  expect(diff.changes.some((c) => c.kind === 'slab' && c.fields?.includes('holes'))).toBe(true)
  expect(diff.changes.some((c) => c.kind === 'roof-segment' && c.fields?.includes('gableGlazing'))).toBe(true)
  restored.buildings[0].roof.segments[0].gableGlazing!.max!.roofInsetM = 0.35
  await saveWorkspace({ version: 1, project: restored, proposals: [], draftChangeSets: [] })
  await useStudioStore.getState().openWorkspace(project.ref)
  expect(useStudioStore.getState().project).toEqual(restored)
})
