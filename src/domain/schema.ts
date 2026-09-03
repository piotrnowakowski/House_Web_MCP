import { z } from 'zod'
import { polygonArea, polygonSelfIntersects } from './geometry'
import { estimateDayPartTemperatures } from './climate'
import type { PlantRecommendation, PlantingGuideCategory, PlantingSoilAnalysis, ProjectV2, SiteKnowledgeBase } from './types'

type LegacyRecommendation = Omit<PlantRecommendation, 'category'> & { category?: PlantingGuideCategory }
type LegacyPlanting = Omit<SiteKnowledgeBase['planting'], 'soilAnalysis' | 'recommendations'> & { soilAnalysis?: PlantingSoilAnalysis; recommendations: LegacyRecommendation[] }

const inferPlantingCategory = (plant: LegacyRecommendation): PlantingGuideCategory => {
  if (plant.kind === 'crop') return 'vegetable'
  if (plant.kind === 'tree' && /apple|cherry|pear|plum|malus|prunus|pyrus/i.test(`${plant.commonName} ${plant.botanicalName}`)) return 'fruit-tree'
  if (plant.kind === 'tree' || plant.kind === 'hedge') return 'structure'
  return 'ornamental'
}

const hydrateKnowledgeBase = (value: SiteKnowledgeBase): SiteKnowledgeBase => {
  const result = structuredClone(value); const planting = result.planting as unknown as LegacyPlanting
  planting.recommendations = planting.recommendations.map((plant) => ({ ...plant, category: plant.category ?? inferPlantingCategory(plant) }))
  if (!planting.soilAnalysis) {
    const geotechnicalSource = result.sources.find((source) => source.kind === 'geotechnical-report')?.ref
    const sourceRefs = geotechnicalSource ? [geotechnicalSource] : []
    planting.soilAnalysis = {
      summary: 'This earlier ProjectV2 autosave contains ground evidence but no dedicated horticultural soil analysis. Confirm soil chemistry and drainage before productive planting.',
      findings: [{ ref: 'soil-finding/legacy-groundwater', label: 'Groundwater', observed: `Documented range ${result.geotechnical.groundwaterRangeM[0]}–${result.geotechnical.groundwaterRangeM[1]} m below ground.`, plantingImplication: 'Check drainage and keep productive root zones above persistent wetness.', confidence: 'documented', sourceRefs }],
      testsNeeded: [{ test: 'Composite topsoil laboratory test', reason: 'Confirm pH, organic matter, fertility and food-growing safety before amendment.' }, { test: 'Seasonal drainage check', reason: 'Observe each proposed productive area after prolonged rain.' }],
      preparation: ['Use verified soil in raised productive beds until native topsoil suitability is confirmed.', 'Do not prescribe lime or fertilizer without laboratory results.'],
    }
  }
  result.planting = planting as SiteKnowledgeBase['planting']
  return result
}

const Vec2Schema = z.object({ x: z.number().finite(), z: z.number().finite() }).strict()
const Vec3Schema = z.object({ x: z.number().finite(), y: z.number().finite(), z: z.number().finite() })
export const PolygonSchema = z.array(Vec2Schema).min(3)
  .refine((value) => polygonArea(value) > 0.01, { message: 'Polygon must have a non-zero area.' })
  .refine((value) => !polygonSelfIntersects(value), { message: 'Polygon must not self-intersect.' })

