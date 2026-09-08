import type { Polygon2 } from '../domain/types'

export type SlabSolidInput = {
  kind: 'slab'
  ref: string
  footprint: Polygon2
  topElevationM: number
  thicknessM: number
}

export type WallSolidInput = {
  kind: 'wall'
  ref: string
  start: { x: number; z: number }
  end: { x: number; z: number }
  baseElevationM: number
  heightM: number
  thicknessM: number
  openings: Array<{ offsetM: number; widthM: number; heightM: number; sillM: number }>
}

export type SolidInput = SlabSolidInput | WallSolidInput

export type ColliderDescriptor = {
  ref: string
  center: [number, number, number]
  halfExtents: [number, number, number]
  rotationY: number
}

export type GeneratedSolid = {
  ref: string
  positions: Float32Array
  /** Planar UVs in metres, two per vertex, matched to `positions`. */
  uvs: Float32Array
  indices: Uint32Array
  collider: ColliderDescriptor
}

export type GeometryWorkerRequest = { requestId: number; revision: number; elements: SolidInput[] }
export type GeometryWorkerResponse = { requestId: number; revision: number; solids: GeneratedSolid[]; error?: string }
