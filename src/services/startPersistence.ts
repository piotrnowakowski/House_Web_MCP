import { useStudioStore } from '../state/store'
import { captureWorkspace, hasUnsavedChanges } from './autosave'

export function startPersistence() {
  const initial = useStudioStore.getState()
  if (initial.hydrated) captureWorkspace({ version: 1, project: initial.project, proposals: initial.proposals, draftChangeSets: initial.draftChangeSets })
  const unsubscribe = useStudioStore.subscribe((state, previous) => {
    if (state.hydrated && (!previous.hydrated || state.project !== previous.project || state.proposals !== previous.proposals || state.draftChangeSets !== previous.draftChangeSets)) {
      captureWorkspace({ version: 1, project: state.project, proposals: state.proposals, draftChangeSets: state.draftChangeSets })
    }
  })
  const beforeUnload = (event: BeforeUnloadEvent) => { if (hasUnsavedChanges()) { event.preventDefault(); event.returnValue = '' } }
  window.addEventListener('beforeunload', beforeUnload)
  return () => { unsubscribe(); window.removeEventListener('beforeunload', beforeUnload) }
}
