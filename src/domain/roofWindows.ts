import { polygonBounds } from './geometry'
import { roofSegmentRidgeElevation } from './roofs'
import type { Polygon2, RoofSegmentModel } from './types'

export function roofWindowLayout(segment: RoofSegmentModel, window: NonNullable<RoofSegmentModel['windows']>[number]) {
  const b = polygonBounds(segment.footprint), alongZ = segment.ridgeDirection === 'z'
  const center = alongZ ? (b.minX + b.maxX) / 2 : (b.minZ + b.maxZ) / 2
  const across = alongZ ? window.position.x : window.position.z
  const pitch = segment.pitchDegrees * Math.PI / 180, sign = across < center ? -1 : 1
  const dx = (alongZ ? window.lengthM * Math.cos(pitch) : window.widthM) / 2
  const dz = (alongZ ? window.widthM : window.lengthM * Math.cos(pitch)) / 2
  const { x, z } = window.position
  const footprint: Polygon2 = [{ x:x-dx,z:z-dz },{ x:x+dx,z:z-dz },{ x:x+dx,z:z+dz },{ x:x-dx,z:z+dz }]
  return {
    footprint,
    elevationM: roofSegmentRidgeElevation(segment) - Math.abs(across - center) * Math.tan(pitch),
    rotation: (alongZ ? [0, 0, -sign * pitch] : [sign * pitch, 0, 0]) as [number, number, number],
    size: (alongZ ? [window.lengthM, window.widthM] : [window.widthM, window.lengthM]) as [number, number],
    fits: segment.type === 'gable' && footprint.every(p => p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ)
      && Math.abs(across - center) > window.lengthM * Math.cos(pitch) / 2,
  }
}
