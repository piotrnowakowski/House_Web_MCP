import { _roots } from '@react-three/fiber'
import type { DirectionalLight } from 'three'

export function lighting() {
  const canvas = document.querySelector('canvas')
  const state = canvas && _roots.get(canvas)?.store.getState()
  const light = state?.scene.children.find(object => object.userData.sunLight) as DirectionalLight | undefined
  return light ? { position: light.position.toArray(), intensity: light.intensity, shadows: light.castShadow, mapSize: light.shadow.mapSize.x } : null
}
