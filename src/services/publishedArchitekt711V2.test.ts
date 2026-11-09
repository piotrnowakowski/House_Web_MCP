import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it } from 'vitest'
import data from '../../project-data/architekt-7-11-v2/project.json'
import source from '../../project-data/architekt-7-11-v2/source-architekt-711-r6.json'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { saveWorkspace, loadWorkspace, deleteWorkspace, synchronizePublishedProject } from './persistence'
import { ARCHITEKT_711_V2_REF, synchronizePublishedArchitekt711V2 } from './publishedArchitekt711V2'

beforeEach(() => { globalThis.indexedDB = new IDBFactory() })

it('keeps the r6 house and garden with only the under-stair cabinet extension removed', () => {
  const p = parseProject(data), before = parseProject(source)
  expect(p.ref).toBe(ARCHITEKT_711_V2_REF)
  expect(p.name).toBe('architekt 7.11 wersja 2')
  expect(p.revision).toBe(1)
  expect(validateProject(p).filter(i => i.severity === 'error')).toEqual([])
  const removed = ['interior/architekt-711/under-stair-cabinet', 'interior/architekt-711/stair-junction-filler']
  expect(p.buildings[0].furniture).toEqual(before.buildings[0].furniture!.filter(f => !removed.includes(f.ref)))
  expect(p.buildings[0].furniture!.some(f => f.cabinetry === 'under-stair')).toBe(false)
  const actual = structuredClone(p)
  actual.ref = before.ref; actual.name = before.name; actual.revision = before.revision; actual.updatedAt = before.updatedAt
  actual.buildings[0].furniture = before.buildings[0].furniture
  actual.buildings[0].interiorSource = before.buildings[0].interiorSource
  expect(actual).toEqual(before)
})

it('saves the independent copy and preserves user deletions during a subsequent published update', async () => {
  const parent = { version: 1 as const, project: parseProject(source), proposals: [], draftChangeSets: [] }
  parent.project.landscape.plants.pop()
  await saveWorkspace(parent)
  expect(await synchronizePublishedArchitekt711V2()).toEqual([])
  const saved = (await loadWorkspace(ARCHITEKT_711_V2_REF))!
  saved.project.landscape.plants.pop()
  saved.project.buildings[0].furniture!.pop()
  await saveWorkspace(saved)
  const next = parseProject(data)
  next.revision = 2; next.updatedAt = '2026-11-10T12:00:00.000Z'
  next.name += ' test update'
  expect(await synchronizePublishedProject(next, parseProject(data))).toEqual([])
  const reloaded = (await loadWorkspace(ARCHITEKT_711_V2_REF))!
  expect(reloaded.project.landscape).toEqual(saved.project.landscape)
  expect(reloaded.project.buildings[0].furniture).toEqual(saved.project.buildings[0].furniture)
  expect(reloaded.project.name).toBe(next.name)
  expect(await loadWorkspace(parent.project.ref)).toEqual(parent)
})

it('does not recreate a deleted version 2 when the launcher initializes again', async () => {
  await synchronizePublishedArchitekt711V2()
  await deleteWorkspace(ARCHITEKT_711_V2_REF)
  await synchronizePublishedArchitekt711V2()
  expect(await loadWorkspace(ARCHITEKT_711_V2_REF)).toBeNull()
})
