import { _roots } from '@react-three/fiber'
import { Mesh, type DirectionalLight } from 'three'
import { useStudioStore } from '../src/state/store'
import { observerWorldPosition } from '../src/scene/sun/observer'

export function lighting() {
  const canvas = document.querySelector('canvas')
  const state = canvas && _roots.get(canvas)?.store.getState()
  const light = state?.scene.children.find(object => object.userData.sunLight) as DirectionalLight | undefined
  return light ? { position: light.position.toArray(), intensity: light.intensity, shadows: light.castShadow, mapSize: light.shadow.mapSize.x } : null
}

/** Render the user's July kitchen case and measure the displayed pixels, not light labels. */
export function kitchenLighting(compare = false) {
  const canvas = document.querySelector('canvas')!
  const state = _roots.get(canvas)!.store.getState()
  const building = useStudioStore.getState().project.buildings.find(b => b.kind === 'house')!
  state.camera.position.set(...observerWorldPosition(building, building.storeys[0], { x: .6, z: -1.8 }, 1.6))
  state.camera.lookAt(...observerWorldPosition(building, building.storeys[0], { x: -.8, z: -5.8 }, 1.6))
  const glazing: Mesh[] = [], opaque: Mesh[] = []
  let floorReady = false
  state.scene.traverse(object => {
    if (object instanceof Mesh && object.userData.semanticRef === building.storeys[0].baseSlabRef) floorReady = true
    if (!(object instanceof Mesh) || !object.userData.openingPane) return
    ;(object.userData.clearGlazing ? glazing : opaque).push(object)
  })
  const capture = () => {
    state.gl.shadowMap.needsUpdate = true
    state.gl.render(state.scene, state.camera)
    const copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height
    const ctx = copy.getContext('2d')!; ctx.drawImage(canvas, 0, 0)
    return ctx.getImageData(0, 0, copy.width, copy.height).data
  }
  const luminance = (pixels: Uint8ClampedArray, i: number) => .2126 * pixels[i] + .7152 * pixels[i + 1] + .0722 * pixels[i + 2]
  const interior = (pixels: Uint8ClampedArray) => {
    let total = 0, count = 0
    for (let y = Math.floor(canvas.height * .4); y < canvas.height * .82; y++) {
      for (let x = Math.floor(canvas.width * .04); x < canvas.width * .46; x++) {
        total += luminance(pixels, (y * canvas.width + x) * 4); count++
      }
    }
    return total / count
  }
  const correct = capture()
  const result = {
    interiorLuminance: interior(correct), floorReady, environment: Boolean(state.scene.environment),
    environmentIntensity: state.scene.environmentIntensity,
    glassCount: glazing.length, glassShadows: glazing.filter(g => g.castShadow).length,
    opaqueCount: opaque.length, opaqueShadows: opaque.filter(g => g.castShadow).length,
    withoutEnvironment: 0, sunlitPixelsThroughGlass: 0,
  }
  if (compare) {
    const environment = state.scene.environment
    try {
      state.scene.environment = null
      result.withoutEnvironment = interior(capture())
    } finally { state.scene.environment = environment }
    const shadows = glazing.map(g => g.castShadow)
    try {
      glazing.forEach(g => { g.castShadow = true })
      const blocked = capture()
      for (let i = 0; i < correct.length; i += 4) {
        if (luminance(correct, i) - luminance(blocked, i) > 12) result.sunlitPixelsThroughGlass++
      }
    } finally { glazing.forEach((g, i) => { g.castShadow = shadows[i] }); capture() }
  }
  state.invalidate()
  return result
}
