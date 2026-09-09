import { polygonBounds, wallLength } from './geometry'
import { roofSegmentRidgeElevation } from './roofs'
import type { BuildingModel, RoofSegmentModel, Vec2 } from './types'

/** A gable section uses x across the facade and z for elevation. Hosted panels follow the supplied building's doors. */
export function gableGlazingProfile(segment: RoofSegmentModel, side: 'min' | 'max', building?: BuildingModel) {
  const glazing = segment.gableGlazing?.[side]
  if (!glazing || segment.type !== 'gable') return null
  const bounds = polygonBounds(segment.footprint)
  const min = segment.ridgeDirection === 'z' ? bounds.minX : bounds.minZ
  const max = segment.ridgeDirection === 'z' ? bounds.maxX : bounds.maxZ
  const span = max - min; const center = (min + max) / 2
  const base = segment.baseElevationM; const ridge = roofSegmentRidgeElevation(segment)
  let claddingBase = base
  const storey = building?.storeys.find((s) => s.ref === segment.storeyRef)
  if (storey?.kneeWallHeightM !== undefined && building) {
    const along = segment.ridgeDirection === 'z' ? 'z' : 'x'
    const face = along === 'z' ? (side === 'min' ? bounds.minZ : bounds.maxZ) : (side === 'min' ? bounds.minX : bounds.maxX)
    const across = along === 'z' ? 'x' : 'z'
    const walls = building.walls.filter((wall) => storey.wallRefs.includes(wall.ref) && Math.abs(wall.start[along] - face) < 0.01 && Math.abs(wall.end[along] - face) < 0.01 && Math.min(wall.start[across], wall.end[across]) < max && Math.max(wall.start[across], wall.end[across]) > min)
    claddingBase = Math.max(base, ...walls.map((wall) => wall.baseElevationM + wall.heightM))
  }
  const bottom = claddingBase + 0.03
  const topAt = (x: number) => ridge - Math.abs(x - center) * (ridge - base) / (span / 2) - glazing.roofInsetM
  const ranges = glazing.hostOpeningRefs ? glazing.hostOpeningRefs.flatMap((ref) => {
    const wall = building?.walls.find((wall) => wall.openings.some((opening) => opening.ref === ref))
    const opening = wall?.openings.find((opening) => opening.ref === ref)
    if (!wall || !opening || wallLength(wall) === 0) return []
    const across = segment.ridgeDirection === 'z' ? 'x' : 'z'
    const along = across === 'x' ? 'z' : 'x'
    const face = along === 'z' ? (side === 'min' ? bounds.minZ : bounds.maxZ) : (side === 'min' ? bounds.minX : bounds.maxX)
    if (Math.abs(wall.start[along] - face) > 0.01 || Math.abs(wall.end[along] - face) > 0.01) return []
    const midpoint = wall.start[across] + (wall.end[across] - wall.start[across]) * opening.offsetM / wallLength(wall)
    return [{ left: midpoint - opening.widthM / 2, right: midpoint + opening.widthM / 2, dividedDoor: opening.kind === 'door' && Boolean(opening.glazed) }]
  }) : [{ left: min + span * glazing.from, right: min + span * glazing.to, dividedDoor: false }]
  const panels = ranges.flatMap(({ left, right, dividedDoor }) => {
    if (left <= min || right >= max || topAt(left) <= bottom || topAt(right) <= bottom) return []
    const opening: Vec2[] = [{ x: left, z: bottom }, { x: right, z: bottom }, { x: right, z: topAt(right) }]
    if (left < center && right > center) opening.push({ x: center, z: topAt(center) })
    opening.push({ x: left, z: topAt(left) })
    const width = right - left
    // Continue the lower balcony door's central division, even for a narrow two-leaf door.
    const divisions = dividedDoor ? [0.5] : width > 5 ? [1 / 3, 2 / 3] : width > 2.6 ? [0.5] : []
    return [{ opening, mullions: divisions.map((fraction) => ({ x: left + width * fraction, bottom, top: topAt(left + width * fraction) })) }]
  })
  const inset = claddingBase > base ? (claddingBase - base) / Math.max(0.0001, Math.tan(segment.pitchDegrees * Math.PI / 180)) : 0
  return { outline: [{ x: min + inset, z: claddingBase }, { x: max - inset, z: claddingBase }, { x: center, z: ridge }], panels }
}
