import { create } from 'zustand'
import { useStudioStore } from '../state/store'
import { flushAutosave } from './autosave'
import { loadWorkspace, readSyncRecord, saveRecovery, saveWorkspace, writeSyncRecord } from './persistence'
import { applyLockedWorkspace, lockWorkspace, runWorkspaceActivity } from './workspaceLock'
import { mergeWorkspaces, sameWorkspace, staleWorkspace, validateWorkspace, type SharedVersion, type SyncRecord, type SyncWrite } from '../domain/workspaceSync'
import type { PersistedWorkspace } from '../domain/types'

const KEY = 'house-sync-connection-key'
export const isSyncSecure = () => location.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
export const connectionKey = () => { try { return isSyncSecure() ? localStorage.getItem(KEY) ?? '' : '' } catch { return '' } }
export const rememberConnectionKey = (key: string) => {
  if (!isSyncSecure()) throw new Error('Open HTTPS before entering the private connection key.')
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(key.trim())) throw new Error('Enter the private connection key, not the database password.')
  localStorage.setItem(KEY, key.trim())
}
const apiRoot = () => import.meta.env.VITE_SYNC_API_URL ?? 'https://natan203-20203.mikrus.cloud'
let localConfigured = false
let publicConnection = false
export async function detectPublicConnection() {
  if (!isSyncSecure()) return false
  try {
    const response = await fetch(`${apiRoot()}/api/sync/access`, { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(5000), redirect: 'error' })
    publicConnection = response.ok && (await response.json()).publicAccess === true
  } catch { publicConnection = false }
  return publicConnection
}
export async function detectLocalConnection() {
  if (!import.meta.env.DEV || !['localhost', '127.0.0.1'].includes(location.hostname)) return false
  try {
    const response = await fetch('/api/local-sync/configuration', { headers: { 'X-House-Local-Sync': '1' }, cache: 'no-store', signal: AbortSignal.timeout(5000) })
    localConfigured = response.ok && (await response.json()).configured === true
  } catch { localConfigured = false }
  return localConfigured
}
export class SyncHttpError extends Error { constructor(public status: number, message: string) { super(message) } }
async function request<T>(path: string, body?: unknown): Promise<T> {
  if (!isSyncSecure() || new URL(apiRoot(), location.href).protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(new URL(apiRoot(), location.href).hostname)) throw new Error('Synchronization requires HTTPS.')
  const key = connectionKey()
  if (!key && !localConfigured) await detectLocalConnection()
  if (!key && !localConfigured && !publicConnection) await detectPublicConnection()
  if (!key && !localConfigured && !publicConnection) throw new Error('Connect this browser with your private connection key first.')
  const response = await fetch(localConfigured ? `/api/local-sync/${path}` : `${apiRoot()}/api/sync/${path}`, { method: body ? 'PUT' : 'GET', headers: { ...(localConfigured ? { 'X-House-Local-Sync': '1' } : { Authorization: `Bearer ${key}` }), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000), credentials: 'omit', cache: 'no-store', redirect: 'error' }).catch(() => { throw new Error('Mikrus is unreachable or the request timed out. Local work is preserved; retry Sync when connected.') })
  if (!response.ok) throw new SyncHttpError(response.status, response.status === 401 ? 'Connection key rejected. Update the key for this browser.' : response.status === 409 ? 'Shared version changed. Sync again to review.' : response.status === 404 ? 'No shared workspace found.' : 'Mikrus synchronization failed. Your local work is preserved.')
  return response.json() as Promise<T>
}
export const listSharedProjects = () => request<Array<{ ref: string; name: string; serverVersion: number }>>('projects')
const fetchShared = async (ref: string) => {
  try { return await request<SharedVersion>(`workspace?ref=${encodeURIComponent(ref)}`) }
  catch (error) { if (error instanceof SyncHttpError && error.status === 404) return null; throw error }
}
const currentWorkspace = (): PersistedWorkspace => { const s = useStudioStore.getState(); return { version: 1, project: s.project, proposals: s.proposals, draftChangeSets: s.draftChangeSets } }
const applyWorkspace = (workspace: PersistedWorkspace) => applyLockedWorkspace(() => {
  useStudioStore.getState().setStructureReport(null)
  useStudioStore.setState({ ...workspace, variants: workspace.proposals.filter(item => item.status === 'pending'), history: [], future: [],
    selectedRef: null, repositioningRef: null, confirmationVariantRef: null, sunOverlay: { enabled: false, targetRef: null, result: null }, hydrated: true, launcherOpen: false })
})
interface Conflict { local: PersistedWorkspace; remote: SharedVersion; paths: string[] }
export const useSyncStatus = create<{ busy: boolean; message: string; conflict: Conflict | null; lastSynced: SharedVersion | null }>(() => ({ busy: false, message: '', conflict: null, lastSynced: null }))
let releaseLock: (() => void) | null = null
function finish(message?: string) {
  releaseLock?.(); releaseLock = null
  useSyncStatus.setState({ busy: false, conflict: null, ...(message ? { message } : {}) })
}
export const cancelSync = () => finish('Sync cancelled. Both versions are preserved.')
async function commitShared(candidate: PersistedWorkspace, remote: SharedVersion | null, record: SyncRecord) {
  validateWorkspace(candidate)
  const pending: SyncWrite = { expectedVersion: remote?.serverVersion ?? 0, mutationId: crypto.randomUUID(), workspace: candidate }
  // Persist the exact outgoing snapshot + retry identity BEFORE transmission.
  await saveWorkspace(candidate, { sync: { ...record, pending } })
  applyWorkspace(candidate)
  await flushAutosave()
  const ack = await request<SharedVersion>('workspace', pending)
  await saveWorkspace(candidate, { sync: { base: ack } })
  useSyncStatus.setState({ lastSynced: ack })
  finish(`Synchronized with Mikrus · server version ${ack.serverVersion}`)
}
export async function syncWorkspace() {
  if (useSyncStatus.getState().busy) return
  releaseLock = lockWorkspace('Synchronization in progress. Finish or cancel it before editing.')
  useSyncStatus.setState({ busy: true, message: 'Synchronizing…', conflict: null })
  try {
    await flushAutosave()
    let local = structuredClone(currentWorkspace())
    const ref = local.project.ref
    let record = await readSyncRecord<SyncRecord>(ref) ?? {}
    if (record.pending) {
      try {
        const ack = await request<SharedVersion>('workspace', record.pending)
        record = { base: ack }
        await writeSyncRecord(ref, record)
      } catch (error) {
        if (!(error instanceof SyncHttpError && error.status === 409)) throw error
        record = { base: record.base }
        await writeSyncRecord(ref, record)
      }
    }
    const remote = await fetchShared(ref)
    if (remote && sameWorkspace(local, remote.workspace)) {
      await saveWorkspace(local, { sync: { base: remote } })
      useSyncStatus.setState({ lastSynced: remote })
      finish(`Synchronized with Mikrus · server version ${remote.serverVersion}`)
      return
    }
    if (remote) {
      const merge = record.base ? mergeWorkspaces(record.base.workspace, local, remote.workspace) : null
      await saveRecovery(local)
      await saveRecovery(remote.workspace)
      if (!merge || merge.conflicts.length) {
        useSyncStatus.setState({ conflict: { local, remote, paths: merge?.conflicts ?? ['No common synchronization baseline'] }, message: 'Choose how to resolve the preserved versions.' })
        return
      }
      local = merge.workspace
    }
    await commitShared(local, remote, record)
  } catch (error) { finish(error instanceof Error ? error.message : 'Sync failed. Local work is preserved.') }
}
/** Explicit one-way transfer; a download never issues a write to Mikrus. */
export async function transferWorkspace(direction: 'get' | 'push') {
  if (useSyncStatus.getState().busy) return
  releaseLock = lockWorkspace('Transferring project…')
  useSyncStatus.setState({ busy: true, conflict: null, message: direction === 'get' ? 'Getting from Mikrus…' : 'Pushing to Mikrus…' })
  try {
    await flushAutosave()
    const local = structuredClone(currentWorkspace())
    const ref = local.project.ref
    const record = await readSyncRecord<SyncRecord>(ref) ?? {}
    const remote = await fetchShared(ref)
    if (direction === 'get') {
      if (!remote) throw new Error('This project is not on Mikrus yet. Use Push to Mikrus first.')
      if (!sameWorkspace(local, remote.workspace)) {
        await saveRecovery(local); await saveRecovery(remote.workspace)
        if (!window.confirm('Replace this device’s project with the Mikrus version? Your current version has been backed up.')) { finish('Get cancelled. Your project is unchanged.'); return }
      }
      await saveWorkspace(remote.workspace, { sync: { base: remote } })
      applyWorkspace(remote.workspace)
      await flushAutosave()
      useSyncStatus.setState({ lastSynced: remote })
      finish('Got the project from Mikrus.')
      return
    }
    if (remote && !sameWorkspace(local, remote.workspace) && (!record.base || !sameWorkspace(record.base.workspace, remote.workspace))) {
      await saveRecovery(remote.workspace); await saveRecovery(local)
      if (!window.confirm('Mikrus has a different version. Replace it with this device’s project? Both versions are backed up.')) { finish('Push cancelled. Both versions are unchanged.'); return }
    }
    if (record.pending) {
      try { await request<SharedVersion>('workspace', record.pending) }
      catch (error) { if (!(error instanceof SyncHttpError && error.status === 409)) throw error }
      await writeSyncRecord(ref, { base: record.base })
      // Re-read after recovering a possibly acknowledged earlier write.
      const current = await fetchShared(ref)
      if (current?.serverVersion !== remote?.serverVersion) throw new Error('Recovered an earlier push. Press Push to Mikrus again to send the current project.')
    }
    await commitShared(local, remote, record)
    finish('Pushed the project to Mikrus.')
  } catch (error) { finish(error instanceof Error ? error.message : 'Transfer failed. Your local project is preserved.') }
}
export async function resolveSync(choice: 'local' | 'remote' | 'copy') {
  const conflict = useSyncStatus.getState().conflict
  if (!conflict) return
  useSyncStatus.setState({ conflict: null })
  try {
    if (choice === 'copy') {
      const copy = structuredClone(conflict.local)
      copy.project.ref = `project/${crypto.randomUUID()}`
      copy.project.name += ' · preserved local copy'
      await saveWorkspace(copy, { activate: false })
    }
    const selected = staleWorkspace(choice === 'local' ? conflict.local : conflict.remote.workspace)
    await commitShared(selected, conflict.remote, await readSyncRecord<SyncRecord>(selected.project.ref) ?? {})
  } catch (error) { finish(error instanceof Error ? error.message : 'Sync failed') }
}
export async function downloadShared(ref: string) {
  await flushAutosave()
  const existing = await loadWorkspace(ref)
  if (existing) {
    await useStudioStore.getState().openWorkspace(ref)
    if (useStudioStore.getState().project.ref !== ref || useStudioStore.getState().launcherOpen) throw new Error('Could not open the selected local workspace. Resolve its save error first.')
    await syncWorkspace(); return
  }
  const release = lockWorkspace('Downloading shared workspace…')
  useSyncStatus.setState({ busy: true })
  try {
    await flushAutosave()
    const remote = await fetchShared(ref)
    if (!remote) throw new Error('Shared workspace not found')
    validateWorkspace(remote.workspace)
    await saveWorkspace(remote.workspace, { sync: { base: remote }, restoreDeleted: true })
    applyWorkspace(remote.workspace)
    await flushAutosave()
    useSyncStatus.setState({ lastSynced: remote, message: `Downloaded server version ${remote.serverVersion}` })
  } finally { release(); useSyncStatus.setState({ busy: false }) }
}
export async function exportTransfer(workspace = currentWorkspace()) {
  const sync = await readSyncRecord<SyncRecord>(workspace.project.ref).catch(() => undefined)
  return { format: 'house-workspace-transfer-v1', origin: location.origin, exportedAt: new Date().toISOString(), workspace, sync }
}
export async function importTransfer(value: unknown) {
  return runWorkspaceActivity(async () => {
  const transfer = value as { format?: string; workspace?: unknown; sync?: SyncRecord }
  if (transfer.format !== 'house-workspace-transfer-v1') throw new Error('Choose a workspace recovery export, not a project-only export.')
  const workspace = validateWorkspace(transfer.workspace)
  await flushAutosave()
  const existing = await loadWorkspace(workspace.project.ref)
  if (existing && !sameWorkspace(existing, workspace)) {
    await saveRecovery(existing); await saveRecovery(workspace)
    if (!window.confirm('Both versions have been backed up. Replace this browser’s copy with the imported workspace, keeping its original identity?')) return
  }
  const sync = transfer.sync ?? {}
  if (sync.base) { validateWorkspace(sync.base.workspace); if (sync.base.workspace.project.ref !== workspace.project.ref || !Number.isInteger(sync.base.serverVersion) || sync.base.serverVersion < 1) throw new Error('Invalid sync baseline') }
  // A transferred pending request must be retried only by its originating browser.
  await saveWorkspace(workspace, { sync: { base: sync.base }, restoreDeleted: true })
  applyWorkspace(workspace)
  await flushAutosave()
  })
}
