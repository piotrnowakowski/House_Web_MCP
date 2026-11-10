import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it } from 'vitest'
import data from '../../project-data/architekt-7-11/project.json'
import prior from '../../project-data/architekt-7-11/before-stair-consolidation.json'
import { applyCommand, validateProject } from './commands'
import { parseProject } from './schema'
import { applyStairVariant, currentStairVariant, hasStairCabinet, stairCabinetRef, stairFillerRef, stairVariants } from './stairVariants'
import { uStairHeadroom, uStairSurfaces } from './stairs'
import { interiorCorners } from './interior'
import { polygonBounds } from './geometry'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from '../services/persistence'
import { useStudioStore } from '../state/store'
import type { StairVariant } from './types'

const command = (layout: StairVariant, cabinet: boolean) => ({ type: 'interior.update' as const, buildingRef: 'house/main', storeyRef: 'storey/reference-ground', action: 'stairs' as const, layout, cabinet })
const owned = (ref: string) => [stairCabinetRef, stairFillerRef].includes(ref)
beforeEach(() => { globalThis.indexedDB = new IDBFactory() })

for (const { id } of stairVariants) for (const cabinet of [false, true]) it(`persists ${id}, cabinet=${cabinet}, preserving the house and independent deletions`, async () => {
  const source = parseProject(data)
  source.landscape.plants.pop()
  source.buildings[0].furniture!.splice(source.buildings[0].furniture!.findIndex(f => f.ref === 'interior/office-c5/chair'), 1)
  source.buildings[0].slabs.find(s => s.ref === 'slab/reference-upper')!.holes!.reverse()
  const project = applyCommand(source, command(id, cabinet)), house = project.buildings[0], before = source.buildings[0]
  expect(currentStairVariant(house)).toBe(id)
  expect(hasStairCabinet(house)).toBe(cabinet)
  expect(validateProject(project).filter(i => i.severity === 'error')).toEqual([])
  expect(house.furniture!.filter(f => !owned(f.ref))).toEqual(before.furniture!.filter(f => !owned(f.ref)))
  for (const key of ['walls', 'spaces', 'storeys', 'roof', 'position', 'rotationDegrees', 'platforms', 'ceilingFinishes'] as const) expect(house[key]).toEqual(before[key])
  expect(project.site).toEqual(source.site); expect(project.landscape).toEqual(source.landscape)
  expect(project.buildings.slice(1)).toEqual(source.buildings.slice(1))
  expect(house.slabs[1].holes![0]).toEqual(before.slabs[1].holes![0]) // Living void, deliberately first.
  const stairs = house.stairs![0], rise = house.storeys[1].elevationM - house.storeys[0].elevationM
  expect(uStairHeadroom(house, stairs)).toBeGreaterThan(2.3)
  if (cabinet) {
    const item = house.furniture!.find(f => f.ref === stairCabinetRef)!, b = polygonBounds(interiorCorners(item))
    const overhead = uStairSurfaces(stairs, rise).filter(s => s.z + stairs.start.z > b.minZ && s.z + stairs.start.z < b.maxZ)
    let tested = 0
    for (const s of overhead) {
      const left = Math.max(b.minX, stairs.start.x + s.x - s.width / 2), right = Math.min(b.maxX, stairs.start.x + s.x + s.width / 2)
      if (right <= left) continue
      const height = item.cabinetBackHeightM! + (item.heightM - item.cabinetBackHeightM!) * (right - b.minX) / (b.maxX - b.minX)
      expect(height).toBeLessThan(s.top - .08); tested++
    }
    expect(tested).toBeGreaterThan(1)
  }
  await saveWorkspace({ version: 1, project, proposals: [], draftChangeSets: [] })
  expect((await loadWorkspace(project.ref))!.project).toEqual(parseProject(project))
})

it('restores edited cabinetry across toggles and layout switches, and undoes the complete change', async () => {
  const p = parseProject(data), house = p.buildings[0]
  house.furniture!.find(f => f.ref === stairCabinetRef)!.color = '#334455'
  useStudioStore.setState({ project: p, history: [], future: [], proposals: [], variants: [], draftChangeSets: [], confirmationVariantRef: null })
  useStudioStore.getState().commitCommand(command('classic-9-9', true))
  expect(currentStairVariant(useStudioStore.getState().project.buildings[0])).toBe('classic-9-9')
  useStudioStore.getState().undo()
  expect(useStudioStore.getState().project).toEqual(p)
  useStudioStore.getState().redo()
  const next = structuredClone(useStudioStore.getState().project)
  applyStairVariant(next.buildings[0], 'open-9-9', false)
  await saveWorkspace({ version: 1, project: next, proposals: [], draftChangeSets: [] })
  const loaded = (await loadWorkspace(next.ref))!.project
  applyStairVariant(loaded.buildings[0], 'open-9-9', true)
  expect(loaded.buildings[0].furniture!.find(f => f.ref === stairCabinetRef)!.color).toBe('#334455')
  expect(loaded.buildings[0].furniture!.filter(f => owned(f.ref))).toHaveLength(2)
})

it('does not recreate a deleted cabinet or furniture during publication migration', async () => {
  const before = parseProject(prior), local = structuredClone(before)
  local.buildings[0].furniture = local.buildings[0].furniture!.filter(f => !owned(f.ref))
  local.landscape.plants.pop()
  await saveWorkspace({ version: 1, project: local, proposals: [], draftChangeSets: [] })
  expect(await synchronizePublishedProject(parseProject(data), before)).toEqual([])
  const migrated = (await loadWorkspace(local.ref))!.project
  expect(migrated.buildings[0].furniture).toEqual(local.buildings[0].furniture)
  expect(migrated.landscape).toEqual(local.landscape)
  expect(await synchronizePublishedProject(parseProject(data), before)).toEqual([])
  expect((await loadWorkspace(local.ref))!.project).toEqual(migrated)
})

it('rejects a missing opening or locked cabinetry without changing the source', () => {
  const p = parseProject(data), original = structuredClone(p)
  p.buildings[0].furniture!.find(f => f.ref === stairCabinetRef)!.locked = true
  expect(() => applyCommand(p, command('open-12-6', false))).toThrow(/Odblokuj/)
  expect(p.buildings[0].stairs).toEqual(original.buildings[0].stairs)
  p.buildings[0].slabs[1].holes = []
  expect(() => applyCommand(p, command('open-12-6', false))).toThrow(/otworu/)
})

it('can explicitly restore a cabinet deleted manually while its connector remains', () => {
  const p = parseProject(data)
  p.buildings[0].furniture = p.buildings[0].furniture!.filter(f => f.ref !== stairCabinetRef)
  const restored = applyCommand(p, command('open-9-9', true))
  expect(hasStairCabinet(restored.buildings[0])).toBe(true)
  expect(restored.buildings[0].furniture!.filter(f => owned(f.ref))).toHaveLength(2)
})
