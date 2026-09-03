import type { Vec3 } from '../domain/types'

export interface CameraControlInput {
  position: Vec3
  target: Vec3
  projection: 'perspective' | 'orthographic'
  fovDegrees: number
  zoom: number
  focalOffset: Vec3
  smooth: boolean
}

export interface CameraControlResult extends CameraControlInput {}

export type CameraControlHandler = (input: CameraControlInput, signal: AbortSignal) => Promise<CameraControlResult>

let cameraControlHandler: CameraControlHandler | null = null

export const registerCameraControl = (handler: CameraControlHandler) => {
  cameraControlHandler = handler
  return () => { if (cameraControlHandler === handler) cameraControlHandler = null }
}

export const controlCamera = (input: CameraControlInput, signal: AbortSignal) => {
  if (!cameraControlHandler) throw new Error('The 3D camera is not ready. Wait for the visible editor to finish loading and try again.')
  return cameraControlHandler(input, signal)
}
