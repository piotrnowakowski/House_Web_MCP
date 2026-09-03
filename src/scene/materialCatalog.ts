import type { GardenZoneKind, WallMaterial } from '../domain/types'

/** Poly Haven CC0 scans shipped under public/textures; tile widths are the physical size one repeat covers. */
export type TextureAssetKey = 'brick-floor' | 'hinoki' | 'coated-pine' | 'leafy-grass'
export interface TextureAsset { folder: string; name: string; author: string; tileM: number }
export const textureAssets: Record<TextureAssetKey, TextureAsset> = {
  'brick-floor': { folder: 'brick_floor_04', name: 'Brick Floor 04', author: 'Dimitrios Savva', tileM: 1.9 },
  hinoki: { folder: 'hinoki_planks', name: 'Hinoki Planks', author: 'Charlotte Baglioni', tileM: 1.9 },
  'coated-pine': { folder: 'coated_pine', name: 'Coated Pine', author: 'Charlotte Baglioni, Rico Cilliers', tileM: 0.7 },
  'leafy-grass': { folder: 'leafy_grass', name: 'Leafy Grass', author: 'Charlotte Baglioni', tileM: 2 },
}
export type TextureFiles = { map: string; normalMap: string; roughnessMap: string }
export const textureFilesFor = (key: TextureAssetKey): TextureFiles => {
  const folder = textureAssets[key].folder
  return { map: `textures/${folder}/diff_2k.jpg`, normalMap: `textures/${folder}/nor_1k.jpg`, roughnessMap: `textures/${folder}/rough_1k.png` }
}

/** Wall finishes that carry a scan; `rotation` turns the tile so hinoki planks run vertically on a wall. */
export interface WallTextureUse { asset: TextureAssetKey; rotation: number }
export const wallTextureFor: Partial<Record<WallMaterial, WallTextureUse>> = {
  brick: { asset: 'brick-floor', rotation: 0 },
  'natural-timber': { asset: 'hinoki', rotation: Math.PI / 2 },
}

/** Ground zones that carry a scan; beds, vegetable plots and rain gardens keep their flat colours. */
export interface GroundTextureUse { asset: TextureAssetKey; tint: string }
export const groundTextureFor: Partial<Record<GardenZoneKind, GroundTextureUse>> = {
  lawn: { asset: 'leafy-grass', tint: '#A9D874' },
  terrace: { asset: 'brick-floor', tint: '#FFFFFF' },
  path: { asset: 'brick-floor', tint: '#E8E3D8' },
  driveway: { asset: 'brick-floor', tint: '#CFD0CC' },
}
export const terrainTexture: GroundTextureUse = { asset: 'leafy-grass', tint: '#C4C6B8' }
export const interiorFloorTexture: GroundTextureUse = { asset: 'coated-pine', tint: '#FFFFFF' }
export const raisedBedTexture: GroundTextureUse = { asset: 'hinoki', tint: '#C89B72' }

const LAWN_DORMANT_TINT = '#C9B98A'
const LAWN_GROWING_TINT = '#A9D874'
/** Seasonal ground tint: lawns go to straw from November to March; every other textured zone keeps its base tint. */
export const groundTintFor = (kind: GardenZoneKind, month: number): string | null => {
  const use = groundTextureFor[kind]
  if (!use) return null
  if (kind === 'lawn') return month >= 4 && month <= 10 ? LAWN_GROWING_TINT : LAWN_DORMANT_TINT
  return use.tint
}

const channel = (hex: string, offset: number) => parseInt(hex.slice(offset, offset + 2), 16)
/** Per-channel sRGB mix toward another colour; returns an uppercase six-digit hex. */
export const mixHex = (hex: string, toward: string, amount: number) => {
  const mixed = [1, 3, 5].map((offset) => Math.round(channel(hex, offset) + (channel(toward, offset) - channel(hex, offset)) * amount))
  return `#${mixed.map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`
}
/** The wall colour picker becomes a light tint over a textured finish so the scan keeps most of its own colour. */
export const tintForTexturedFinish = (hex: string) => mixHex(hex, '#FFFFFF', 0.65)