const ParcelSchema = z.object({
  ref: z.string().min(1), cadastralNumber: z.string().min(1), landRole: z.enum(['construction', 'agricultural']),
  officialAreaM2: z.number().positive(), boundary: PolygonSchema, geometryConfidence: z.enum(['surveyed', 'derived', 'context-only']),
})
const SiteEntranceSchema = z.object({
  ref: z.string().min(1), name: z.string().min(1), start: Vec2Schema, end: Vec2Schema,
  connectsTo: z.literal('public-road'), geometryConfidence: z.enum(['user-marked', 'surveyed']),
}).refine((entrance) => Math.hypot(entrance.end.x - entrance.start.x, entrance.end.z - entrance.start.z) > 0.5, { message: 'Site entrance must have length.' })
const OpeningSchema = z.object({
  ref: z.string().min(1), kind: z.enum(['door', 'window']), wallRef: z.string().min(1), offsetM: z.number().min(0),
  widthM: z.number().positive(), heightM: z.number().positive(), sillM: z.number().min(0),
})
const WallSchema = z.object({
  ref: z.string().min(1), start: Vec2Schema, end: Vec2Schema, thicknessM: z.number().positive(), baseElevationM: z.number().finite(),
  heightM: z.number().positive(), openings: z.array(OpeningSchema),
  finish: z.object({ material: z.enum(['charred-timber', 'natural-timber', 'light-render', 'brick', 'metal-panel']), colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/), textureId: z.string().optional() }).optional(),
  locked: z.boolean(),
}).refine((wall) => Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z) > 0.1, { message: 'Wall must have length.' })
const SpaceSchema = z.object({
  ref: z.string().min(1), name: z.string().min(1), usage: z.string().min(1),
  boundary: z.array(z.object({ wallRef: z.string().min(1), direction: z.union([z.literal(1), z.literal(-1)]) })).min(3),
  baseSlabRef: z.string().min(1), topBoundaryRef: z.string().min(1), locked: z.boolean(),
})
const SlabSchema = z.object({ ref: z.string().min(1), footprint: PolygonSchema, topElevationM: z.number().finite(), thicknessM: z.number().positive(), locked: z.boolean() })
const StoreySchema = z.object({
  ref: z.string().min(1), name: z.string().min(1), level: z.number().int(), elevationM: z.number().finite(), clearHeightM: z.number().positive(),
  baseSlabRef: z.string().min(1), topBoundaryRef: z.string().min(1), wallRefs: z.array(z.string().min(1)), spaceRefs: z.array(z.string().min(1)),
  platformRefs: z.array(z.string().min(1)), ceilingFinishRefs: z.array(z.string().min(1)),
})
const RoofFinishSchema = z.object({ material: z.enum(['standing-seam-metal', 'tile', 'slate', 'membrane']), colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/) })
const RoofSegmentSchema = z.object({
  ref: z.string().min(1), footprint: PolygonSchema, storeyRef: z.string().min(1).optional(), spaceRef: z.string().min(1).optional(), baseElevationM: z.number().finite(),
  type: z.enum(['flat', 'gable', 'hip']), pitchDegrees: z.number().min(0).max(70), overhangM: z.number().min(0).max(3), ridgeDirection: z.enum(['x', 'z']),
  finish: RoofFinishSchema, adjacentSegmentRefs: z.array(z.string().min(1)).default([]),
})
const RoofJunctionSchema = z.object({
  ref: z.string().min(1), type: z.enum(['valley', 'intersection']),
  segmentRefs: z.tuple([z.string().min(1), z.string().min(1)]),
})
const BuildingSchema = z.object({
  ref: z.string().min(1), name: z.string().min(1), kind: z.enum(['house', 'garage']), architecturalStyle: z.enum(['classic', 'futuristic', 'barn']),
  garageMode: z.enum(['integrated', 'attached']).optional(), position: Vec2Schema, rotationDegrees: z.number().finite(), storeys: z.array(StoreySchema).min(1),
  slabs: z.array(SlabSchema).min(1), walls: z.array(WallSchema), spaces: z.array(SpaceSchema),
  platforms: z.array(z.object({ ref: z.string().min(1), spaceRef: z.string().min(1), footprint: PolygonSchema, elevationM: z.number().finite(), thicknessM: z.number().positive() })),
  ceilingFinishes: z.array(z.object({ ref: z.string().min(1), spaceRef: z.string().min(1), hostBoundaryRef: z.string().min(1), elevationM: z.number().finite(), thicknessM: z.number().positive() })),
  roof: z.object({
    ref: z.string().min(1), type: z.enum(['flat', 'gable', 'hip']), baseElevationM: z.number().finite(), pitchDegrees: z.number().min(0).max(70), overhangM: z.number().min(0).max(3), footprint: PolygonSchema.optional(),
    finish: RoofFinishSchema.default({ material: 'standing-seam-metal', colorHex: '#2D3435' }), segments: z.array(RoofSegmentSchema).default([]), junctions: z.array(RoofJunctionSchema).default([]),
  }),
})
const PlantSchema = z.object({
  ref: z.string().min(1), name: z.string().min(1), species: z.string().min(1), kind: z.enum(['tree', 'hedge', 'shrub', 'perennial', 'grass', 'crop', 'wetland']),
  position: Vec2Schema, matureHeightM: z.number().positive(), canopyM: z.number().positive(), sunNeed: z.enum(['shade', 'partial', 'sun']), waterNeed: z.number().min(0),
  hardinessMinC: z.number(), leafMonths: z.array(z.number().int().min(1).max(12)), bloomMonths: z.array(z.number().int().min(1).max(12)), locked: z.boolean(),
  attachment: z.object({ hostRef: z.string().min(1), hostFace: z.enum(['top', 'bottom', 'inside', 'outside', 'terrain']), localPosition: Vec3Schema, rotationDegrees: z.number().finite() }).optional(),
})
const GardenFixtureSchema = z.object({
  ref: z.string().min(1), catalogId: z.enum(['raised-bed-2x1', 'tomato-row', 'potato-row', 'cucumber-trellis']), name: z.string().min(1),
  position: Vec2Schema, rotationDegrees: z.number().finite(), locked: z.boolean(),
})
const TemperatureByDayPartSchema = z.object({ night: z.number(), morning: z.number(), day: z.number(), evening: z.number() }).strict()
const ClimateMonthSchema = z.object({ month: z.number().int().min(1).max(12), meanMinC: z.number(), meanMaxC: z.number(), temperatureByDayPartC: TemperatureByDayPartSchema.optional(), precipitationMm: z.number().min(0), sunshineHours: z.number().min(0), et0Mm: z.number().min(0), frostDays: z.number().min(0).max(31), windKph: z.number().min(0) }).transform((value) => ({ ...value, temperatureByDayPartC: value.temperatureByDayPartC ?? estimateDayPartTemperatures(value.meanMinC, value.meanMaxC) }))

