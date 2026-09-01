import { z } from 'zod'

const Vec2Schema = z.object({ x: z.number().finite(), z: z.number().finite() })
const OpeningSchema = z.object({
  ref: z.string().min(1), kind: z.enum(['door', 'window']), wall: z.enum(['north', 'east', 'south', 'west']),
  offsetM: z.number().finite(), widthM: z.number().positive(), heightM: z.number().positive(),
})
const MezzanineSchema = z.object({
  ref: z.string().min(1), roomRef: z.string().min(1), position: Vec2Schema,
  widthM: z.number().positive(), depthM: z.number().positive(), elevationM: z.number().positive(), thicknessM: z.number().positive(),
})
const RoomSchema = z.object({
  ref: z.string().min(1), name: z.string().min(1), usage: z.string().min(1), position: Vec2Schema,
  widthM: z.number().positive(), depthM: z.number().positive(), heightM: z.number().positive(), rotationDegrees: z.number().finite(),
  ceilingType: z.enum(['flat', 'lowered', 'sloped']), locked: z.boolean(), openings: z.array(OpeningSchema), mezzanines: z.array(MezzanineSchema),
})
const FloorSchema = z.object({
  ref: z.string().min(1), name: z.string().min(1), level: z.number().int(), elevationM: z.number().finite(),
  defaultHeightM: z.number().positive(), rooms: z.array(RoomSchema),
})
const BuildingSchema = z.object({
  ref: z.string().min(1), name: z.string().min(1), kind: z.enum(['house', 'garage']),
  garageMode: z.enum(['integrated', 'attached']).optional(), position: Vec2Schema, rotationDegrees: z.number().finite(),
  floors: z.array(FloorSchema), roof: z.object({ type: z.enum(['flat', 'gable', 'hip']), pitchDegrees: z.number().min(0).max(70), overhangM: z.number().min(0).max(3) }),
})
const GardenZoneSchema = z.object({
  ref: z.string().min(1), name: z.string().min(1), kind: z.enum(['lawn', 'terrace', 'path', 'driveway', 'bed', 'rain-garden', 'vegetable']),
  position: Vec2Schema, widthM: z.number().positive(), depthM: z.number().positive(), rotationDegrees: z.number().finite(), locked: z.boolean(),
})
const PlantSchema = z.object({
  ref: z.string().min(1), name: z.string().min(1), species: z.string().min(1), kind: z.enum(['tree', 'hedge', 'shrub', 'perennial', 'grass', 'crop', 'wetland']),
  position: Vec2Schema, matureHeightM: z.number().positive(), canopyM: z.number().positive(), sunNeed: z.enum(['shade', 'partial', 'sun']),
  waterNeed: z.number().min(0), hardinessMinC: z.number(), leafMonths: z.array(z.number().int().min(1).max(12)),
  bloomMonths: z.array(z.number().int().min(1).max(12)), locked: z.boolean(),
})
const ClimateMonthSchema = z.object({
  month: z.number().int().min(1).max(12), meanMinC: z.number(), meanMaxC: z.number(), precipitationMm: z.number().min(0),
  sunshineHours: z.number().min(0), et0Mm: z.number().min(0), frostDays: z.number().min(0).max(31), windKph: z.number().min(0),
})

export const ProjectSchema = z.object({
  schemaVersion: z.literal(1), ref: z.string().min(1), name: z.string().min(1), units: z.literal('metric'),
  revision: z.number().int().positive(), updatedAt: z.string(),
  plot: z.object({ boundary: z.array(Vec2Schema).min(3), northDegrees: z.number().finite(), elevationPoints: z.array(Vec2Schema.extend({ elevation: z.number().finite() })).min(1) }),
  buildings: z.array(BuildingSchema),
  garden: z.object({ zones: z.array(GardenZoneSchema), plants: z.array(PlantSchema) }),
  climateProfile: z.object({
    ref: z.string().min(1), name: z.string().min(1), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180),
    timezone: z.string().min(1), provenance: z.string().min(1),
    soil: z.object({ texture: z.enum(['sandy', 'loam', 'clay']), ph: z.number().min(0).max(14), drainage: z.enum(['fast', 'balanced', 'slow']) }),
    irrigationMm: z.number().min(0), months: z.array(ClimateMonthSchema).length(12),
  }),
})

export const parseProject = (input: unknown) => ProjectSchema.parse(input)
