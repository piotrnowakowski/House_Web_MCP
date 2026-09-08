import { polygonBounds } from './geometry'
import { roofSegmentRidgeElevation } from './roofs'
import type { RoofSegmentModel, Vec2 } from './types'

/** A gable section uses x across the facade and z for elevation, in metres. */
export function gableGlazingProfile(segment: RoofSegmentModel, side: 'min' | 'max') {
  const glazing = segment.gableGlazing?.[side]
  if (!glazing || segment.type !== 'gable') return null
  const bounds = polygonBounds(segment.footprint)
  const min = segment.ridgeDirection === 'z' ? bounds.minX : bounds.minZ
  const max = segment.ridgeDirection === 'z' ? bounds.maxX : bounds.maxZ
  const span = max - min; const center = (min + max) / 2
  const base = segment.baseElevationM; const ridge = roofSegmentRidgeElevation(segment)
  const left = min + span * glazing.from; const right = min + span * glazing.to
  const bottom = base + 0.03
  const topAt = (x: number) => ridge - Math.abs(x - center) * (ridge - base) / (span / 2) - glazing.roofInsetM
  if (topAt(left) <= bottom || topAt(right) <= bottom) return null
  const opening: Vec2[] = [{ x: left, z: bottom }, { x: right, z: bottom }, { x: right, z: topAt(right) }]
  if (left < center && right > center) opening.push({ x: center, z: topAt(center) })
  opening.push({ x: left, z: topAt(left) })
  const width = right - left
  // Match the rectangular glazing's two/three-pane division below this gable.
  const divisions = width > 5 ? [1 / 3, 2 / 3] : width > 2.6 ? [0.5] : []
  return { outline: [{ x: min, z: base }, { x: max, z: base }, { x: center, z: ridge }], opening,
    mullions: divisions.map((fraction) => ({ x: left + width * fraction, bottom, top: topAt(left + width * fraction) })) }
}
