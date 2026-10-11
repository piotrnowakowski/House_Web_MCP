import { useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStudioStore } from '../state/store'
import { recoveryWorkspace, retryAutosave, useSaveStatus } from '../services/autosave'
import { exportTransfer, importTransfer, transferWorkspace, useSyncStatus } from '../services/mikrusSync'
import { WorkspaceSaveStatus, useWorkspaceSyncPanel } from './WorkspaceSaveStatus'
import './workspaceSync.css'

export function WorkspaceSync() {
 const save=useSaveStatus(),sync=useSyncStatus()
 const state=useStudioStore(useShallow(s=>({hydrated:s.hydrated})))
 const open=useWorkspaceSyncPanel(s=>s.open)
 const setOpen=(open:boolean)=>useWorkspaceSyncPanel.setState({open})
 const [recoveryError,setRecoveryError]=useState('')
 const [recovering,setRecovering]=useState(false)
 const input=useRef<HTMLInputElement>(null)
 const recover=async(action:()=>Promise<void>)=>{
   setRecovering(true);setRecoveryError('')
   try{await action()}catch(error){setRecoveryError(error instanceof Error?error.message:'Nie udało się odzyskać projektu.')}
   finally{setRecovering(false)}
 }
 const download=async()=>{
   // Do not flush first: a failed transaction is precisely why this export is needed.
   const transfer=await exportTransfer(recoveryWorkspace()??undefined)
   const url=URL.createObjectURL(new Blob([JSON.stringify(transfer,null,2)],{type:'application/json'}))
   const link=document.createElement('a');link.href=url;link.download='house-workspace-recovery.json';link.click()
   window.setTimeout(()=>URL.revokeObjectURL(url),1000)
 }
 return <>
  <WorkspaceSaveStatus className="workspace-save-bar" />
  {(open||sync.busy)&&<section className="workspace-sync-panel" role="dialog" aria-label="Zapis i synchronizacja projektu">
   <header><h2>Zapis i synchronizacja</h2><button disabled={sync.busy} onClick={()=>setOpen(false)} aria-label="Zamknij zapis i synchronizację">×</button></header>
   <p>Zmiany są automatycznie zapisywane na tym urządzeniu.</p>
   {save.error&&<section className="workspace-recovery" aria-label="Odzyskiwanie niezapisanych zmian">
     <p role="alert">{save.error}</p>
     <p>Najpierw pobierz kopię niezapisanych zmian. Przy konflikcie z inną kartą odśwież stronę, a następnie zaimportuj kopię, aby świadomie wybrać zachowaną wersję.</p>
     <button disabled={recovering||sync.busy} onClick={()=>void recover(download)}>Eksportuj kopię odzyskiwania</button>
     <button disabled={recovering||sync.busy} onClick={()=>void recover(retryAutosave)}>Ponów zapis lokalny</button>
   </section>}
   <button disabled={!state.hydrated||recovering||sync.busy} onClick={()=>void recover(download)}>Pobierz kopię projektu i propozycji</button>
   <button disabled={recovering||sync.busy||save.phase==='error'} onClick={()=>input.current?.click()}>Importuj kopię odzyskiwania</button>
   <input ref={input} hidden type="file" accept="application/json,.json" aria-label="Plik kopii odzyskiwania" onChange={event=>{
     const file=event.target.files?.[0];event.target.value=''
     if(file)void recover(async()=>{await importTransfer(JSON.parse(await file.text()))})
   }}/>
   <button disabled={!state.hydrated||sync.busy||recovering} onClick={()=>void transferWorkspace('get')}>Pobierz z Mikrusa</button>
   <p>Wczytaj na to urządzenie wersję projektu z Mikrusa.</p>
   <button disabled={!state.hydrated||sync.busy||recovering} onClick={()=>void transferWorkspace('push')}>Wyślij do Mikrusa</button>
   <p>Wyślij wersję projektu z tego urządzenia do Mikrusa.</p>
   {sync.message && <p role="status">{sync.message}</p>}
   {recoveryError&&<p role="alert">{recoveryError}</p>}
  </section>}
  {sync.busy&&<div className="workspace-sync-shield" aria-label="Edycja wstrzymana podczas synchronizacji"/>}
 </>
}
