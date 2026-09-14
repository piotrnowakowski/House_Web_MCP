import { useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStudioStore } from '../state/store'
import { recoveryWorkspace, retryAutosave, useSaveStatus } from '../services/autosave'
import { cancelSync, connectionKey, downloadShared, exportTransfer, importTransfer, isSyncSecure, listSharedProjects, rememberConnectionKey, resolveSync, syncWorkspace, useSyncStatus } from '../services/mikrusSync'
import { sameWorkspace } from '../domain/workspaceSync'
import { listRecoveries } from '../services/persistence'
import type { PersistedWorkspace } from '../domain/types'
import './workspaceSync.css'

export function WorkspaceSync() {
  const save = useSaveStatus()
  const sync = useSyncStatus()
  const state = useStudioStore(useShallow(s => ({ project: s.project, proposals: s.proposals, draftChangeSets: s.draftChangeSets, hydrated: s.hydrated })))
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState('')
  const [connected, setConnected] = useState(() => !!connectionKey())
  const [error, setError] = useState('')
  const [projects, setProjects] = useState<Array<{ ref: string; name: string; serverVersion: number }>>([])
  const [recoveries, setRecoveries] = useState<Array<{ key: string; workspace: PersistedWorkspace }>>([])
  const fileInput = useRef<HTMLInputElement>(null)
  const run = async (action: () => Promise<unknown>) => { setError(''); try { await action() } catch (e) { setError(e instanceof Error ? e.message : 'Operation failed') } }
  const exportFile = async (workspace?: PersistedWorkspace) => {
    const transfer = await exportTransfer(workspace ?? (save.phase === 'error' ? recoveryWorkspace() ?? undefined : undefined))
    const url = URL.createObjectURL(new Blob([JSON.stringify(transfer, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = 'house-workspace-recovery.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const dirty = !sync.lastSynced || !sameWorkspace({ version: 1, project: state.project, proposals: state.proposals, draftChangeSets: state.draftChangeSets }, sync.lastSynced.workspace)
  return <>
    <aside className="workspace-save-bar" aria-label="Workspace saving and synchronization">
      <span role="status" aria-live="polite">{!state.hydrated ? 'Choose a project' : save.phase === 'saving' ? 'Saving locally…' : save.phase === 'error' ? 'Save failed' : save.phase === 'saved' ? 'Saved locally' : 'Opening storage…'}</span>
      {state.hydrated && <small>{dirty ? 'Not synchronized' : `Mikrus v${sync.lastSynced?.serverVersion}`}</small>}
      <button onClick={() => setOpen(!open)} aria-expanded={open}>Save & sync</button>
    </aside>
    {(open || sync.busy) && <section className="workspace-sync-panel" role="dialog" aria-label="Save and synchronize workspace">
      <header><h2>Save & sync</h2><button disabled={sync.busy} onClick={() => setOpen(false)} aria-label="Close save and sync">×</button></header>
      <p role="status">{sync.message}</p>
      {(error || save.error) && <p role="alert">{error || save.error}</p>}
      {save.phase === 'error' && <button onClick={() => void run(retryAutosave)}>Retry local save</button>}
      {!isSyncSecure() ? <p>HTTP work stays in this browser. Export it here, then import it on <a href="https://natan203-20203.mikrus.cloud/" target="_blank" rel="noreferrer">the HTTPS app</a>. Never enter credentials here.</p> : <>
        <details open={!connected}><summary>Private connection key</summary><label>Connection key (not the database password)<input aria-label="Private connection key" type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} /></label><button disabled={sync.busy || !key} onClick={() => { try { rememberConnectionKey(key); setConnected(true); setKey(''); setError('') } catch (e) { setError((e as Error).message) } }}>Remember on this browser</button></details>
        <button disabled={!state.hydrated || !connected || sync.busy || save.phase === 'error'} onClick={() => void run(syncWorkspace)}>Sync with Mikrus</button>
        <button disabled={!connected || sync.busy} onClick={() => void run(async () => { setProjects(await listSharedProjects()) })}>Browse Mikrus projects</button>
        {projects.map(p => <div key={p.ref}><span>{p.name} · v{p.serverVersion}</span><button disabled={sync.busy} onClick={() => void run(() => downloadShared(p.ref))}>Open shared project</button></div>)}
      </>}
      <button disabled={!state.hydrated || sync.busy} onClick={() => void run(() => exportFile())}>Export recovery copy</button>
      <button disabled={!state.hydrated || sync.busy} onClick={() => void run(async () => setRecoveries(await listRecoveries(state.project.ref)))}>Browse recovery snapshots</button>
      {recoveries.map((r, index) => <div key={r.key}><span>{r.workspace.project.name} · r{r.workspace.project.revision} · recovery {index + 1}</span><button onClick={() => void run(() => exportFile(r.workspace))}>Export this snapshot</button></div>)}
      <button disabled={sync.busy} onClick={() => fileInput.current?.click()}>Import recovery copy</button>
      <input ref={fileInput} hidden type="file" accept=".json,application/json" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void run(async () => { if (file.size > 20 * 1024 * 1024) throw new Error('Recovery file exceeds 20 MB'); await importTransfer(JSON.parse(await file.text())) }) }} />
      {sync.conflict && <div role="alert"><h3>Both versions are preserved</h3><p>{sync.conflict.paths.slice(0, 8).join('\n')}</p><p>Choose the complete version to synchronize. Previous copies remain in recovery storage and server history.</p><button onClick={() => void resolveSync('local')}>Use this browser’s version</button><button onClick={() => void resolveSync('remote')}>Use Mikrus version</button><button onClick={() => void resolveSync('copy')}>Keep local as separate copy; use Mikrus</button><button onClick={cancelSync}>Cancel sync</button></div>}
    </section>}
    {sync.busy && <div className="workspace-sync-shield" aria-label="Editing paused during synchronization" />}
  </>
}
