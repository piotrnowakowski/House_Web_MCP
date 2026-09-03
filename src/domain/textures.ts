import type { GardenZoneKind, LandscapeZone, ProjectV2, WallFinish, WallMaterial } from './types'

/** Where a scan may be applied: vertical wall finishes or horizontal ground zones. */
export type TextureSurface = 'wall' | 'ground'
export type TextureId = 'brick-floor' | 'hinoki' | 'coated-pine' | 'leafy-grass' | 'medieval-brick' | 'rusty-painted-metal' | 'concrete-tiles' | 'brick-pavement' | 'square-tiles' | 'dirt' | 'forest-floor' | 'river-pebbles'
/** The reserved choice that switches a surface back to its flat colour. */
export const FLAT_TEXTURE = 'none'

export interface TextureDefinition {
  id: TextureId; folder: string; name: string; author: string; description: string
  /** Physical width one repeat of the scan covers, in metres. */
  tileM: number
  surfaces: TextureSurface[]
  /** Resolution of the shipped diffuse map; ground scans seen from a distance ship at 1K. */
  diffuse: '2k' | '1k'
  /** Rotation applied on walls so planks stand upright. */
  wallRotation: number
}

/** Poly Haven CC0 scans shipped under public/textures; order is the order shown in pickers. */
export const textureLibrary: TextureDefinition[] = [
  { id: 'medieval-brick', folder: 'medieval_red_brick', name: 'Red brick', author: 'Rob Tuytel', description: 'Weathered red clay brick with lime mortar', tileM: 2, surfaces: ['wall'], diffuse: '2k', wallRotation: 0 },
  { id: 'brick-floor', folder: 'brick_floor_04', name: 'Dark brick pavers', author: 'Dimitrios Savva', description: 'Dark fired brick laid in a running bond', tileM: 1.9, surfaces: ['wall', 'ground'], diffuse: '2k', wallRotation: 0 },
  { id: 'hinoki', folder: 'hinoki_planks', name: 'Hinoki planks', author: 'Charlotte Baglioni', description: 'Pale cypress boards, vertical on walls', tileM: 1.9, surfaces: ['wall'], diffuse: '2k', wallRotation: Math.PI / 2 },
  { id: 'coated-pine', folder: 'coated_pine', name: 'Coated pine', author: 'Charlotte Baglioni, Rico Cilliers', description: 'Varnished pine boards', tileM: 0.7, surfaces: ['wall'], diffuse: '2k', wallRotation: Math.PI / 2 },
  { id: 'rusty-painted-metal', folder: 'rusty_painted_metal', name: 'Corrugated metal', author: 'Amal Kumar', description: 'Painted corrugated sheet with rust streaks', tileM: 2.2, surfaces: ['wall'], diffuse: '2k', wallRotation: 0 },
  { id: 'concrete-tiles', folder: 'concrete_tiles_02', name: 'Concrete slabs', author: 'Charlotte Baglioni', description: 'Grey concrete paving slabs', tileM: 1.8, surfaces: ['ground'], diffuse: '2k', wallRotation: 0 },
  { id: 'brick-pavement', folder: 'brick_pavement', name: 'Brick pavement', author: 'Charlotte Baglioni', description: 'Red clinker pavers in a basket weave', tileM: 2, surfaces: ['ground'], diffuse: '2k', wallRotation: 0 },
  { id: 'square-tiles', folder: 'square_tiles', name: 'Square tiles', author: 'Charlotte Baglioni', description: 'Small grey tiles in a chequer pattern', tileM: 2.4, surfaces: ['ground'], diffuse: '2k', wallRotation: 0 },
  { id: 'leafy-grass', folder: 'leafy_grass', name: 'Leafy grass', author: 'Charlotte Baglioni', description: 'Late-summer lawn with fallen leaves', tileM: 2, surfaces: ['ground'], diffuse: '2k', wallRotation: 0 },
  { id: 'dirt', folder: 'dirt_floor', name: 'Bare soil', author: 'eye-candy.xyz', description: 'Compacted brown dirt', tileM: 2.1, surfaces: ['ground'], diffuse: '1k', wallRotation: 0 },
  { id: 'forest-floor', folder: 'forest_leaves_02', name: 'Mulch and moss', author: 'Rob Tuytel', description: 'Leaf litter and moss under trees', tileM: 3, surfaces: ['ground'], diffuse: '1k', wallRotation: 0 },
  { id: 'river-pebbles', folder: 'dry_river_pebbles', name: 'River pebbles', author: 'Amal Kumar', description: 'Rounded beige and charcoal pebbles', tileM: 2, surfaces: ['ground'], diffuse: '1k', wallRotation: 0 },
]

