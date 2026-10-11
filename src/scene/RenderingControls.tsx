import { useRenderingPreferences, type RenderQuality } from './renderingPreferences'

export function RenderingControls() {
  const quality = useRenderingPreferences(state => state.quality)
  const setQuality = useRenderingPreferences(state => state.setQuality)
  return <label className="rendering-controls">Jakość widoku <select aria-label="Jakość widoku" value={quality} onChange={event => setQuality(event.target.value as RenderQuality)}>
    <option value="auto">Automatyczna</option><option value="fast">Szybka</option><option value="detailed">Szczegółowa</option>
  </select></label>
}
