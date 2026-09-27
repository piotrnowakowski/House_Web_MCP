import type { GardenFixtureCatalogId, GardenFixtureModel, GardenFixtureUpdateCommand, ProjectV2, Vec2 } from './types'

export interface GardenFixtureDefinition {
  id: GardenFixtureCatalogId
  name: string
  category: 'furniture' | 'structure' | 'crop'
  description: string
  widthM: number
  depthM: number
  heightM: number
}

export const GARDEN_FIXTURE_CATALOG_VERSION = 1

export const gardenFixtureCatalog: GardenFixtureDefinition[] = [
  { id: 'recycling-bins', name: 'Kosze do segregacji', category: 'furniture', description: 'Five bins: paper, plastic and metal, glass, bio and mixed waste.', widthM: 3.6, depthM: 1.1, heightM: 1.2 },
  { id: 'jacuzzi', name: 'Jacuzzi ogrodowe', category: 'furniture', description: 'Four-seat spa with timber cladding, water and an entry step.', widthM: 2.6, depthM: 3.1, heightM: 1.05 },
  { id: 'outdoor-kitchen', name: 'Kuchnia zewnętrzna', category: 'furniture', description: 'Timber and graphite worktop with grill, sink and storage.', widthM: 3.6, depthM: 0.8, heightM: 1.35 },
  { id: 'outdoor-dining-set', name: 'Teak dining set', category: 'furniture', description: 'Six-seat slatted table for long outdoor lunches.', widthM: 3.4, depthM: 2.5, heightM: 0.82 },
  { id: 'garden-lounge-set', name: 'Garden lounge set', category: 'furniture', description: 'Low sofa, two armchairs and a coffee table in charcoal and canvas.', widthM: 3.8, depthM: 3.1, heightM: 0.82 },
  { id: 'slatted-bench', name: 'Slatted garden bench', category: 'furniture', description: 'Quiet two-seat timber bench with a supportive angled back.', widthM: 1.8, depthM: 0.68, heightM: 0.9 },
  { id: 'sun-lounger', name: 'Canvas sun lounger', category: 'furniture', description: 'Reclined timber lounger with a warm natural-canvas cushion.', widthM: 0.78, depthM: 2.05, heightM: 0.82 },
  { id: 'cantilever-parasol', name: 'Cantilever parasol', category: 'furniture', description: 'Three-metre shade canopy with an offset charcoal frame.', widthM: 3, depthM: 3, heightM: 2.55 },
  { id: 'raised-bed-2x1', name: 'Raised bed', category: 'structure', description: 'Timber 2.4 × 1.2 m bed with a deep soil layer.', widthM: 2.4, depthM: 1.2, heightM: 0.42 },
  { id: 'tomato-row', name: 'Tomato row', category: 'crop', description: 'Four staked tomato plants for a raised bed.', widthM: 2.15, depthM: 0.72, heightM: 1.55 },
  { id: 'potato-row', name: 'Potato row', category: 'crop', description: 'Five compact potato plants in a productive row.', widthM: 2.1, depthM: 0.78, heightM: 0.58 },
  { id: 'cucumber-trellis', name: 'Cucumber trellis', category: 'crop', description: 'Climbing cucumber row on a simple timber frame.', widthM: 2.15, depthM: 0.78, heightM: 1.45 },
  { id: 'greenhouse', name: 'Glass greenhouse', category: 'structure', description: 'Black aluminium greenhouse, 4.0 × 3.0 m, with a glazed gable roof and a door on one long side.', widthM: 4, depthM: 3, heightM: 2.6 },
  { id: 'larch-bed-long', name: 'Larch raised bed, long', category: 'structure', description: 'Natural larch bed 3.6 × 1.2 m, four boards high (about 0.6 m), with corner posts and a capping rail.', widthM: 3.6, depthM: 1.2, heightM: 0.6 },
  { id: 'larch-bed-square', name: 'Larch raised bed, square', category: 'structure', description: 'Natural larch bed 1.2 × 1.2 m, about 0.6 m high, for herbs, flowers or a feature plant.', widthM: 1.2, depthM: 1.2, heightM: 0.6 },
  { id: 'leafy-greens', name: 'Leafy greens', category: 'crop', description: 'Lettuce, chard and cabbage rosettes filling a long raised bed.', widthM: 3.3, depthM: 0.9, heightM: 0.35 },
  { id: 'tomato-bed', name: 'Staked tomatoes', category: 'crop', description: 'Seven staked tomato plants with ripening trusses filling a long raised bed.', widthM: 3.3, depthM: 0.9, heightM: 1.4 },
  { id: 'flower-mix', name: 'Cottage flower mix', category: 'crop', description: 'Mixed perennials with pink, white and yellow flowers and lavender spikes; fills a long bed or forms a border.', widthM: 3.3, depthM: 0.9, heightM: 0.75 },
  { id: 'flower-clump', name: 'Flower clump', category: 'crop', description: 'Compact mixed flowering planting for a square bed or a border gap.', widthM: 1, depthM: 1, heightM: 0.75 },
  { id: 'hydrangea', name: 'Panicle hydrangea', category: 'structure', description: 'Rounded shrub with large cream flower heads.', widthM: 1.3, depthM: 1.3, heightM: 1.2 },
  { id: 'timber-fence', name: 'Larch slatted fence', category: 'structure', description: 'Horizontal-slatted larch fence panel 2.4 m long and 1.1 m high.', widthM: 2.4, depthM: 0.1, heightM: 1.1 },
  { id: 'festoon-lights', name: 'Festoon lights', category: 'structure', description: 'Warm bulbs on a 6 m cable between two timber posts.', widthM: 6, depthM: 0.2, heightM: 2.85 },
  { id: 'water-butt', name: 'Rain-water butt', category: 'furniture', description: '300 l water butt on a low stand, fed from a roof gutter.', widthM: 0.62, depthM: 0.62, heightM: 1.1 },
]

