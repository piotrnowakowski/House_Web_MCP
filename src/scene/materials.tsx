import { useTexture } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react'
import { MirroredRepeatWrapping, SRGBColorSpace, type Side, type Texture } from 'three'
import { useStudioStore } from '../state/store'
import { textureAssets, textureFilesFor, textureIdsInUse, type TextureAssetKey } from './materialCatalog'

const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`
export const textureUrlsFor = (key: TextureAssetKey) => { const files = textureFilesFor(key); return [assetUrl(files.map), assetUrl(files.normalMap), assetUrl(files.roughnessMap)] }
const allTextureUrls = () => (Object.keys(textureAssets) as TextureAssetKey[]).flatMap(textureUrlsFor)

const configure = (texture: Texture, tileM: number, maxAnisotropy: number, srgb: boolean, rotation: number) => {
  texture.wrapS = MirroredRepeatWrapping; texture.wrapT = MirroredRepeatWrapping
  texture.repeat.set(1 / tileM, 1 / tileM); texture.rotation = rotation; texture.center.set(0, 0)
  texture.anisotropy = Math.min(8, maxAnisotropy); texture.generateMipmaps = true
  if (srgb) texture.colorSpace = SRGBColorSpace
  texture.needsUpdate = true
}

/** Loads one scan set once and configures it for metre UVs; rotated variants are cheap clones that share the GPU image. */
export function useTextureSet(key: TextureAssetKey, rotation = 0) {
  const gl = useThree((state) => state.gl)
  const [map, normalMap, roughnessMap] = useTexture(textureUrlsFor(key))
  return useMemo(() => {
    const tileM = textureAssets[key].tileM; const maxAnisotropy = gl.capabilities.getMaxAnisotropy()
    const set = rotation ? { map: map.clone(), normalMap: normalMap.clone(), roughnessMap: roughnessMap.clone() } : { map, normalMap, roughnessMap }
    configure(set.map, tileM, maxAnisotropy, true, rotation); configure(set.normalMap, tileM, maxAnisotropy, false, rotation); configure(set.roughnessMap, tileM, maxAnisotropy, false, rotation)
    return set
  }, [gl, key, map, normalMap, roughnessMap, rotation])
}

export interface TexturedMaterialProps {
  asset: TextureAssetKey; rotation?: number; color: string; fallbackColor?: string
  roughness?: number; metalness?: number; transparent?: boolean; opacity?: number; depthWrite?: boolean; side?: Side
  emissive?: string; emissiveIntensity?: number; normalScale?: number
}

function TexturedStandardMaterial({ asset, rotation = 0, color, roughness = 1, metalness = 0, transparent, opacity, depthWrite, side, emissive, emissiveIntensity, normalScale = 0.6 }: TexturedMaterialProps) {
  const set = useTextureSet(asset, rotation)
  return <meshStandardMaterial map={set.map} normalMap={set.normalMap} normalScale={[normalScale, normalScale]} roughnessMap={set.roughnessMap} color={color} roughness={roughness} metalness={metalness}
    transparent={transparent} opacity={opacity} depthWrite={depthWrite} side={side} emissive={emissive ?? '#000000'} emissiveIntensity={emissiveIntensity ?? 0} />
}

class TextureErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: unknown) { useStudioStore.getState().setToast(`Texture unavailable, showing flat colours: ${error instanceof Error ? error.message : 'load failed'}`) }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

/** A textured standard material that falls back to a flat colour while loading or when a texture fails to load. */
export function TexturedMaterial(props: TexturedMaterialProps) {
  const fallback = <meshStandardMaterial color={props.fallbackColor ?? props.color} roughness={props.roughness ?? 1} metalness={props.metalness ?? 0} transparent={props.transparent} opacity={props.opacity} depthWrite={props.depthWrite} side={props.side} emissive={props.emissive ?? '#000000'} emissiveIntensity={props.emissiveIntensity ?? 0} />
  return <TextureErrorBoundary fallback={fallback}><Suspense fallback={fallback}><TexturedStandardMaterial {...props} /></Suspense></TextureErrorBoundary>
}

function TexturePreloadInner({ urls }: { urls: string[] }) {
  useTexture(urls)
  const setTexturesReady = useStudioStore((state) => state.setTexturesReady)
  useEffect(() => { setTexturesReady(true) }, [setTexturesReady, urls])
  return null
}
class ReadyOnError extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { useStudioStore.getState().setTexturesReady(true) }
  render() { return this.state.failed ? null : this.props.children }
}
/**
 * Loads the scans the project draws first (report captures wait on these), then warms the rest of the library
 * in idle time so a later pick from the texture picker or a WebMCP proposal shows without a network round trip.
 */
export function TexturePreloader() {
  const project = useStudioStore((state) => state.project); const texturesReady = useStudioStore((state) => state.texturesReady)
  const inUse = useMemo(() => textureIdsInUse(project).flatMap(textureUrlsFor), [project])
  useEffect(() => { useTexture.preload(inUse) }, [inUse])
  useEffect(() => {
    if (!texturesReady) return
    const rest = allTextureUrls().filter((url) => !inUse.includes(url))
    if (!rest.length) return
    const schedule = window.requestIdleCallback?.bind(window) ?? ((callback: () => void) => window.setTimeout(callback, 400))
    const cancel = window.cancelIdleCallback?.bind(window) ?? window.clearTimeout.bind(window)
    const handle = schedule(() => useTexture.preload(rest))
    return () => cancel(handle)
  }, [inUse, texturesReady])
  return <ReadyOnError><Suspense fallback={null}><TexturePreloadInner urls={inUse} /></Suspense></ReadyOnError>
}

/** Resolves when textures are ready or after the timeout, so a capture never blocks on a slow network. */
export const waitForTextures = (timeoutMs = 3000) => new Promise<void>((resolve) => {
  if (useStudioStore.getState().texturesReady) { resolve(); return }
  const started = performance.now()
  const timer = window.setInterval(() => { if (useStudioStore.getState().texturesReady || performance.now() - started > timeoutMs) { window.clearInterval(timer); resolve() } }, 100)
})
