import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo } from 'react'
import { PerspectiveCamera } from 'three'

/** Fixed eye position. Looking around never orbits or translates the observer. */
export function ObserverCamera({ position, yaw, pitch }: { position: [number, number, number]; yaw: number; pitch: number }) {
  const { set, size, invalidate } = useThree()
  const camera = useMemo(() => new PerspectiveCamera(72, 1, .025, 1200), [])
  useLayoutEffect(() => {
    camera.position.set(...position)
    camera.rotation.set(pitch * Math.PI / 180, yaw * Math.PI / 180, 0, 'YXZ')
    camera.aspect = size.width / size.height
    camera.updateProjectionMatrix()
    set({ camera })
    invalidate()
  }, [camera, position[0], position[1], position[2], yaw, pitch, size.width, size.height, set, invalidate])
  return null
}