/** Soil-surface height of each raised-bed type; crops centred on a bed sit on this surface. */
export const raisedBedSoilHeightM: Partial<Record<GardenFixtureCatalogId, number>> = { 'raised-bed-2x1': 0.41, 'larch-bed-long': 0.53, 'larch-bed-square': 0.53 }
/** Flower plantings may also form ground-level borders; vegetables need a raised bed on this site's wet clay. */
export const groundPlantingIds: GardenFixtureCatalogId[] = ['flower-mix', 'flower-clump']

export const gardenFixtureById = (id: GardenFixtureCatalogId) => {
  const definition = gardenFixtureCatalog.find((item) => item.id === id)
  if (!definition) throw new Error(`Unknown garden fixture: ${id}`)
  return definition
}

const groupedFixtureKey = (fixture: GardenFixtureModel): string | null => {
  const definition = gardenFixtureById(fixture.catalogId)
  if (fixture.catalogId !== 'raised-bed-2x1' && definition.category !== 'crop') return null
  const match = fixture.ref.match(/^(.*)\/(?:bed|crop)(?:-([^/]+))?$/)
  return match ? `${match[1]}/${match[2] ?? ''}` : null
}

export const groupedGardenFixtures = (fixtures: GardenFixtureModel[], selected: GardenFixtureModel): GardenFixtureModel[] => {
  const groupKey = groupedFixtureKey(selected)
  if (!groupKey) return [selected]
  const grouped = fixtures.filter((fixture) => groupedFixtureKey(fixture) === groupKey)
  return grouped.length > 1 ? grouped : [selected]
}

const rotateOffset = (offset: Vec2, rotationDegrees: number): Vec2 => {
  const radians = rotationDegrees * Math.PI / 180; const c = Math.cos(radians); const s = Math.sin(radians)
  return { x: offset.x * c + offset.z * s, z: -offset.x * s + offset.z * c }
}

const starterLayout: Array<{ suffix: string; catalogId: GardenFixtureCatalogId; name: string; offset: Vec2 }> = [
  { suffix: 'bed-tomato', catalogId: 'raised-bed-2x1', name: 'Tomato raised bed', offset: { x: 0, z: 0 } },
  { suffix: 'crop-tomato', catalogId: 'tomato-row', name: 'Tomatoes', offset: { x: 0, z: 0 } },
  { suffix: 'bed-potato', catalogId: 'raised-bed-2x1', name: 'Potato raised bed', offset: { x: 3.1, z: 0 } },
  { suffix: 'crop-potato', catalogId: 'potato-row', name: 'Potatoes', offset: { x: 3.1, z: 0 } },
  { suffix: 'bed-cucumber', catalogId: 'raised-bed-2x1', name: 'Cucumber raised bed', offset: { x: 6.2, z: 0 } },
  { suffix: 'crop-cucumber', catalogId: 'cucumber-trellis', name: 'Cucumbers', offset: { x: 6.2, z: 0 } },
]

