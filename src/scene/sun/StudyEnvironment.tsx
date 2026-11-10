import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect } from 'react'
import { DataTexture, EquirectangularReflectionMapping, FloatType, LinearSRGBColorSpace, PMREMGenerator, RGBAFormat } from 'three'
import { useStudioStore } from '../../state/store'
import { sunStateFor } from './sunState'

/** A modest sky/ground radiance fill for PBR reflections and diffuse daylight.
 * This approximates indirect light; it is not a room-specific GI or lux solver.
 * Build the small environment once, then vary only its strength during playback.
 */
export function StudyEnvironment({ fullBrightness = false }: { fullBrightness?: boolean }) {
  const { gl, scene, invalidate } = useThree()
  const project = useStudioStore(state => state.project)
  const time = useStudioStore(state => state.sunTime)
  const altitude = sunStateFor(project, time).altitudeDeg
  const daylight = Math.sqrt(Math.max(0, Math.sin(altitude * Math.PI / 180)))
  const twilight = Math.min(1, Math.max(0, (altitude + 6) / 6))
  useEffect(() => {
    const width = 64, height = 32, pixels = new Float32Array(width * height * 4)
    for (let y = 0; y < height; y++) {
      // DataTexture row zero is v=0 (nadir); equirectangular v=1 is the zenith.
      const elevation = -Math.cos((y + .5) / height * Math.PI)
      const sky = Math.max(0, elevation), ground = Math.max(0, -elevation)
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        pixels[i] = elevation >= 0 ? 1.8 + .2 * sky : .7 - .3 * ground
        pixels[i + 1] = elevation >= 0 ? 1.9 + .4 * sky : .65 - .32 * ground
        pixels[i + 2] = elevation >= 0 ? 2 + .7 * sky : .55 - .3 * ground
        pixels[i + 3] = 1
      }
    }
    const map = new DataTexture(pixels, width, height, RGBAFormat, FloatType)
    map.mapping = EquirectangularReflectionMapping
    map.colorSpace = LinearSRGBColorSpace
    map.needsUpdate = true
    const generator = new PMREMGenerator(gl)
    const environment = generator.fromEquirectangular(map)
    const previous = scene.environment
    scene.environment = environment.texture
    map.dispose(); generator.dispose(); invalidate()
    return () => { scene.environment = previous; environment.dispose(); invalidate() }
  }, [gl, scene, invalidate])
  useLayoutEffect(() => {
    const previous = scene.environmentIntensity
    scene.environmentIntensity = fullBrightness ? .8 : .45 * daylight + .04 * twilight
    invalidate()
    return () => { scene.environmentIntensity = previous }
  }, [scene, daylight, twilight, fullBrightness, invalidate])
  return null
}
