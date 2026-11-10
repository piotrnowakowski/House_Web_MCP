import { Blend, RotateCcw } from 'lucide-react'
import { useStudioStore } from './state/store'

export function TransparencyControls({ onActivate, disabled = false }: { onActivate?: () => void; disabled?: boolean }) {
  const active = useStudioStore(state => state.transparencyMode)
  const count = useStudioStore(state => state.transparentRefs.length)
  const setMode = useStudioStore(state => state.setTransparencyMode)
  const reset = useStudioStore(state => state.resetTransparency)
  return <div className="transparency-controls" role="group" aria-label="Przezroczystość elementów">
    <button disabled={disabled} className={active ? 'active' : ''} aria-label="Przezroczystość" aria-pressed={active} title="Włącz i wskaż element, aby całkowicie go ukryć. Przeciągnij, aby obrócić widok." onClick={() => { if (!active) onActivate?.(); setMode(!active) }}>
      <Blend size={16} /><span>Przezroczystość</span>{count > 0 && <b>{count}</b>}
    </button>
    <button aria-label="Przywróć widoczność" title="Przywróć widoczność wszystkich elementów" disabled={!count} onClick={reset}><RotateCcw size={16} /><span>Przywróć</span></button>
  </div>
}
