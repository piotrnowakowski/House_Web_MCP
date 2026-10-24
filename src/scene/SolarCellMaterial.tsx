import { useLoader } from '@react-three/fiber'
import { SRGBColorSpace, TextureLoader } from 'three'
import { staticAssetUrl } from '../services/staticAssets'

export function SolarCellMaterial({ selected, ghost }: { selected: boolean; ghost: boolean }) {
  const map = useLoader(TextureLoader, staticAssetUrl('textures/solar-module.svg'))
  map.colorSpace = SRGBColorSpace
  return <meshPhysicalMaterial map={map} color={selected ? '#d6f0aa' : '#ffffff'} metalness={.18} roughness={.24} clearcoat={1} clearcoatRoughness={.12} transparent={ghost} opacity={ghost ? .35 : 1} depthWrite={!ghost} />
}
