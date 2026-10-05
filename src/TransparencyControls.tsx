import { Blend, RotateCcw } from 'lucide-react'
import { useStudioStore } from './state/store'

export function TransparencyControls() {
  const active = useStudioStore(state => state.transparencyMode)
  const count = useStudioStore(state => state.transparentRefs.length)
  const setMode = useStudioStore(state => state.setTransparencyMode)
  const reset = useStudioStore(state => state.resetTransparency)
  return <div className="transparency-controls" role="group" aria-label="Object transparency">
    <button className={active ? 'active' : ''} aria-label="Make objects transparent" aria-pressed={active} title="Click objects to see through them; drag to orbit" onClick={() => setMode(!active)}>
      <Blend size={16} /><span>Transparent</span>{count > 0 && <b>{count}</b>}
    </button>
    <button aria-label="Reset object transparency" title="Restore all transparent objects" disabled={!count} onClick={reset}><RotateCcw size={16} /><span>Reset</span></button>
  </div>
}
