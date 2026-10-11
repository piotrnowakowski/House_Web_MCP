import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it, vi } from 'vitest'
import { createTerrainProject } from '../domain/terrain'
import type { PersistedWorkspace } from '../domain/types'

const workspace = (): PersistedWorkspace => ({ version: 1, project: createTerrainProject({ name: 'History', widthM: 30, depthM: 40, northDegrees: 0, latitude: 52, longitude: 21, timezone: 'Europe/Warsaw' }), proposals: [], draftChangeSets: [] })
beforeEach(() => { vi.resetModules(); globalThis.indexedDB = new IDBFactory() })

it('restores undo and redo after a module reload without adding history to the shared envelope', async () => {
  const p = await import('./persistence'), w = workspace()
  const before = structuredClone(w.project), after = { ...structuredClone(w.project), revision: 3 }
  w.project.revision = 2
  await p.saveWorkspace(w, { editHistory: { history: [before], future: [after] } })
  vi.resetModules()
  const reloaded = await import('./persistence')
  const saved = (await reloaded.loadWorkspace(w.project.ref))!
  expect(Object.keys(saved).sort()).toEqual(['draftChangeSets', 'project', 'proposals', 'version'])
  expect(await reloaded.loadEditHistory(saved.project)).toEqual({ history: [before], future: [after] })
})

it('saves immutable bounded history and invalidates it after project replacement or deletion', async () => {
  const p = await import('./persistence'), w = workspace()
  const snapshots = Array.from({ length: 45 }, (_, i) => ({ ...structuredClone(w.project), revision: i + 1 }))
  const saving = p.saveWorkspace(w, { editHistory: { history: snapshots, future: [] } })
  snapshots[44].name = 'Unsaved mutation'
  await saving
  const journal = (await p.loadEditHistory(w.project))!
  expect(journal.history).toHaveLength(40)
  expect(journal.history[0].revision).toBe(6)
  expect(journal.history[39].name).toBe('History')
  expect(await p.loadEditHistory({ ...w.project, revision: 100 })).toBeUndefined()
  w.project.revision++
  await p.saveWorkspace(w)
  expect(await p.loadEditHistory(w.project)).toBeUndefined()
  await p.saveWorkspace(w, { editHistory: journal })
  await p.deleteWorkspace(w.project.ref)
  expect(await p.loadEditHistory(w.project)).toBeUndefined()
})

it('a stale tab cannot replace either the saved model or its undo trail', async () => {
  const a = await import('./persistence'), w = workspace(), original = structuredClone(w.project)
  await a.saveWorkspace(w)
  vi.resetModules()
  const b = await import('./persistence'), stale = (await b.loadWorkspace(w.project.ref))!
  w.project.revision++
  const history = { history: [original], future: [] }
  await a.saveWorkspace(w, { editHistory: history })
  stale.project.name = 'Stale tab'
  await expect(b.saveWorkspace(stale, { editHistory: { history: [], future: [] } })).rejects.toThrow('another tab')
  expect((await a.loadWorkspace(w.project.ref))?.project).toEqual(w.project)
  expect(await a.loadEditHistory(w.project)).toEqual(history)
})

it('ignores malformed history instead of preventing the project from opening', async () => {
  const p = await import('./persistence'), w = workspace()
  await p.saveWorkspace(w, { editHistory: { history: [{ ...w.project, ref: 'project/other' }], future: [] } })
  expect(await p.loadEditHistory(w.project)).toBeUndefined()
  expect(await p.loadWorkspace(w.project.ref)).toEqual(w)
})

it('renaming a saved project retains its matching undo trail', async () => {
  const p = await import('./persistence'), w = workspace()
  const history = { history: [structuredClone(w.project)], future: [] }
  w.project.revision++
  await p.saveWorkspace(w, { editHistory: history })
  await p.renameWorkspace(w.project.ref, 'Renamed')
  const renamed = (await p.loadWorkspace(w.project.ref))!
  expect(await p.loadEditHistory(renamed.project)).toEqual(history)
})