export const createStarterGardenFixtures = (setRef: string, origin: Vec2 = { x: 8.4, z: 5.5 }, rotationDegrees = 0): GardenFixtureModel[] => starterLayout.map((item) => {
  const offset = rotateOffset(item.offset, rotationDegrees)
  return { ref: `${setRef}/${item.suffix}`, catalogId: item.catalogId, name: item.name, position: { x: origin.x + offset.x, z: origin.z + offset.z }, rotationDegrees, locked: false }
})

export const starterGardenCommands = (setRef: string, origin: Vec2, rotationDegrees = 0): GardenFixtureUpdateCommand[] => createStarterGardenFixtures(setRef, origin, rotationDegrees).map((fixture) => ({
  type: 'garden-fixture.update', action: 'add', fixtureRef: fixture.ref, catalogId: fixture.catalogId, name: fixture.name, position: fixture.position, rotationDegrees: fixture.rotationDegrees,
}))

export type GardenFixtureSetPreset = 'starter-kitchen-garden' | 'tomato-raised-bed' | 'potato-raised-bed' | 'cucumber-raised-bed'

const cropForBedPreset: Record<Exclude<GardenFixtureSetPreset, 'starter-kitchen-garden'>, { catalogId: GardenFixtureCatalogId; cropName: string; bedName: string }> = {
  'tomato-raised-bed': { catalogId: 'tomato-row', cropName: 'Tomatoes', bedName: 'Tomato raised bed' },
  'potato-raised-bed': { catalogId: 'potato-row', cropName: 'Potatoes', bedName: 'Potato raised bed' },
  'cucumber-raised-bed': { catalogId: 'cucumber-trellis', cropName: 'Cucumbers', bedName: 'Cucumber raised bed' },
}

export const nextGardenBedPosition = (project: ProjectV2): Vec2 => {
  const previous = project.landscape.fixtures.filter((fixture) => fixture.catalogId === 'raised-bed-2x1').at(-1)
  if (!previous) return { x: 8.4, z: 5.5 }
  const offset = rotateOffset({ x: 3.1, z: 0 }, previous.rotationDegrees)
  return { x: previous.position.x + offset.x, z: previous.position.z + offset.z }
}

export const gardenFixtureSetCommands = (preset: GardenFixtureSetPreset, setRef: string, origin: Vec2, rotationDegrees = 0): GardenFixtureUpdateCommand[] => {
  if (preset === 'starter-kitchen-garden') return starterGardenCommands(setRef, origin, rotationDegrees)
  const crop = cropForBedPreset[preset]
  return [
    { type: 'garden-fixture.update', action: 'add', fixtureRef: `${setRef}/bed`, catalogId: 'raised-bed-2x1', name: crop.bedName, position: origin, rotationDegrees },
    { type: 'garden-fixture.update', action: 'add', fixtureRef: `${setRef}/crop`, catalogId: crop.catalogId, name: crop.cropName, position: origin, rotationDegrees },
  ]
}

export const ensureStarterGarden = (source: ProjectV2): ProjectV2 => {
  const project = structuredClone(source)
  if (project.landscape.fixtureCatalogVersion >= GARDEN_FIXTURE_CATALOG_VERSION) return project
  if (!project.landscape.fixtures.length) project.landscape.fixtures = createStarterGardenFixtures('fixture-set/starter-1')
  project.landscape.fixtureCatalogVersion = GARDEN_FIXTURE_CATALOG_VERSION
  return project
}

export const nextFixturePosition = (project: ProjectV2): Vec2 => {
  const index = project.landscape.fixtures.length
  return { x: 8.4 + (index % 3) * 3.1, z: 5.5 + Math.floor(index / 3) * 2.2 }
}