const byId = new Map(textureLibrary.map((item) => [item.id, item]))
export const textureById = (id: TextureId): TextureDefinition => byId.get(id)!
export const isTextureId = (value: unknown): value is TextureId => typeof value === 'string' && byId.has(value as TextureId)
export const texturesFor = (surface: TextureSurface) => textureLibrary.filter((item) => item.surfaces.includes(surface))
const fits = (surface: TextureSurface, id: TextureId) => textureById(id).surfaces.includes(surface)

/** Throws when a requested scan is unknown or does not belong on the surface; `none` is always accepted. */
export const validateTextureChoice = (surface: TextureSurface, value: string) => {
  if (value === FLAT_TEXTURE) return
  if (!isTextureId(value)) throw new Error(`Unknown texture "${value}". Use an id from list_textures or "none".`)
  if (!fits(surface, value)) throw new Error(`Texture "${value}" is not made for ${surface} surfaces. Use list_textures with surface ${surface}.`)
}

const wallDefaults: Partial<Record<WallMaterial, TextureId>> = { brick: 'medieval-brick', 'natural-timber': 'hinoki', 'metal-panel': 'rusty-painted-metal' }
const groundDefaults: Record<GardenZoneKind, TextureId> = { lawn: 'leafy-grass', terrace: 'concrete-tiles', path: 'square-tiles', driveway: 'brick-pavement', bed: 'forest-floor', 'rain-garden': 'river-pebbles', vegetable: 'dirt' }
export const defaultWallTexture = (material: WallMaterial): TextureId | undefined => wallDefaults[material]
export const defaultGroundTexture = (kind: GardenZoneKind): TextureId => groundDefaults[kind]

export interface ResolvedTexture { id: TextureId; rotation: number }
const choose = (surface: TextureSurface, chosen: string | undefined, fallback: TextureId | undefined): TextureId | undefined => {
  if (chosen === FLAT_TEXTURE) return undefined
  if (isTextureId(chosen) && fits(surface, chosen)) return chosen
  return fallback
}
/** The scan a wall finish draws: an explicit valid choice, else the material default; `none` means flat colour. */
export const resolveWallTexture = (finish: WallFinish): ResolvedTexture | undefined => {
  const id = choose('wall', finish.textureId, defaultWallTexture(finish.material))
  return id ? { id, rotation: textureById(id).wallRotation } : undefined
}
/** The scan a zone draws: an explicit valid choice, else the kind default; `none` means flat colour. */
export const resolveZoneTexture = (zone: LandscapeZone): ResolvedTexture | undefined => {
  const id = choose('ground', zone.textureId, defaultGroundTexture(zone.kind))
  return id ? { id, rotation: 0 } : undefined
}

const LAWN_DORMANT_TINT = '#C9B98A'
const LAWN_GROWING_TINT = '#D3E2C1'
/** Tint multiplied over a zone's scan: grass goes to straw from November to March, every other scan stays neutral. */
export const zoneTintFor = (zone: LandscapeZone, month: number): string => {
  if (resolveZoneTexture(zone)?.id !== 'leafy-grass') return '#FFFFFF'
  return month >= 4 && month <= 10 ? LAWN_GROWING_TINT : LAWN_DORMANT_TINT
}

/** Scans the project draws right now, so they can load ahead of the rest of the library. */
export const textureIdsInUse = (project: ProjectV2): TextureId[] => {
  const ids = new Set<TextureId>(['leafy-grass'])
  for (const building of project.buildings) {
    if (building.architecturalStyle === 'barn') ids.add('coated-pine')
    for (const wall of building.walls) { const resolved = wall.finish && resolveWallTexture(wall.finish); if (resolved) ids.add(resolved.id) }
  }
  for (const zone of project.landscape.zones) { const resolved = resolveZoneTexture(zone); if (resolved) ids.add(resolved.id) }
  if (project.landscape.fixtures.some((fixture) => fixture.catalogId.startsWith('raised-bed'))) { ids.add('hinoki'); ids.add('dirt') }
  return [...ids]
}
