import { create } from 'zustand'
import { useStudioStore } from '../state/store'
import { useSaveStatus } from '../services/autosave'

export const useWorkspaceSyncPanel = create(() => ({ open: false }))

export function WorkspaceSaveStatus({ className }: { className: string }) {
  const save = useSaveStatus()
  const hydrated = useStudioStore(state => state.hydrated)
  const open = useWorkspaceSyncPanel(state => state.open)
  return <aside className={className} aria-label="Zapis i synchronizacja projektu" data-save-phase={save.phase}>
    <span role="status">{!hydrated ? 'Wybierz projekt' : save.phase === 'error' ? 'Błąd zapisu' : save.phase === 'saving' ? 'Zapisywanie lokalnie…' : 'Zapisano lokalnie'}</span>
    <button onClick={() => useWorkspaceSyncPanel.setState({ open: !open })} aria-expanded={open}>Zapis i synchronizacja</button>
  </aside>
}
