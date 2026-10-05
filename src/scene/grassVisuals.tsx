import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Color, DoubleSide, Float32BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, ShaderMaterial, Uint16BufferAttribute } from 'three'
import type { ProjectV2 } from '../domain/types'
import { useStudioStore } from '../state/store'

export { grassBladePoints } from './grassGeometry'
import { grassPlacementKey, type GrassAttributes } from './grassGeometry'
import { useRenderQuality } from './renderingPreferences'

const grassCache = new Map<string, GrassAttributes>()

const makeGeometry = (attributes: GrassAttributes) => {
  const geometry = new InstancedBufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([
    -0.012, 0, 0, 0.012, 0, 0,
    -0.008, 0.045, 0, 0.008, 0.045, 0,
    0, 0.09, 0,
  ], 3))
  geometry.setIndex(new Uint16BufferAttribute([0, 1, 2, 2, 1, 3, 2, 3, 4], 1))
  geometry.setAttribute('offset', new InstancedBufferAttribute(attributes.offsets, 3))
  geometry.setAttribute('bladeAngle', new InstancedBufferAttribute(attributes.angles, 1))
  geometry.setAttribute('bladeHeight', new InstancedBufferAttribute(attributes.heights, 1))
  geometry.setAttribute('bladeShade', new InstancedBufferAttribute(attributes.shades, 1))
  geometry.instanceCount = attributes.angles.length
  return geometry
}

const vertexShader = `
  attribute vec3 offset;
  attribute float bladeAngle;
  attribute float bladeHeight;
  attribute float bladeShade;
  uniform float time;
  varying float vHeight;
  varying float vShade;
  varying float vDistance;

  void main() {
    float heightFraction = position.y / 0.09;
    float cosine = cos(bladeAngle);
    float sine = sin(bladeAngle);
    vec3 blade = vec3(position.x * cosine, position.y * bladeHeight, -position.x * sine);
    float wind = sin(time * 0.72 + offset.x * 0.31 + offset.z * 0.23) * 0.009 * heightFraction * heightFraction;
    blade.x += wind * cosine;
    blade.z += wind * sine;
    vec4 viewPosition = modelViewMatrix * vec4(offset + blade, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    vHeight = heightFraction;
    vShade = bladeShade;
    vDistance = -viewPosition.z;
  }
`

const fragmentShader = `
  uniform vec3 bottomColor;
  uniform vec3 tipColor;
  uniform vec3 distantColor;
  varying float vHeight;
  varying float vShade;
  varying float vDistance;

  void main() {
    if (vDistance > 64.0) discard;
    vec3 bladeColor = mix(bottomColor, tipColor, smoothstep(0.0, 1.0, vHeight));
    bladeColor *= mix(0.78, 1.12, vShade);
    float detail = 1.0 - smoothstep(24.0, 58.0, vDistance);
    vec3 color = mix(distantColor, bladeColor, detail);
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function RealisticGrass({ project }: { project: ProjectV2 }) {
  const month = useStudioStore((state) => state.month)
  const mesh = useRef<Mesh<InstancedBufferGeometry, ShaderMaterial>>(null)
  const quality = useRenderQuality()
  const key = `${quality}/${grassPlacementKey(project)}`
  const projectRef = useRef(project)
  projectRef.current = project
  const [attributes, setAttributes] = useState<GrassAttributes | null>(null)
  useEffect(() => {
    setAttributes(null)
    if (quality === 'fast') return
    const cached = grassCache.get(key)
    if (cached) { setAttributes(cached); return }
    let worker: Worker
    try { worker = new Worker(new URL('./grass.worker.ts', import.meta.url), { type: 'module' }) }
    catch { return /* The ground remains visible when workers are unavailable. */ }
    worker.onmessage = (event: MessageEvent<GrassAttributes>) => {
      if (grassCache.size >= 3) grassCache.delete(grassCache.keys().next().value!)
      grassCache.set(key, event.data)
      setAttributes(event.data)
      worker.terminate()
    }
    worker.onerror = () => worker.terminate()
    worker.postMessage({ project: projectRef.current, candidates: quality === 'detailed' ? 360_000 : 90_000 })
    return () => worker.terminate()
  }, [key, quality])
  const geometry = useMemo(() => attributes ? makeGeometry(attributes) : null, [attributes])
  const material = useMemo(() => {
    const growing = month >= 4 && month <= 10
    return new ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        bottomColor: { value: new Color(growing ? '#315229' : '#75653c') },
        tipColor: { value: new Color(growing ? '#779454' : '#b59c62') },
        distantColor: { value: new Color(growing ? '#6f8852' : '#a28f62') },
      },
      vertexShader,
      fragmentShader,
      side: DoubleSide,
      depthWrite: true,
      toneMapped: true,
    })
  }, [month])

  useFrame((state) => { material.uniforms.time.value = state.clock.elapsedTime })
  useEffect(() => () => geometry?.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  if (!geometry) return null
  return <mesh ref={mesh} geometry={geometry} material={material} frustumCulled={false} raycast={() => null} userData={{ editorOnly: true, realisticGrass: true }} />
}
