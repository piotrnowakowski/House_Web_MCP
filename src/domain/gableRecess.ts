import { polygonBounds } from './geometry'
import type { BuildingModel, RoofSegmentModel } from './types'

/** A single lining edge across storeys, including slightly staggered facade walls. */
export function recessSideLayout(building: BuildingModel, segment: RoofSegmentModel, side: 'min' | 'max') {
  const recess = segment.gableRecess![side]!
  const bounds = polygonBounds(segment.footprint)
  const alongZ = segment.ridgeDirection === 'z'
  const along = alongZ ? 'z' : 'x'; const across = alongZ ? 'x' : 'z'
  const min = alongZ ? bounds.minX : bounds.minZ; const max = alongZ ? bounds.maxX : bounds.maxZ
  const outward = side === 'min' ? -1 : 1
  const edge = alongZ ? (side === 'min' ? bounds.minZ : bounds.maxZ) : (side === 'min' ? bounds.minX : bounds.maxX)
  const facade = edge - outward * recess.depthM
  const hosts = building.walls.filter(w => Math.abs(w.start[along] - facade) <= w.thicknessM / 2 + .001
    && Math.abs(w.end[along] - facade) <= w.thicknessM / 2 + .001
    && Math.min(w.start[across], w.end[across]) < max && Math.max(w.start[across], w.end[across]) > min)
  const inner = outward * Math.min(outward * facade, ...hosts.map(w => outward * w.start[along] - w.thicknessM / 2))
  // Cover the wall ends, with 2 mm clearance on either face to avoid coplanar surfaces.
  const thickness = Math.max(.2, ...hosts.map(w => w.thicknessM)) + .004
  return { center: (edge + inner) / 2, depth: Math.abs(edge - inner), thickness, inner, edge }
}

/** Centred vertical-board positions using the same 34 cm rhythm as charred timber walls. */
export function recessSideBattenOffsets(depth: number, spacing = .34) {
  const count = Math.max(1, Math.floor(depth / spacing))
  return Array.from({ length: count }, (_, index) => (index - (count - 1) / 2) * spacing)
}

export function gableFrameBottom(segment: RoofSegmentModel, side: 'min' | 'max', wallBottom: number) {
  return segment.gableRecess?.[side]?.baseElevationM ?? wallBottom
}
