import { useRenderQuality } from '../scene/renderingPreferences'
import { staticAssetUrl } from '../services/staticAssets'
import { useTexture } from '@react-three/drei'
import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react'
import { DoubleSide, RepeatWrapping, SRGBColorSpace } from 'three'
import { interiorFinishes } from '../domain/interiorFinishes'
import { textureLibrary } from '../domain/textures'
import type { InteriorFinish } from '../domain/types'

class FinishBoundary extends Component<{ children: ReactNode; color: string }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? <meshStandardMaterial color={this.props.color} side={DoubleSide} /> : this.props.children
  }
}

function MappedFinish({ finish, url, roughness }: { finish: InteriorFinish; url: string; roughness: number }) {
  const source = useTexture(url)
  const texture = useMemo(() => {
    const result = source.clone()
    result.wrapS = result.wrapT = RepeatWrapping
    result.repeat.set(1 / finish.tileM, 1 / finish.tileM)
    result.rotation = (finish.rotationDegrees * Math.PI) / 180
    result.colorSpace = SRGBColorSpace
    result.anisotropy = 4
    result.needsUpdate = true
    return result
  }, [source, finish.tileM, finish.rotationDegrees])
  useEffect(() => () => texture.dispose(), [texture])
  return <meshStandardMaterial map={texture} color={finish.color} roughness={roughness} side={DoubleSide} />
}

export function FinishMaterial({ finish }: { finish?: InteriorFinish }) {
  const quality = useRenderQuality()
  const preset = interiorFinishes.find((item) => item.id === finish?.presetId)
  if (!finish || !preset?.texture || quality === 'fast')
    return (
      <meshStandardMaterial
        color={finish?.color ?? '#eeeae3'}
        roughness={preset?.roughness ?? 0.85}
        side={DoubleSide}
      />
    )
  const scan = textureLibrary.find((item) => item.id === preset.texture)
  const path = scan
    ? `textures/${scan.folder}/diff_${scan.diffuse}.jpg`
    : `models/interior/textiles/${preset.texture}.png`
  return (
    <FinishBoundary key={path} color={finish.color}>
      <Suspense fallback={<meshStandardMaterial color={finish.color} side={DoubleSide} />}>
        <MappedFinish finish={finish} roughness={preset.roughness} url={staticAssetUrl(path)} />
      </Suspense>
    </FinishBoundary>
  )
}
