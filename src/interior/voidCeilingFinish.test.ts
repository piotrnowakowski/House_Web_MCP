import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it } from 'vitest'
import data from '../../project-data/architekt-7-11/project.json'
import before from '../../project-data/architekt-7-11/before-timber-ceiling-r12.json'
import ceilingOnly from '../../project-data/architekt-7-11/before-oak-side-walls-r13.json'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { diffProjects } from '../domain/diff'
import { mergeProjects } from '../domain/projectMerge'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from '../services/persistence'
import { voidCeilingFinish } from './voidCeilingFinish'

beforeEach(() => { globalThis.indexedDB = new IDBFactory() })
const living = (project: ReturnType<typeof parseProject>) => project.buildings[0].spaces.find(s => s.ref === 'space/reference-living')!

it('adds only an oak lining over the living void, preserving all geometry and flat ceilings', () => {
  const project = parseProject(ceilingOnly), old = parseProject(before), house = project.buildings[0]
  expect(validateProject(project).filter(i => i.severity === 'error')).toEqual([])
  const finish = living(project).voidCeilingFinish!
  expect(finish.presetId).toBe('natural-oak')
  expect(finish.rotationDegrees).toBe(90) // Rear roof ridge is X; boards run along X.
  const pitch = house.roof.segments.find(r => r.ref === 'roof/reference/rear-barn')!.pitchDegrees
  expect(finish.tileM / 6 / Math.cos(pitch * Math.PI / 180)).toBeCloseTo(.16, 5)
  expect(diffProjects(old, project).changes).toEqual([{ kind: 'space', ref: living(project).ref, change: 'modified', fields: ['voidCeilingFinish'] }])
  delete living(project).voidCeilingFinish
  expect({ ...project, revision: old.revision, updatedAt: old.updatedAt }).toEqual(old)
})

it('resolves the finish from the room below even when openings are reordered', () => {
  const house = parseProject(data).buildings[0], upper = house.storeys[1]
  const holes = house.slabs.find(s => s.ref === upper.baseSlabRef)!.holes!
  expect(voidCeilingFinish(house, upper, holes[1]).presetId).toBe('natural-oak')
  expect(voidCeilingFinish(house, upper, holes[0]).presetId).toBe('warm-white')
  holes.reverse()
  expect(voidCeilingFinish(house, upper, holes[0]).presetId).toBe('natural-oak')
  expect(voidCeilingFinish(parseProject(before).buildings[0], upper, holes[0]).presetId).toBe('warm-white')
})

it('merges the finish, preserves independent deletion and retains the result after save/reload', async () => {
  const old = parseProject(before), incoming = parseProject(data)
  await synchronizePublishedProject(old, old)
  const workspace = (await loadWorkspace(old.ref))!, local = workspace.project
  local.buildings[0].furniture!.pop()
  living(local).ceilingFinish!.color = '#EDEDED'
  await saveWorkspace(workspace)
  expect(await synchronizePublishedProject(incoming, old)).toEqual([])
  const saved = (await loadWorkspace(old.ref))!
  expect(living(saved.project).voidCeilingFinish).toEqual(living(incoming).voidCeilingFinish)
  expect(living(saved.project).ceilingFinish!.color).toBe('#EDEDED')
  expect(saved.project.buildings[0].furniture).toEqual(local.buildings[0].furniture)
  expect(await synchronizePublishedProject(incoming, old)).toEqual([])
  expect(await loadWorkspace(old.ref)).toEqual(saved)
})

it('reports a competing finish or room deletion without overwriting the local edit', () => {
  const old = parseProject(before), local = structuredClone(old), incoming = parseProject(data)
  living(local).voidCeilingFinish = { ...living(old).ceilingFinish! }
  const competing = mergeProjects(old, local, incoming)
  expect(competing.conflicts).toContain('/buildings/house/main/spaces/space/reference-living/voidCeilingFinish')
  expect(living(competing.project).voidCeilingFinish).toEqual(living(local).voidCeilingFinish)
  local.buildings[0].spaces = local.buildings[0].spaces.filter(s => s.ref !== 'space/reference-living')
  const deleted = mergeProjects(old, local, incoming)
  expect(deleted.conflicts).toContain('/buildings/house/main/spaces/space/reference-living')
  expect(living(deleted.project)).toBeUndefined()
})
