import { z } from 'zod'
import { webMcpFieldPrompts, webMcpToolPrompts, type WebMcpPromptBlocks } from '../../prompts/webmcp-tools'

const point = z.object({ x: z.number().describe(webMcpFieldPrompts.positionX), z: z.number().describe(webMcpFieldPrompts.positionZ) }).strict()
const polygon = z.array(point).min(3).max(64)
const ref = z.string().min(1).describe(webMcpFieldPrompts.semanticRef)

export const webMcpSchemas = {
  get_project_state: z.object({ detail: z.enum(['summary', 'site', 'structure', 'landscape', 'full']).default('summary') }),
  list_garden_fixtures: z.object({}),
  propose_site_update: z.object({ boundary: polygon.optional(), northDegrees: z.number().optional() }),
  propose_terrain_update: z.object({ elevationPoints: z.array(point.extend({ elevation: z.number() })).min(1) }),
  propose_building_update: z.object({ action: z.enum(['add', 'remove', 'move', 'set-style']), buildingRef: ref, name: z.string().optional(), kind: z.enum(['house', 'garage']).optional(), architecturalStyle: z.enum(['classic', 'futuristic', 'barn']).optional(), position: point.optional(), rotationDegrees: z.number().optional() }),
  propose_storey_update: z.object({ action: z.enum(['add', 'remove', 'set-height']), buildingRef: ref, storeyRef: ref, name: z.string().optional(), clearHeightM: z.number().min(2).max(8).optional(), footprint: polygon.optional() }),
  propose_slab_update: z.object({ action: z.enum(['set-footprint', 'set-thickness', 'set-elevation']), buildingRef: ref, slabRef: ref, footprint: polygon.optional(), thicknessM: z.number().positive().max(2).optional(), topElevationM: z.number().optional() }),
  propose_space_update: z.object({ action: z.enum(['add', 'remove', 'set-footprint', 'set-usage', 'set-lowered-ceiling']), buildingRef: ref, storeyRef: ref, spaceRef: ref, name: z.string().optional(), usage: z.string().optional(), footprint: polygon.optional(), ceilingElevationM: z.number().optional() }),
  propose_wall_update: z.object({ action: z.enum(['move', 'set-thickness', 'set-height']), buildingRef: ref, wallRef: ref, start: point.optional(), end: point.optional(), thicknessM: z.number().positive().max(1).optional(), heightM: z.number().min(1).max(12).optional() }),
  propose_opening_update: z.object({ action: z.enum(['add', 'remove', 'resize', 'move']), buildingRef: ref, wallRef: ref, openingRef: ref, kind: z.enum(['door', 'window']).optional(), offsetM: z.number().min(0).optional(), widthM: z.number().positive().optional(), heightM: z.number().positive().optional(), sillM: z.number().min(0).optional() }),
  propose_roof_update: z.object({ buildingRef: ref, roofType: z.enum(['flat', 'gable', 'hip']).optional(), pitchDegrees: z.number().min(0).max(70).optional(), overhangM: z.number().min(0).max(3).optional() }),
  propose_platform_update: z.object({ action: z.enum(['add', 'remove', 'resize']), buildingRef: ref, storeyRef: ref, spaceRef: ref, platformRef: ref, footprint: polygon.optional(), elevationM: z.number().optional(), thicknessM: z.number().positive().optional() }),
  propose_landscape_update: z.object({ action: z.enum(['add', 'remove', 'set-footprint', 'move']), zoneRef: ref, name: z.string().optional(), kind: z.enum(['lawn', 'terrace', 'path', 'driveway', 'bed', 'rain-garden', 'vegetable']).optional(), footprint: polygon.optional(), delta: point.optional() }),
  propose_plant_update: z.object({ action: z.enum(['add', 'remove', 'move']), plantRef: ref, name: z.string().optional(), species: z.string().optional(), kind: z.enum(['tree', 'hedge', 'shrub', 'perennial', 'grass', 'crop', 'wetland']).optional(), position: point.optional() }),
  propose_garden_fixture_update: z.object({ action: z.enum(['add', 'remove', 'move', 'rotate']), fixtureRef: ref, catalogId: z.enum(['raised-bed-2x1', 'tomato-row', 'potato-row', 'cucumber-trellis']).optional(), name: z.string().optional(), position: point.optional(), rotationDegrees: z.number().optional() }),
  propose_garden_fixture_set: z.object({
    preset: z.enum(['starter-kitchen-garden', 'tomato-raised-bed', 'potato-raised-bed', 'cucumber-raised-bed']),
    setRef: ref,
    origin: point.optional(),
    placement: z.enum(['at-origin', 'next-to-existing']).optional(),
    rotationDegrees: z.number().default(0),
  }).superRefine((value, context) => {
    if (!value.origin && value.placement !== 'next-to-existing') context.addIssue({ code: 'custom', path: ['origin'], message: 'origin is required unless placement is next-to-existing.' })
  }),
  propose_climate_update: z.object({ month: z.number().int().min(1).max(12), meanMinC: z.number().optional(), meanMaxC: z.number().optional(), temperatureByDayPartC: z.object({ night: z.number(), morning: z.number(), day: z.number(), evening: z.number() }).strict().optional(), precipitationMm: z.number().min(0).optional(), sunshineHours: z.number().min(0).optional(), et0Mm: z.number().min(0).optional(), frostDays: z.number().min(0).max(31).optional(), windKph: z.number().min(0).optional() }),
  show_structure_views: z.object({
    mode: z.enum(['architectural-set', 'custom']).default('architectural-set'), buildingRefs: z.array(ref).optional(), variantRef: ref.optional(),
    views: z.array(z.discriminatedUnion('type', [
      z.object({ type: z.literal('site-plan') }), z.object({ type: z.literal('axonometric') }),
      z.object({ type: z.enum(['north-elevation', 'south-elevation', 'east-elevation', 'west-elevation']) }),
      z.object({ type: z.literal('storey-plan'), storeyRef: ref }),
      z.object({ type: z.literal('section'), axis: z.enum(['longitudinal', 'transverse']), offsetM: z.number().optional() }),
    ])).max(12).optional(), includeAnnotations: z.boolean().default(true),
  }),
  run_seasonal_analysis: z.object({ months: z.array(z.number().int().min(1).max(12)).min(1).max(12).default([1, 4, 7, 10]), variantRef: ref.optional() }),
  compare_variants: z.object({ variantRefs: z.array(ref).min(1).max(4) }),
  request_apply_variant: z.object({ variantRef: ref }),
  discard_variant: z.object({ variantRef: ref }),
  undo_last_change: z.object({}),
} as const

