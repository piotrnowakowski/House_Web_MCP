import { textureById, textureLibrary, type TextureDefinition, type TextureId } from '../domain/textures'

export { FLAT_TEXTURE, defaultGroundTexture, defaultWallTexture, resolveWallTexture, resolveZoneTexture, textureById, textureIdsInUse, textureLibrary, texturesFor, zoneTintFor } from '../domain/textures'
export type { TextureDefinition, TextureId, TextureSurface } from '../domain/textures'

/** Kept for callers that predate the library; every id in the library is an asset key. */
export type TextureAssetKey = TextureId
export const textureAssets: Record<TextureId, TextureDefinition> = Object.fromEntries(textureLibrary.map((item) => [item.id, item])) as Record<TextureId, TextureDefinition>

export type TextureFiles = { map: string; normalMap: string; roughnessMap: string }
/** Files shipped per scan: diffuse JPEG at the declared resolution, 1K JPEG GL normal map, 1K greyscale JPEG roughness. */
export const textureFilesFor = (key: TextureId): TextureFiles => {
  const { folder, diffuse } = textureById(key)
  return { map: `textures/${folder}/diff_${diffuse}.jpg`, normalMap: `textures/${folder}/nor_1k.jpg`, roughnessMap: `textures/${folder}/rough_1k.jpg` }
}
/** 256 px thumbnail of the diffuse map for pickers. */
export const texturePreviewFor = (key: TextureId) => `textures/${textureById(key).folder}/preview.jpg`

/** Fixed scan uses that are not chosen per object. */
export interface GroundTextureUse { asset: TextureId; tint: string }
export const terrainTexture: GroundTextureUse = { asset: 'leafy-grass', tint: '#C4C6B8' }
export const interiorFloorTexture: GroundTextureUse = { asset: 'coated-pine', tint: '#FFFFFF' }
export const raisedBedTexture: GroundTextureUse = { asset: 'hinoki', tint: '#C89B72' }
export const raisedBedSoilTexture: GroundTextureUse = { asset: 'dirt', tint: '#7D5F44' }

const channel = (hex: string, offset: number) => parseInt(hex.slice(offset, offset + 2), 16)
/** Per-channel sRGB mix toward another colour; returns an uppercase six-digit hex. */
export const mixHex = (hex: string, toward: string, amount: number) => {
  const mixed = [1, 3, 5].map((offset) => Math.round(channel(hex, offset) + (channel(toward, offset) - channel(hex, offset)) * amount))
  return `#${mixed.map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`
}
/** The wall colour picker becomes a light tint over a textured finish so the scan keeps most of its own colour. */
export const tintForTexturedFinish = (hex: string) => mixHex(hex, '#FFFFFF', 0.65)
