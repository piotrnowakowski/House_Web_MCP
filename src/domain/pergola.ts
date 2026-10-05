import { polygonBounds } from './geometry'
import type { RoofSegmentModel, Vec3 } from './types'

export interface PergolaMember { centre: Vec3; size: Vec3; yaw: number; timber: boolean }

/** The same open frame is used for rendering and sunlight; there is no opaque roof panel. */
export function pergolaMembers(segment: RoofSegmentModel): PergolaMember[] {
  const canopy = segment.canopy
  if (!canopy?.slats) return []
  const { slats } = canopy
  const bounds = polygonBounds(segment.footprint)
  const top = segment.baseElevationM + 0.24
  const beamHeight = canopy.fasciaHeightM
  const members: PergolaMember[] = []
  for (const index of canopy.fasciaEdgeIndices) {
    const a = segment.footprint[index], b = segment.footprint[(index + 1) % segment.footprint.length]
    members.push({ centre: { x: (a.x + b.x) / 2, y: top - beamHeight / 2, z: (a.z + b.z) / 2 },
      size: { x: Math.hypot(b.x - a.x, b.z - a.z), y: beamHeight, z: canopy.postWidthM }, yaw: -Math.atan2(b.z - a.z, b.x - a.x), timber: false })
  }
  const postHeight = top - beamHeight - canopy.postBaseElevationM
  for (const post of canopy.posts) members.push({ centre: { ...post, y: canopy.postBaseElevationM + postHeight / 2 },
    size: { x: canopy.postWidthM, y: postHeight, z: canopy.postWidthM }, yaw: 0, timber: false })
  const alongX = slats.direction === 'x'
  const min = alongX ? bounds.minZ : bounds.minX, max = alongX ? bounds.maxZ : bounds.maxX
  const count = Math.max(1, Math.floor((max - min) / slats.spacingM))
  for (let i = 0; i < count; i++) {
    const offset = min + (i + 0.5) * (max - min) / count
    members.push({ centre: { x: alongX ? (bounds.minX + bounds.maxX) / 2 : offset, y: top - beamHeight / 2, z: alongX ? offset : (bounds.minZ + bounds.maxZ) / 2 },
      size: { x: alongX ? bounds.maxX - bounds.minX : slats.widthM, y: beamHeight, z: alongX ? slats.widthM : bounds.maxZ - bounds.minZ }, yaw: 0, timber: true })
  }
  return members
}