export const ProjectSchema = z.object({
  schemaVersion: z.literal(2), ref: z.string().min(1), name: z.string().min(1), units: z.literal('metric'), revision: z.number().int().positive(), updatedAt: z.string(),
  site: z.object({
    boundary: PolygonSchema, northDegrees: z.number().finite(),
    terrain: z.object({ boundary: PolygonSchema, elevationPoints: z.array(Vec2Schema.extend({ elevation: z.number().finite() })).min(1) }),
    parcels: z.array(ParcelSchema).min(1), entrances: z.array(SiteEntranceSchema).default([]), knowledgeBase: z.custom<SiteKnowledgeBase>((value) => Boolean(value) && typeof value === 'object').transform(hydrateKnowledgeBase),
  }),
  buildings: z.array(BuildingSchema),
  landscape: z.object({ zones: z.array(z.object({ ref: z.string().min(1), name: z.string().min(1), kind: z.enum(['lawn', 'terrace', 'path', 'driveway', 'bed', 'rain-garden', 'vegetable']), footprint: PolygonSchema, locked: z.boolean(), textureId: z.string().optional() })), plants: z.array(PlantSchema), fixtures: z.array(GardenFixtureSchema).default([]), fixtureCatalogVersion: z.number().int().nonnegative().default(0) }),
  climateProfile: z.object({
    ref: z.string().min(1), name: z.string().min(1), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), timezone: z.string().min(1), provenance: z.string().min(1),
    soil: z.object({ texture: z.enum(['sandy', 'loam', 'clay']), ph: z.number().min(0).max(14).nullable(), drainage: z.enum(['fast', 'balanced', 'slow']) }), irrigationMm: z.number().min(0), months: z.array(ClimateMonthSchema).length(12),
  }),
})

export const parseProject = (input: unknown): ProjectV2 => {
  const project = ProjectSchema.parse(input) as ProjectV2
  project.buildings.forEach((building) => {
    if (!building.roof.segments.length) {
      const storey = [...building.storeys].sort((a, b) => b.level - a.level)[0]
      const footprint = structuredClone(building.roof.footprint ?? building.slabs.find((slab) => slab.ref === storey.baseSlabRef)?.footprint ?? building.slabs[0].footprint)
      building.roof.segments = [{
        ref: `${building.roof.ref}/segment-main`, footprint, storeyRef: storey.ref, spaceRef: storey.spaceRefs[0], baseElevationM: building.roof.baseElevationM,
        type: building.roof.type, pitchDegrees: building.roof.pitchDegrees, overhangM: building.roof.overhangM, ridgeDirection: 'z', finish: structuredClone(building.roof.finish), adjacentSegmentRefs: [],
      }]
    }
    if (!building.roof.junctions.length) {
      const seen = new Set<string>()
      building.roof.junctions = building.roof.segments.flatMap((segment) => segment.adjacentSegmentRefs.flatMap((otherRef) => {
        const pair = [segment.ref, otherRef].sort() as [string, string]; const key = pair.join('|')
        if (seen.has(key) || !building.roof.segments.some((candidate) => candidate.ref === otherRef)) return []
        seen.add(key)
        return [{ ref: `${building.roof.ref}/junction-${seen.size}`, type: 'intersection' as const, segmentRefs: pair }]
      }))
    }
  })
  return project
}
