import { beforeEach, expect, it, vi } from 'vitest'
import { createTerrainProject } from '../domain/terrain'
import type { PersistedWorkspace } from '../domain/types'
const save = vi.hoisted(() => vi.fn())
vi.mock('./persistence', () => ({ saveWorkspace: save }))
const workspace = (): PersistedWorkspace => ({ version: 1, project: createTerrainProject({ name: 'Saved', widthM: 30, depthM: 40, northDegrees: 0, latitude: 52, longitude: 21, timezone: 'Europe/Warsaw' }), proposals: [], draftChangeSets: [] })
beforeEach(() => { vi.resetModules(); save.mockReset() })
it('never marks a pending transaction saved, captures immediately and flushes all queued edits', async () => {
  let complete!: () => void
  save.mockImplementationOnce(() => new Promise<void>(r => { complete = r })).mockResolvedValue(undefined)
  const a = await import('./autosave'), w = workspace()
  a.captureWorkspace(w)
  expect(a.useSaveStatus.getState().phase).toBe('saving')
  w.project.name = 'Next'; a.captureWorkspace(w)
  expect(save.mock.calls[0][0].project.name).toBe('Saved')
  expect(a.hasUnsavedChanges()).toBe(true)
  complete(); await a.flushAutosave()
  expect(save.mock.calls[1][0].project.name).toBe('Next')
  expect(a.useSaveStatus.getState().phase).toBe('saved')
  expect(a.hasUnsavedChanges()).toBe(false)
})
it('retains failed work, blocks switching and permits an explicit retry', async () => {
  save.mockRejectedValueOnce(new Error('Quota exceeded')).mockResolvedValue(undefined)
  const a = await import('./autosave'), w = workspace()
  a.captureWorkspace(w)
  await expect(a.flushAutosave()).rejects.toThrow('Quota exceeded')
  expect(a.useSaveStatus.getState().phase).toBe('error')
  expect(a.recoveryWorkspace()).toEqual(w)
  expect(() => a.assertLocalSaveComplete()).toThrow()
  await a.retryAutosave()
  expect(a.useSaveStatus.getState().phase).toBe('saved')
})
