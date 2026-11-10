import type { WindowStudy } from './windowStudy'

export function WindowSwitch({ withWindow, onChange, study }: { withWindow: boolean; onChange: (value: boolean) => void; study: WindowStudy }) {
  return <div className="window-switch" role="group" aria-label="Wariant widoczny na planie i w 360°">
    {[false, true].map(value => <button type="button" key={String(value)} aria-pressed={withWindow === value} onClick={() => onChange(value)}>
      {value ? (study.originalHasWindow ? 'Z bocznym oknem' : 'Z oknem dachowym') : (study.originalHasWindow ? 'Bez bocznego okna' : 'Bez dachowego')}
    </button>)}
  </div>
}

export interface WindowResult { bands: Uint8Array | null; reading: {level: number; direct: boolean} | null; coverage: {bright: number; direct: number} | null }

export function WindowResults({ study, without, withGlass }: { study: WindowStudy; without: WindowResult; withGlass: WindowResult }) {
  const columns = [without, withGlass]
  const base = without.bands, trial = withGlass.bands
  const improved = base?.length && trial?.length === base.length
    ? Math.round(100 * trial.reduce((count, band, i) => count + Number(band > base[i]), 0) / base.length)
    : null
  return <div className="window-results">
    <p className="window-gain">{improved === null ? 'Obliczanie obu wariantów…' : <>Z oknem jaśniej o co najmniej 1 stopień na <strong>{improved}%</strong> powierzchni.</>}</p>
    <table aria-label="Porównanie światła bez okna i z oknem"><thead><tr><th scope="col">{study.roomLabel}</th><th scope="col">Bez okna</th><th scope="col">Z oknem</th></tr></thead>
      <tbody>
        <tr><th scope="row">Zaznaczony punkt</th>{columns.map((r, i) => <td key={i}>{r.reading ? r.reading.level + '/10' : '…'}</td>)}</tr>
        <tr><th scope="row">Powierzchnia ≥ 6/10</th>{columns.map((r, i) => <td key={i}>{r.coverage ? r.coverage.bright + '%' : '…'}</td>)}</tr>
        <tr><th scope="row">Powierzchnia w słońcu</th>{columns.map((r, i) => <td key={i}>{r.coverage ? r.coverage.direct + '%' : '…'}</td>)}</tr>
      </tbody></table>
    <small>Ta sama godzina i siatka punktów 80 cm nad podłogą. Granat oznacza 0/10, a pomarańcz 10/10. Model zakłada bezchmurne niebo.</small>
  </div>
}
