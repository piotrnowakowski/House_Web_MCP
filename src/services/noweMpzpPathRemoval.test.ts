import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import data from '../../project-data/nowe-mpzp/project.json'
import previous from '../../project-data/nowe-mpzp/before-path-removal-r18.json'
import { parseProject } from '../domain/schema'
import { polygonArea } from '../domain/geometry'
import { mergeProjects } from '../domain/projectMerge'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'

it('removes only the marked stepping stones and detached bed, restores lawn, and persists the deletion', async () => {
  const base = parseProject(previous), incoming = parseProject(data)
  const removedZone = (ref: string) => /^zone\/nowe-mpzp\/garden\/step-\d+$/.test(ref) || ref.endsWith('/grass-border-4')
  const removedPlant = (ref: string) => ref.startsWith('plant/nowe-mpzp/grasses-4-')
  expect(base.landscape.zones.filter(z => removedZone(z.ref))).toHaveLength(13)
  expect(base.landscape.plants.filter(p => removedPlant(p.ref))).toHaveLength(6)
  expect(incoming.landscape.zones.some(z => removedZone(z.ref))).toBe(false)
  expect(incoming.landscape.plants).toEqual(base.landscape.plants.filter(p => !removedPlant(p.ref)))
  const infill = incoming.landscape.zones.filter(z => z.ref.includes('/lawn-infill-'))
  expect(infill.every(z => z.kind === 'lawn' && z.textureId === 'leafy-grass')).toBe(true)
  expect(infill.reduce((sum, z) => sum + polygonArea(z.footprint), 0)).toBeCloseTo(10.4883276, 5)
  expect(incoming.landscape.zones.filter(z => !infill.includes(z))).toEqual(base.landscape.zones.filter(z => !removedZone(z.ref)))
  expect(incoming.landscape.fixtures).toEqual(base.landscape.fixtures)
  expect(incoming.buildings).toEqual(base.buildings)
  expect(incoming.site).toEqual(base.site)

  globalThis.indexedDB = new IDBFactory()
  await synchronizePublishedProject(base, base)
  const workspace = (await loadWorkspace(base.ref))!
  workspace.project.buildings[0].name = 'Zachowana lokalna nazwa'
  await saveWorkspace(workspace)
  expect(await synchronizePublishedProject(incoming, base)).toEqual([])
  const saved = (await loadWorkspace(base.ref))!
  expect(saved.project.landscape).toEqual(incoming.landscape)
  expect(saved.project.buildings[0].name).toBe('Zachowana lokalna nazwa')
  await saveWorkspace(saved)
  await synchronizePublishedProject(incoming, base)
  expect((await loadWorkspace(base.ref))!.project.landscape).toEqual(incoming.landscape)

  const local = structuredClone(base)
  const edited = local.landscape.zones.find(z => removedZone(z.ref))!
  edited.name = 'Lokalna zmiana płyty'
  const conflict = mergeProjects(base, local, incoming)
  expect(conflict.conflicts).toContain(`/landscape/zones/${edited.ref}`)
  expect(conflict.project.landscape.zones.find(z => z.ref === edited.ref)).toEqual(edited)
})
