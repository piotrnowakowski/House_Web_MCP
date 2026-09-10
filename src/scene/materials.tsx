import { useTexture } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react'
import { MirroredRepeatWrapping, SRGBColorSpace, type Side, type Texture } from 'three'
import { useStudioStore } from '../state/store'
import type { ProjectV2 } from '../domain/types'
import { textureAssets, textureFilesFor, textureIdsInUse, type TextureAssetKey } from './materialCatalog'

const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`
export const textureUrlsFor = (key: TextureAssetKey) => { const files = textureFilesFor(key); return [assetUrl(files.map), assetUrl(files.normalMap), assetUrl(files.roughnessMap)] }

const configuredTextures = new WeakMap<Texture, string>()

const configure = (texture: Texture, tileM: number, maxAnisotropy: number, srgb: boolean, rotation: number) => {
  const signature = `${tileM}/${maxAnisotropy}/${srgb}/${rotation}`
  if (configuredTextures.get(texture) === signature) return
  configuredTextures.set(texture, signature)
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
  const set = useMemo(() => {
    const tileM = textureAssets[key].tileM; const maxAnisotropy = gl.capabilities.getMaxAnisotropy()
    const set = rotation ? { map: map.clone(), normalMap: normalMap.clone(), roughnessMap: roughnessMap.clone() } : { map, normalMap, roughnessMap }
    configure(set.map, tileM, maxAnisotropy, true, rotation); configure(set.normalMap, tileM, maxAnisotropy, false, rotation); configure(set.roughnessMap, tileM, maxAnisotropy, false, rotation)
    return set
  }, [gl, key, map, normalMap, roughnessMap, rotation])
  useEffect(() => () => {
    if (rotation) { set.map.dispose(); set.normalMap.dispose(); set.roughnessMap.dispose() }
  }, [set, rotation])
  return set
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

const readyTextureUrls = new Set<string>()

function TexturePreloadInner({ urls }: { urls: string[] }) {
  useTexture(urls)
  const setTexturesReady = useStudioStore((state) => state.setTexturesReady)
  useEffect(() => {
    urls.forEach(url => readyTextureUrls.add(url))
    setTexturesReady(true)
  }, [setTexturesReady, urls])
  return null
}
class ReadyOnError extends Component<{ children: ReactNode; urls: string[] }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() {
    this.props.urls.forEach(url => readyTextureUrls.add(url))
    useStudioStore.getState().setTexturesReady(true)
  }
  render() { return this.state.failed ? null : this.props.children }
}
/** Load only the scans used by this project; unused library assets load when selected. */
export function TexturePreloader() {
  const project = useStudioStore((state) => state.project)
  const ghost = useStudioStore(state => state.variants.find(variant => variant.ref === state.confirmationVariantRef)?.project)
  const inUse = useMemo(() => [...new Set([...textureIdsInUse(project), ...(ghost ? textureIdsInUse(ghost) : [])])].flatMap(textureUrlsFor), [project, ghost])
  return <ReadyOnError key={inUse.join('|')} urls={inUse}><Suspense fallback={null}><TexturePreloadInner urls={inUse} /></Suspense></ReadyOnError>
}

/** Resolves when textures are ready or after the timeout, so a capture never blocks on a slow network. */
export const waitForTextures = (timeoutMs = 3000, project: ProjectV2 = useStudioStore.getState().project) => new Promise<void>((resolve) => {
  // A previous project/finish being ready does not make a newly selected scan ready.
  const urls = textureIdsInUse(project).flatMap(textureUrlsFor)
  const ready = () => urls.every(url => readyTextureUrls.has(url))
  if (ready()) { resolve(); return }
  const started = performance.now()
  const timer = window.setInterval(() => { if (ready() || performance.now() - started > timeoutMs) { window.clearInterval(timer); resolve() } }, 100)
})
