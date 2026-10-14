import { useStudioStore } from '../state/store'
import { captureWorkspace, hasUnsavedChanges } from './autosave'

export function startPersistence() {
  const initial = useStudioStore.getState()
  if (initial.hydrated) captureWorkspace({ version: 1, project: initial.project, proposals: initial.proposals, draftChangeSets: initial.draftChangeSets }, { history: initial.history, future: initial.future })
  const unsubscribe = useStudioStore.subscribe((state, previous) => {
    if (state.hydrated && (!previous.hydrated || state.project !== previous.project || state.proposals !== previous.proposals || state.draftChangeSets !== previous.draftChangeSets || state.history !== previous.history || state.future !== previous.future)) {
      captureWorkspace({ version: 1, project: state.project, proposals: state.proposals, draftChangeSets: state.draftChangeSets }, { history: state.history, future: state.future })
    }
  })
  const beforeUnload = (event: BeforeUnloadEvent) => { if (hasUnsavedChanges()) { event.preventDefault(); event.returnValue = '' } }
  window.addEventListener('beforeunload', beforeUnload)
  return () => { unsubscribe(); window.removeEventListener('beforeunload', beforeUnload) }
}
