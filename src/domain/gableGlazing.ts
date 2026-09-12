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
    return [{ left: midpoint - opening.widthM / 2, right: midpoint + opening.widthM / 2, dividedDoor: opening.kind === 'door' && Boolean(opening.glazed), divisions: opening.mullionFractions, hostRef: opening.ref, connected: Boolean(glazing.continuousWithHost && glazing.shape !== 'triangle' && Math.abs(wall.baseElevationM + opening.sillM + opening.heightM - claddingBase) < 0.001) }]
  }) : [{ left: min + span * glazing.from, right: min + span * glazing.to, dividedDoor: false, divisions: undefined, hostRef: undefined, connected: false }]
  const panels = ranges.flatMap(({ left: hostLeft, right: hostRight, dividedDoor, divisions: explicitDivisions, hostRef, connected }) => {
    const bottom = claddingBase + (connected ? 0.001 : 0.03)
    // Narrower variants can put a host jamb beyond the usable upper gable.
    // Fit triangle bases to the inset roof instead of dropping the entire window.
    const clearHalfSpan = (ridge - glazing.roofInsetM - bottom) / ((ridge - base) / (span / 2))
    const left = glazing.shape === 'triangle' ? Math.max(hostLeft, center - clearHalfSpan + 0.001) : hostLeft
    const right = glazing.shape === 'triangle' ? Math.min(hostRight, center + clearHalfSpan - 0.001) : hostRight
    if (right <= left) return []
    if (left <= min || right >= max || topAt(left) <= bottom || topAt(right) <= bottom) return []
    // Mirrored triangles peak toward the ridge, inside the original roof-following pane.
    const peakX = Math.max(left, Math.min(right, center))
    const panelTopAt = glazing.shape === 'triangle' ? (x: number) => {
      const fraction = x <= peakX && peakX > left ? (x - left) / (peakX - left)
        : peakX < right ? (right - x) / (right - peakX) : 1
      return bottom + (topAt(peakX) - bottom) * fraction
    } : topAt
    const opening: Vec2[] = glazing.shape === 'triangle'
      ? [{ x: left, z: bottom }, { x: right, z: bottom }, { x: peakX, z: topAt(peakX) }]
      : [{ x: left, z: bottom }, { x: right, z: bottom }, { x: right, z: topAt(right) },
        ...(left < center && right > center ? [{ x: center, z: topAt(center) }] : []), { x: left, z: topAt(left) }]
    const width = right - left
    // Continue the lower balcony door's central division, even for a narrow two-leaf door.
    const divisions = explicitDivisions ?? (dividedDoor ? [0.5] : width > 5 ? [1 / 3, 2 / 3] : width > 2.6 ? [0.5] : [])
    const transoms = (glazing.transomElevationsM ?? []).flatMap((elevation) => {
      if (elevation <= bottom) return []
      const intersections = opening.flatMap((a, i) => {
        const b = opening[(i + 1) % opening.length]
        if (elevation < Math.min(a.z, b.z) || elevation >= Math.max(a.z, b.z)) return []
        return [a.x + (b.x - a.x) * (elevation - a.z) / (b.z - a.z)]
      }).sort((a, b) => a - b)
      return intersections.length === 2 ? [[{ x: intersections[0], z: elevation }, { x: intersections[1], z: elevation }]] : []
    })
    return [{ opening, hostRef, connected, transoms, mullions: divisions.map((fraction) => ({ x: left + width * fraction, bottom, top: panelTopAt(left + width * fraction) })) }]
  })
  const inset = claddingBase > base ? (claddingBase - base) / Math.max(0.0001, Math.tan(segment.pitchDegrees * Math.PI / 180)) : 0
  return { outline: [{ x: min + inset, z: claddingBase }, { x: max - inset, z: claddingBase }, { x: center, z: ridge }], panels }
}
