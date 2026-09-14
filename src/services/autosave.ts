import { create } from 'zustand'
import type { PersistedWorkspace } from '../domain/types'
import { saveWorkspace } from './persistence'

export const useSaveStatus = create<{ phase: 'idle' | 'saving' | 'saved' | 'error'; error: string | null }>(() => ({ phase: 'idle', error: null }))
let pending: PersistedWorkspace[] = []
let running: Promise<void> | null = null
let failure: Error | null = null
let latest: PersistedWorkspace | null = null

const drain = () => {
  if (running || failure) return
  running = (async () => {
    while (pending.length) {
      try { await saveWorkspace(pending[0]); pending.shift() }
      catch (error) {
        failure = error instanceof Error ? error : new Error('Local storage unavailable')
        useSaveStatus.setState({ phase: 'error', error: failure.message })
        return
      }
    }
    useSaveStatus.setState({ phase: 'saved', error: null })
  })().finally(() => { running = null; if (pending.length && !failure) drain() })
}
export const captureWorkspace = (workspace: PersistedWorkspace) => {
  latest = structuredClone(workspace)
  pending.push(latest)
  if (!failure) useSaveStatus.setState({ phase: 'saving', error: null })
  drain()
}
export const flushAutosave = async () => {
  while (running) await running
  if (failure) throw failure
}
export const retryAutosave = async () => {
  failure = null
  useSaveStatus.setState({ phase: 'saving', error: null })
  drain()
  await flushAutosave()
}
export const recoveryWorkspace = () => latest
export const hasUnsavedChanges = () => pending.length > 0 || !!failure
export const assertLocalSaveComplete = () => { if (hasUnsavedChanges()) throw new Error('Wait for Saved locally, or recover the failed save before switching projects.') }
