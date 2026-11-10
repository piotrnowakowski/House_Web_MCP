import { atticWallProfile, wallProfileHeightAt } from '../domain/attic'
import { wallLength } from '../domain/geometry'
import type { BuildingModel, Vec2, WallFaceFinish, WallModel } from '../domain/types'

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

/** Solid wall intervals, including the head above an opening at full height. */
export function wallSurfacePieces(wall: WallModel, height: number, fullHeight: boolean): WallPiece[] {
  const length = wallLength(wall)
  const openings = [...wall.openings].sort((a, b) => a.offsetM - b.offsetM)
  let cursor = 0
  const pieces: WallPiece[] = []
  for (const opening of openings) {
    const start = Math.max(cursor, opening.offsetM - opening.widthM / 2); const end = Math.min(length, opening.offsetM + opening.widthM / 2)
    if (start > cursor) pieces.push({ start: cursor, end: start, height })
    if (opening.kind === 'window' && opening.sillM > 0) pieces.push({ start, end, height: Math.min(height, opening.sillM) })
    if (fullHeight && opening.sillM + opening.heightM < height) pieces.push({ start, end, height: height - opening.sillM - opening.heightM, base: opening.sillM + opening.heightM })
    cursor = end
  }
  if (cursor < length) pieces.push({ start: cursor, end: length, height })
  return pieces
}

export function wallPieceOutline(piece: WallPiece, cap: Vec2[] | undefined, fullHeight: boolean): Vec2[] | undefined {
    if (!fullHeight || !cap) return undefined
    const base = piece.base ?? 0, top = base + piece.height, middle = (piece.start + piece.end) / 2
    const xs = new Set([piece.start, piece.end, ...cap.filter((p) => p.x > piece.start && p.x < piece.end).map((p) => p.x)])
    for (let i = 1; i < cap.length; i++) {
      const a = cap[i - 1], b = cap[i]
      if ((a.z - top) * (b.z - top) < 0) { const x = a.x + (b.x - a.x) * (top - a.z) / (b.z - a.z); if (x > piece.start && x < piece.end) xs.add(x) }
    }
    return [{ x: piece.start - middle, z: -piece.height / 2 }, { x: piece.end - middle, z: -piece.height / 2 },
      ...[...xs].sort((a, b) => b - a).map((x) => ({ x: x - middle, z: Math.max(base, Math.min(top, wallProfileHeightAt(cap, x))) - base - piece.height / 2 }))]
}
