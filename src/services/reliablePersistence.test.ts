import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it, vi } from 'vitest'
import { createTerrainProject } from '../domain/terrain'
import type { PersistedWorkspace } from '../domain/types'

const workspace = (): PersistedWorkspace => ({ version: 1, project: createTerrainProject({ name: 'Durable', widthM: 30, depthM: 40, northDegrees: 0, latitude: 52, longitude: 21, timezone: 'Europe/Warsaw' }), proposals: [], draftChangeSets: [] })
beforeEach(() => { vi.resetModules(); globalThis.indexedDB = new IDBFactory() })
it('captures snapshots immediately and preserves ordering across rapid edits and reload', async () => {
  const p = await import('./persistence')
  const w = workspace()
  const saves = [p.saveWorkspace(w)]
  for (let i = 1; i <= 10; i++) { w.project.name = `Move ${i}`; saves.push(p.saveWorkspace(w)) }
  w.project.name = 'Never saved'
  await Promise.all(saves)
  expect((await p.loadWorkspace(w.project.ref))?.project.name).toBe('Move 10')
})
it('rejects stale tab writes and retains deleted-workspace tombstones across reload', async () => {
  const a = await import('./persistence'), w = workspace()
  await a.saveWorkspace(w)
  vi.resetModules()
  const b = await import('./persistence')
  const stale = (await b.loadWorkspace(w.project.ref))!
  w.project.name = 'Newer tab'; await a.saveWorkspace(w)
  stale.project.name = 'Stale tab'
  await expect(b.saveWorkspace(stale)).rejects.toThrow('another tab')
  expect((await a.loadWorkspace(w.project.ref))?.project.name).toBe('Newer tab')
  await a.deleteWorkspace(w.project.ref)
  await b.loadWorkspace(w.project.ref)
  await expect(b.saveWorkspace(stale)).rejects.toThrow()
  expect(await a.loadWorkspace(w.project.ref)).toBeNull()
})
it('does not let late non-active saves change the selected project', async () => {
  const p = await import('./persistence'), first = workspace(), second = workspace()
  await p.saveWorkspace(first); await p.saveWorkspace(second)
  first.project.name = 'Late save'; await p.saveWorkspace(first, { activate: false })
  expect((await p.loadWorkspace())?.project.ref).toBe(second.project.ref)
})
it('commits a shared baseline and workspace together', async () => {
  const p = await import('./persistence'), w = workspace()
  await p.saveWorkspace(w, { sync: { base: { serverVersion: 3, workspace: w } } })
  expect((await p.readSyncRecord<{ base: { serverVersion: number } }>(w.project.ref))?.base.serverVersion).toBe(3)
  expect(await p.loadWorkspace(w.project.ref)).toEqual(w)
})
