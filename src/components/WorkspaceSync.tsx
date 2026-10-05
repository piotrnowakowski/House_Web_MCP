import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStudioStore } from '../state/store'
import { useSaveStatus } from '../services/autosave'
import { transferWorkspace, useSyncStatus } from '../services/mikrusSync'
import './workspaceSync.css'

export function WorkspaceSync() {
 const save=useSaveStatus(),sync=useSyncStatus()
 const state=useStudioStore(useShallow(s=>({hydrated:s.hydrated})))
 const [open,setOpen]=useState(false)
 return <>
  <aside className="workspace-save-bar" aria-label="Workspace saving and synchronization">
   <span role="status">{!state.hydrated?'Choose a project':save.phase==='error'?'Save failed':save.phase==='saving'?'Saving locally…':'Saved locally'}</span>
   <button onClick={()=>setOpen(!open)} aria-expanded={open}>Save & sync</button>
  </aside>
  {(open||sync.busy)&&<section className="workspace-sync-panel" role="dialog" aria-label="Save and synchronize workspace">
   <header><h2>Save & sync</h2><button disabled={sync.busy} onClick={()=>setOpen(false)} aria-label="Close save and sync">×</button></header>
   <p>Your changes are saved on this device automatically.</p>
   <button disabled={!state.hydrated||sync.busy} onClick={()=>void transferWorkspace('get')}>Get from Mikrus</button>
   <p>Load the Mikrus version of this project onto this device.</p>
   <button disabled={!state.hydrated||sync.busy} onClick={()=>void transferWorkspace('push')}>Push to Mikrus</button>
   <p>Send this device’s version of the project to Mikrus.</p>
   {sync.message && <p role="status">{sync.message}</p>}
   {save.error&&<p role="alert">{save.error}</p>}
  </section>}
  {sync.busy&&<div className="workspace-sync-shield" aria-label="Editing paused during synchronization"/>}
 </>
}
