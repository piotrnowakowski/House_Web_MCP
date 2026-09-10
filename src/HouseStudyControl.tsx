import { CarFront, Check, House, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CARPORT_STUDY_REF, HOUSE_STUDY_REF, openHouseStudy } from './services/houseStudies'
import { useStudioStore } from './state/store'
import './house-studies.css'

/** The chooser overlays the canvas; each alternative has its own persisted working copy. */
export function HouseStudyControl() {
  const projectRef = useStudioStore((state) => state.project.ref)
  const dialog = useRef<HTMLDialogElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (![HOUSE_STUDY_REF, CARPORT_STUDY_REF].includes(projectRef)) return null
  const select = async (ref: string) => {
    setBusy(true); setError('')
    try { await openHouseStudy(ref); dialog.current?.close() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not open this house.') }
    finally { setBusy(false) }
  }
  return <>
    <button className='house-study-toggle' aria-label='House variants' aria-haspopup='dialog' aria-pressed={projectRef === CARPORT_STUDY_REF}
      title='House variants · carport' onClick={() => dialog.current?.showModal()}><CarFront size={20} /></button>
    {createPortal(<dialog ref={dialog} className='house-study-dialog' aria-labelledby='house-study-title'
      onClick={(event) => { if (event.target === event.currentTarget && !busy) dialog.current?.close() }}
      onCancel={(event) => { if (busy) event.preventDefault() }}>
      <header><h2 id='house-study-title'>House variants</h2><button aria-label='Close house variants' disabled={busy} onClick={() => dialog.current?.close()}><X size={20} /></button></header>
      <p>Separate projects. Your edits are saved when you switch.</p>
      <div className='house-study-options' aria-busy={busy}>
        <button disabled={busy} aria-pressed={projectRef === HOUSE_STUDY_REF} onClick={() => void select(HOUSE_STUDY_REF)}>
          <House size={23} /><span><strong>Current house</strong><small>Original layout and garage terrace</small></span>{projectRef === HOUSE_STUDY_REF && <Check size={18} />}
        </button>
        <button disabled={busy} aria-pressed={projectRef === CARPORT_STUDY_REF} onClick={() => void select(CARPORT_STUDY_REF)}>
          <CarFront size={23} /><span><strong>zielonki v2 · Carport</strong><small>2 cars · side pergola · new ground floor</small></span>{projectRef === CARPORT_STUDY_REF && <Check size={18} />}
        </button>
      </div>
      <p className='house-study-note'>Carport concept: approximately 4 m from the road parcel edge. The statutory building line and vehicle access still require verification. Five conflicting trees are proposed removals in this alternative.</p>
      {error && <p role='alert'>{error}</p>}
      {busy && <p role='status'>Saving and opening…</p>}
    </dialog>, document.body)}
  </>
}
