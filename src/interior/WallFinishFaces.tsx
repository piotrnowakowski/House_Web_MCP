import { useEffect, useMemo } from 'react'
import { PlaneGeometry, Shape, ShapeGeometry, Vector2 } from 'three'
import type { InteriorFinish, Vec2, WallModel } from '../domain/types'
import { FinishMaterial } from './FinishMaterial'
import { wallFinishPieces, wallPieceOutline, wallLiningDepthM, type WallPiece } from './wallFinishPieces'

export function WallFace({ width, height, finish, outline, elevation = 0 }: { width: number; height: number; finish: InteriorFinish; outline?: Vec2[]; elevation?: number }) {
  const geometry = useMemo(() => {
    const result = outline ? new ShapeGeometry(new Shape(outline.map((p) => new Vector2(p.x, p.z)))) : new PlaneGeometry(width, height)
    const uv = result.attributes.uv, position = result.attributes.position
    if (finish.presetId === 'natural-oak') {
      for (let i = 0; i < uv.count; i++) uv.setXY(i, position.getX(i), position.getY(i) + elevation)
    } else if (!outline) {
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * width, uv.getY(i) * height)
    }
    return result
  }, [width, height, outline, elevation, finish.presetId])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} receiveShadow><FinishMaterial finish={finish} keepTexture={finish.presetId === 'natural-oak'} /></mesh>
}

export function WallFinishFaces({ wall, height, pieces, profile, finishProfiles, fullHeight = false }: {
  wall: WallModel; height: number; pieces: WallPiece[]; profile?: Vec2[];
  finishProfiles?: Partial<Record<'left' | 'right', Vec2[]>>; fullHeight?: boolean
}) {
  const outlineFor = (piece: WallPiece, cap = profile) => wallPieceOutline(piece, cap, fullHeight)
  return <>{(['left', 'right'] as const).flatMap(side => {
      const finish = wall.faceFinishes?.[side]
      if (!finish) return []
      const cap = fullHeight ? finishProfiles?.[side] : undefined
      const extraHeight = cap ? Math.max(0, ...cap.map(p => p.z - height)) : 0
      const liningPieces = pieces.map(piece => Math.abs((piece.base ?? 0) + piece.height - height) < 1e-6 ? { ...piece, height: piece.height + extraHeight } : piece)
      return wallFinishPieces(liningPieces, finish, Boolean(fullHeight)).map((piece, index) => {
        const y = (piece.base ?? 0) + piece.height / 2
        const outline = outlineFor(piece, cap ?? profile)
        return <group key={`finish-${side}-${index}`} userData={{ interiorFinish: finish.presetId, wallFace: side }} position={[(piece.start + piece.end) / 2, y, (side === 'left' ? 1 : -1) * (wall.thicknessM / 2 + (finish.presetId === 'natural-oak' ? wallLiningDepthM : .001))]} rotation-y={side === 'right' ? Math.PI : 0}>
          <WallFace width={piece.end - piece.start} height={piece.height} outline={side === 'right' ? outline?.map(p => ({ x: -p.x, z: p.z })).reverse() : outline} finish={finish} elevation={wall.baseElevationM + y} />
        </group>
      })
    })}</>
}
