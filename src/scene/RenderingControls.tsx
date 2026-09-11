import { useRenderingPreferences, type RenderQuality } from './renderingPreferences'

export function RenderingControls() {
  const quality = useRenderingPreferences(state => state.quality)
  const setQuality = useRenderingPreferences(state => state.setQuality)
  return <label className="rendering-controls">View quality <select aria-label="View quality" value={quality} onChange={event => setQuality(event.target.value as RenderQuality)}>
    <option value="auto">Automatic</option><option value="fast">Fast</option><option value="detailed">Detailed</option>
  </select></label>
}