export type WebMcpToolName = keyof typeof webMcpSchemas

const readOnlyTools = new Set<WebMcpToolName>(['get_project_state', 'list_garden_fixtures', 'show_structure_views', 'run_seasonal_analysis', 'compare_variants'])
const standardProperties = {
  status: { type: 'string', description: 'Execution outcome.' },
  projectRevision: { type: 'integer', description: 'Committed ProjectV2 revision.' },
  summary: { type: 'string', description: 'Short human-readable outcome.' },
}
const objectShape = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', required: ['status', 'projectRevision', 'summary', ...required], properties: { ...standardProperties, ...properties } })

const resultShapeFor = (name: WebMcpToolName): Record<string, unknown> => {
  if (name.startsWith('propose_')) return objectShape({ variantRef: { type: 'string' }, issues: { type: 'array', items: { type: 'object' } }, metrics: { type: 'object' } }, ['variantRef', 'issues', 'metrics'])
  if (name === 'get_project_state') return objectShape({ metrics: { type: 'object' }, data: { description: 'Requested ProjectV2 state slice.' } }, ['metrics', 'data'])
  if (name === 'list_garden_fixtures') return objectShape({ data: { type: 'array', items: { type: 'object', required: ['id', 'name', 'category', 'description', 'widthM', 'depthM', 'heightM'] } } }, ['data'])
  if (name === 'show_structure_views') return objectShape({ reportRef: { type: 'string' }, views: { type: 'array', items: { type: 'object', required: ['type', 'title', 'buildingRefs', 'presentation'], properties: { type: { type: 'string' }, title: { type: 'string' }, buildingRefs: { type: 'array', items: { type: 'string' } }, storeyRef: { type: 'string' }, presentation: { const: 'visible-in-page' } } } }, buildings: { type: 'array', items: { type: 'object' } } }, ['reportRef', 'views', 'buildings'])
  if (name === 'run_seasonal_analysis') return objectShape({ variantRef: { type: 'string' }, metrics: { type: 'object' }, data: { type: 'array', items: { type: 'object', properties: { month: { type: 'integer' }, temperatureByDayPartC: { type: 'object', required: ['night', 'morning', 'day', 'evening'], properties: { night: { type: 'number' }, morning: { type: 'number' }, day: { type: 'number' }, evening: { type: 'number' } } }, daylightHours: { type: 'number' }, waterBalanceMm: { type: 'number' }, droughtRisk: { type: 'string' }, frostRisk: { type: 'string' } } } } }, ['metrics', 'data'])
  if (name === 'compare_variants') return objectShape({ data: { type: 'array', items: { type: 'object' } } }, ['data'])
  if (name === 'request_apply_variant') return objectShape({ variantRef: { type: 'string' }, metrics: { type: 'object' } }, ['variantRef'])
  if (name === 'discard_variant') return objectShape({ variantRef: { type: 'string' } }, ['variantRef'])
  if (name === 'undo_last_change') return objectShape({ metrics: { type: 'object' } }, ['metrics'])
  return objectShape({})
}

export interface WebMcpManifestTool {
  name: WebMcpToolName
  title: string
  readOnly: boolean
  description: string
  prompt: WebMcpPromptBlocks
  inputSchema: Record<string, unknown>
  exampleInput: unknown
  resultShape: Record<string, unknown>
}

export interface WebMcpManifest {
  manifestVersion: 1
  source: 'runtime-zod-and-structured-prompts'
  toolCount: number
  tools: WebMcpManifestTool[]
}

export const createWebMcpManifest = (): WebMcpManifest => {
  const tools = (Object.keys(webMcpSchemas) as WebMcpToolName[]).map((name) => {
    const prompt = webMcpToolPrompts[name]
    return {
      name, title: prompt.title, readOnly: readOnlyTools.has(name), description: prompt.description, prompt: prompt.blocks,
      inputSchema: z.toJSONSchema(webMcpSchemas[name], { target: 'draft-7' }) as Record<string, unknown>,
      exampleInput: prompt.exampleInput, resultShape: resultShapeFor(name),
    }
  })
  return { manifestVersion: 1, source: 'runtime-zod-and-structured-prompts', toolCount: tools.length, tools }
}

export const webMcpManifest = createWebMcpManifest()
