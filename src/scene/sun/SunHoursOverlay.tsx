import { useEffect, useMemo } from 'react'
import { Color, DataTexture, DoubleSide, NearestFilter, RGBAFormat, SRGBColorSpace } from 'three'
import { elevationAt } from '../../domain/geometry'
import { analyzeSunlight, resolveSunTarget } from '../../domain/sunlight'
import { useStudioStore } from '../../state/store'

const DARK = new Color('#1d2a38'); const MID = new Color('#6e9a4a'); const BRIGHT = new Color('#f2e27a')
export const sunHoursColor = (fraction: number) => {
  const colour = fraction < 0.5 ? DARK.clone().lerp(MID, fraction * 2) : MID.clone().lerp(BRIGHT, (fraction - 0.5) * 2)
  return `#${colour.getHexString()}`
}

/** Ground heatmap of direct sun hours drawn from the same grid the WebMCP analysis returns. Editor overlay only. */
export function SunHoursOverlay() {
  const project = useStudioStore((state) => state.project)
  const overlay = useStudioStore((state) => state.sunOverlay)
  const month = useStudioStore((state) => state.sunTime.month)
  const day = useStudioStore((state) => state.sunTime.day)
  const setSunOverlay = useStudioStore((state) => state.setSunOverlay)
  const setToast = useStudioStore((state) => state.setToast)
  useEffect(() => {
    if (!overlay.enabled) return
    try {
      const target = resolveSunTarget(project, overlay.targetRef ?? 'site', undefined)
      setSunOverlay({ result: analyzeSunlight(project, { target, month, day, cellM: 0.5, stepMinutes: 30, includeGrid: true }) })
    } catch (error) { setToast(error instanceof Error ? error.message : 'Sun-hours analysis failed.'); setSunOverlay({ enabled: false, result: null }) }
  }, [day, month, overlay.enabled, overlay.targetRef, project, setSunOverlay, setToast])
  const grid = overlay.enabled ? overlay.result?.grid : undefined
  const daylight = overlay.result?.daylightHours ?? 1
  const texture = useMemo(() => {
    if (!grid) return null
    const data = new Uint8Array(grid.width * grid.height * 4)
    const peak = Math.max(0.5, ...grid.hours.filter((value) => value >= 0), 0)
    for (let row = 0; row < grid.height; row += 1) for (let column = 0; column < grid.width; column += 1) {
      const value = grid.hours[(grid.height - 1 - row) * grid.width + column]
      const offset = (row * grid.width + column) * 4
      if (value < 0) { data[offset + 3] = 0; continue }
      const colour = new Color(sunHoursColor(Math.min(1, value / Math.max(peak, daylight * 0.999))))
      data[offset] = Math.round(colour.r * 255); data[offset + 1] = Math.round(colour.g * 255); data[offset + 2] = Math.round(colour.b * 255); data[offset + 3] = 205
    }
    const created = new DataTexture(data, grid.width, grid.height, RGBAFormat)
    created.colorSpace = SRGBColorSpace; created.magFilter = NearestFilter; created.minFilter = NearestFilter; created.needsUpdate = true
    return created
  }, [daylight, grid])
  useEffect(() => () => texture?.dispose(), [texture])
  if (!grid || !texture) return null
  const width = grid.width * grid.cellM; const depth = grid.height * grid.cellM
  const centreX = grid.originX + width / 2; const centreZ = grid.originZ + depth / 2
  return <mesh position={[centreX, elevationAt(project, centreX, centreZ) + 0.07, centreZ]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={6} userData={{ editorOnly: true, sunOverlay: true }}>
    <planeGeometry args={[width, depth]} />
    <meshBasicMaterial map={texture} transparent depthWrite={false} side={DoubleSide} />
  </mesh>
}
