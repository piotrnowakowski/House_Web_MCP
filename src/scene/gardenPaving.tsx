import { Suspense, useMemo } from 'react'
import { useLoader, useThree } from '@react-three/fiber'
import { DataTexture, DoubleSide, LinearFilter, LinearMipmapLinearFilter, RedFormat, RepeatWrapping, RGBAFormat, SRGBColorSpace, TextureLoader } from 'three'
import { staticAssetUrl } from '../services/staticAssets'

export type PavingFinish = 'pavers' | 'stone'
type SurfaceProps = { selected?: boolean; ghost?: boolean; color?: string; depthOffset?: number }

const hash = (x: number, y: number) => {
  let n = Math.imul(x + 31, 374761393) ^ Math.imul(y + 17, 668265263)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295
}
const smooth = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t) }
const noise = (x: number, y: number, cells: number) => {
  const ix = Math.floor(x), iy = Math.floor(y), fx = smooth(0, 1, x - ix), fy = smooth(0, 1, y - iy)
  const a = hash(ix % cells, iy % cells), b = hash((ix + 1) % cells, iy % cells)
  const c = hash(ix % cells, (iy + 1) % cells), d = hash((ix + 1) % cells, (iy + 1) % cells)
  return a + (b - a) * fx + (c - a + (a - b - c + d) * fx) * fy
}

/** Shared, seamless concrete detail. Metre UVs give a 60 x 30 cm running bond,
 * 4 mm sand-filled joints and a 2 mm bevel; no mirrored or stretched slab scan.
 * Copings/riser blocks use the same aggregate without painted paving joints. */
const concreteMaps = new Map<PavingFinish, { map: DataTexture; bumpMap: DataTexture }>()
function concreteTexture(finish: PavingFinish) {
  const cached = concreteMaps.get(finish)
  if (cached) return cached
  const size = finish === 'pavers' ? 2048 : 512, span = finish === 'pavers' ? 2.4 : 0.6
  const colors = new Uint8Array(size * size * 4), heights = new Uint8Array(size * size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + 0.5) * span / size, v = (y + 0.5) * span / size
    const row = Math.floor(v / 0.3), stagger = (row % 2) * 0.3
    const col = Math.floor((u + stagger) / 0.6) % 4
    const px = (u + stagger) % 0.6, py = v % 0.3
    const distance = Math.min(px, 0.6 - px, py, 0.3 - py)
    const bevel = finish === 'pavers' ? smooth(0.002, 0.004, distance) : 1
    const grain = (hash(x, y) - 0.5) * 7 + (noise(x / 4, y / 4, size / 4) - 0.5) * 12
    const mottling = (noise(x / 64, y / 64, size / 64) - 0.5) * 7
    const pore = smooth(0.68, 0.83, noise(x / 3, y / 3, Math.ceil(size / 3)))
    const tone = finish === 'pavers' ? (hash(col, row) - 0.5) * 9 : 0
    const i = y * size + x
    for (let c = 0; c < 3; c++) {
      const joint = [105, 104, 99][c], face = [138, 139, 134][c] + tone + grain + mottling - pore * 15
      colors[i * 4 + c] = Math.round(joint + (face - joint) * bevel)
    }
    colors[i * 4 + 3] = 255
    heights[i] = Math.round(Math.min(255, 32 + bevel * (210 + grain - pore * 24)))
  }
  const map = new DataTexture(colors, size, size, RGBAFormat)
  const bumpMap = new DataTexture(heights, size, size, RedFormat)
  map.colorSpace = SRGBColorSpace
  for (const texture of [map, bumpMap]) {
    texture.wrapS = texture.wrapT = RepeatWrapping
    texture.repeat.set(1 / span, 1 / span)
    texture.generateMipmaps = true; texture.minFilter = LinearMipmapLinearFilter; texture.magFilter = LinearFilter
    texture.needsUpdate = true
  }
  const result = { map, bumpMap }; concreteMaps.set(finish, result)
  return result
}

export function GardenPavingMaterial({ finish = 'pavers', color = '#ffffff', selected, ghost, depthOffset }: SurfaceProps & { finish?: PavingFinish }) {
  const gl = useThree(state => state.gl)
  const maps = useMemo(() => {
    const result = concreteTexture(finish)
    result.map.anisotropy = result.bumpMap.anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy())
    return result
  }, [finish, gl])
  return <meshStandardMaterial {...maps} color={selected ? '#bedb84' : color} bumpScale={finish === 'pavers' ? 0.003 : 0.0005}
    roughness={0.96} metalness={0} side={DoubleSide} transparent={ghost} opacity={ghost ? 0.35 : 1} depthWrite={!ghost}
    polygonOffset={depthOffset !== undefined} polygonOffsetFactor={depthOffset ?? 0} polygonOffsetUnits={depthOffset ?? 0} />
}

const gravelUrls = ['diff_2k.jpg', 'nor_1k.jpg', 'rough_1k.jpg'].map(file => staticAssetUrl(`textures/garden_fine_gravel/${file}`))
function FineGravelInner({ selected, ghost, depthOffset }: SurfaceProps) {
  const gl = useThree(state => state.gl)
  const loaded = useLoader(TextureLoader, gravelUrls)
  const [map, normalMap, roughnessMap] = useMemo(() => {
    loaded.forEach((texture, index) => {
      texture.wrapS = texture.wrapT = RepeatWrapping
      // Poly Haven's measured scan width: 2.5 m, preserving millimetre-scale gravel.
      texture.repeat.set(1 / 2.5, 1 / 2.5)
      texture.anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy())
      if (index === 0) texture.colorSpace = SRGBColorSpace
      texture.needsUpdate = true
    })
    return loaded
  }, [loaded, gl])
  return <meshStandardMaterial map={map} normalMap={normalMap} normalScale={[0.32, 0.32]} roughnessMap={roughnessMap}
    color={selected ? '#bedb84' : '#ffffff'} roughness={1} metalness={0} side={DoubleSide}
    transparent={ghost} opacity={ghost ? 0.35 : 1} depthWrite={!ghost}
    polygonOffset={depthOffset !== undefined} polygonOffsetFactor={depthOffset ?? 0} polygonOffsetUnits={depthOffset ?? 0} />
}

export function FineGardenGravelMaterial(props: SurfaceProps) {
  return <Suspense fallback={<meshStandardMaterial color={props.selected ? '#bedb84' : '#99978e'} roughness={1} side={DoubleSide}
    polygonOffset={props.depthOffset !== undefined} polygonOffsetFactor={props.depthOffset ?? 0} polygonOffsetUnits={props.depthOffset ?? 0} />}>
    <FineGravelInner {...props} />
  </Suspense>
}
