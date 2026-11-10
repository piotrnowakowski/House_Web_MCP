import { atticWallProfile } from '../domain/attic'
import { wallLength } from '../domain/geometry'
import type { BuildingModel, WallFaceFinish, WallModel } from '../domain/types'

export const wallLiningDepthM = .016

/** The finish can meet the roof at its inner face without changing the structural wall height. */
export function wallFinishProfiles(building: BuildingModel, wall: WallModel) {
  return Object.fromEntries((['left', 'right'] as const).flatMap(side => {
    if (!wall.faceFinishes?.[side]?.followRoof) return []
    const length = wallLength(wall), offset = (side === 'left' ? 1 : -1) * (wall.thicknessM / 2 + wallLiningDepthM)
    const dx = -(wall.end.z - wall.start.z) / length * offset, dz = (wall.end.x - wall.start.x) / length * offset
    const profile = atticWallProfile(building, { ...wall, heightM: Infinity, start: { x: wall.start.x + dx, z: wall.start.z + dz }, end: { x: wall.end.x + dx, z: wall.end.z + dz } })
    // Wall rendering is raised 25 mm; the ceiling lining sits 15 mm below the roof.
    return [[side, profile?.map(p => ({ ...p, z: p.z - .04 }))]]
  }))
}

export interface WallPiece { start: number; end: number; height: number; base?: number }

/** Clip the lining, never its host wall or openings. Extend solid lower edges over the slab fascia. */
export function wallFinishPieces(pieces: WallPiece[], finish: WallFaceFinish, fullHeight: boolean): WallPiece[] {
  return pieces.flatMap(piece => {
    const start = Math.max(piece.start, finish.spanM?.[0] ?? 0)
    const end = Math.min(piece.end, finish.spanM?.[1] ?? Infinity)
    if (end <= start) return []
    const extension = fullHeight && !(piece.base ?? 0) ? finish.baseExtensionM ?? 0 : 0
    return [{ ...piece, start, end, base: (piece.base ?? 0) - extension, height: piece.height + extension }]
  })
}
