import { z } from 'zod'
import { webMcpFieldDescriptions, webMcpFieldPrompts, webMcpToolPrompts, type WebMcpPromptBlocks } from '../../prompts/webmcp-tools'

const point = z.object({ x: z.number().describe(webMcpFieldPrompts.positionX), z: z.number().describe(webMcpFieldPrompts.positionZ) }).strict()
const point3 = point.extend({ y: z.number().describe('Local project elevation in metres.') }).strict()
const polygon = z.array(point).min(3).max(64)
const polyline = z.array(point).min(2).max(128)
const ref = z.string().min(1).describe(webMcpFieldPrompts.semanticRef)
const storeyUpdateInput = z.object({
  action: z.enum(['add', 'remove', 'set-height', 'extend-footprint']), buildingRef: ref, storeyRef: ref, name: z.string().optional(), clearHeightM: z.number().min(2).max(8).optional(),
  footprint: polygon.optional(), extensionFootprint: polygon.optional(), spaceRef: ref.optional(), spaceName: z.string().optional(), usage: z.string().optional(),
}).superRefine((value, context) => { if (value.action === 'extend-footprint' && !value.footprint && !value.extensionFootprint) context.addIssue({ code: 'custom', path: ['footprint'], message: 'footprint or extensionFootprint is required when extending a storey.' }) })
const wallFinishInput = z.object({
  buildingRef: ref, scope: z.enum(['wall', 'all-exterior']), wallRef: ref.optional(),
  material: z.enum(['charred-timber', 'natural-timber', 'light-render', 'brick', 'metal-panel']), colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
}).superRefine((value, context) => { if (value.scope === 'wall' && !value.wallRef) context.addIssue({ code: 'custom', path: ['wallRef'], message: 'wallRef is required when scope is wall.' }) })
const changeSetOperationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('site.update'), boundary: polygon.optional(), northDegrees: z.number().optional() }),
  z.object({ type: z.literal('terrain.update'), elevationPoints: z.array(point.extend({ elevation: z.number() })).min(1) }),
  z.object({ type: z.literal('building.update'), action: z.enum(['add', 'remove', 'move', 'set-style']), buildingRef: ref, name: z.string().optional(), kind: z.enum(['house', 'garage']).optional(), architecturalStyle: z.enum(['classic', 'futuristic', 'barn']).optional(), position: point.optional(), rotationDegrees: z.number().optional() }),
  z.object({ type: z.literal('storey.update'), action: z.enum(['add', 'remove', 'set-height', 'extend-footprint']), buildingRef: ref, storeyRef: ref, name: z.string().optional(), clearHeightM: z.number().optional(), footprint: polygon.optional(), extensionFootprint: polygon.optional(), spaceRef: ref.optional(), spaceName: z.string().optional(), usage: z.string().optional() }),
  z.object({ type: z.literal('slab.update'), action: z.enum(['set-footprint', 'set-thickness', 'set-elevation']), buildingRef: ref, slabRef: ref, footprint: polygon.optional(), thicknessM: z.number().optional(), topElevationM: z.number().optional() }),
  z.object({ type: z.literal('space.update'), action: z.enum(['add', 'remove', 'set-footprint', 'set-usage', 'set-lowered-ceiling']), buildingRef: ref, storeyRef: ref, spaceRef: ref, name: z.string().optional(), usage: z.string().optional(), footprint: polygon.optional(), ceilingElevationM: z.number().optional() }),
  z.object({ type: z.literal('wall.update'), action: z.enum(['move', 'set-thickness', 'set-height']), buildingRef: ref, wallRef: ref, start: point.optional(), end: point.optional(), thicknessM: z.number().optional(), heightM: z.number().optional() }),
  z.object({ type: z.literal('wall.finish'), buildingRef: ref, wallRef: ref, material: z.enum(['charred-timber', 'natural-timber', 'light-render', 'brick', 'metal-panel']), colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/) }),
  z.object({ type: z.literal('opening.update'), action: z.enum(['add', 'remove', 'resize', 'move']), buildingRef: ref, wallRef: ref, openingRef: ref, kind: z.enum(['door', 'window']).optional(), offsetM: z.number().optional(), widthM: z.number().optional(), heightM: z.number().optional(), sillM: z.number().optional() }),
  z.object({ type: z.literal('roof.update'), buildingRef: ref, roofType: z.enum(['flat', 'gable', 'hip']).optional(), pitchDegrees: z.number().optional(), overhangM: z.number().optional() }),
  z.object({ type: z.literal('platform.update'), action: z.enum(['add', 'remove', 'resize']), buildingRef: ref, storeyRef: ref, spaceRef: ref, platformRef: ref, footprint: polygon.optional(), elevationM: z.number().optional(), thicknessM: z.number().optional() }),
  z.object({ type: z.literal('landscape.update'), action: z.enum(['add', 'remove', 'set-footprint', 'move']), zoneRef: ref, name: z.string().optional(), kind: z.enum(['lawn', 'terrace', 'path', 'driveway', 'bed', 'rain-garden', 'vegetable']).optional(), footprint: polygon.optional(), delta: point.optional() }),
  z.object({ type: z.literal('plant.update'), action: z.enum(['add', 'remove', 'move']), plantRef: ref, name: z.string().optional(), species: z.string().optional(), kind: z.enum(['tree', 'hedge', 'shrub', 'perennial', 'grass', 'crop', 'wetland']).optional(), position: point.optional() }),
  z.object({ type: z.literal('garden-fixture.update'), action: z.enum(['add', 'remove', 'move', 'rotate']), fixtureRef: ref, catalogId: z.enum(['raised-bed-2x1', 'tomato-row', 'potato-row', 'cucumber-trellis']).optional(), name: z.string().optional(), position: point.optional(), rotationDegrees: z.number().optional() }),
  z.object({ type: z.literal('climate.update'), month: z.number().int().min(1).max(12), values: z.record(z.string(), z.unknown()) }),
])

export const webMcpSchemas = {
  get_project_state: z.object({ detail: z.enum(['summary', 'site', 'structure', 'landscape', 'full']).default('summary'), objectRef: ref.optional() }),
  get_site_knowledge: z.object({ section: z.enum(['sources', 'measurements', 'terrain', 'geotechnical', 'planting', 'designRules', 'caveats']).optional() }),
  list_garden_fixtures: z.object({}),
  propose_site_update: z.object({ boundary: polygon.optional(), northDegrees: z.number().optional() }),
  propose_terrain_update: z.object({ elevationPoints: z.array(point.extend({ elevation: z.number() })).min(1) }),
  propose_building_update: z.object({ action: z.enum(['add', 'remove', 'move', 'set-style']), buildingRef: ref, name: z.string().optional(), kind: z.enum(['house', 'garage']).optional(), architecturalStyle: z.enum(['classic', 'futuristic', 'barn']).optional(), position: point.optional(), rotationDegrees: z.number().optional() }),
  propose_storey_update: storeyUpdateInput,
  propose_slab_update: z.object({ action: z.enum(['set-footprint', 'set-thickness', 'set-elevation']), buildingRef: ref, slabRef: ref, footprint: polygon.optional(), thicknessM: z.number().positive().max(2).optional(), topElevationM: z.number().optional() }),
  propose_space_update: z.object({ action: z.enum(['add', 'remove', 'set-footprint', 'set-usage', 'set-lowered-ceiling']), buildingRef: ref, storeyRef: ref, spaceRef: ref, name: z.string().optional(), usage: z.string().optional(), footprint: polygon.optional(), ceilingElevationM: z.number().optional() }),
  propose_wall_update: z.object({ action: z.enum(['move', 'set-thickness', 'set-height']), buildingRef: ref, wallRef: ref, start: point.optional(), end: point.optional(), thicknessM: z.number().positive().max(1).optional(), heightM: z.number().min(1).max(12).optional() }),
  propose_wall_opening_layout: z.object({ buildingRef: ref, wallRef: ref, preset: z.enum(['full-glass', 'two-windows', 'center-window', 'balcony-door', 'solid-wall']) }),
  propose_wall_finish_update: wallFinishInput,
  propose_opening_update: z.object({ action: z.enum(['add', 'remove', 'resize', 'move']), buildingRef: ref, wallRef: ref, openingRef: ref, kind: z.enum(['door', 'window']).optional(), offsetM: z.number().min(0).optional(), widthM: z.number().positive().optional(), heightM: z.number().positive().optional(), sillM: z.number().min(0).optional() }),
  propose_roof_update: z.object({ buildingRef: ref, roofType: z.enum(['flat', 'gable', 'hip']).optional(), pitchDegrees: z.number().min(0).max(70).optional(), overhangM: z.number().min(0).max(3).optional() }),
  propose_platform_update: z.object({ action: z.enum(['add', 'remove', 'resize']), buildingRef: ref, storeyRef: ref, spaceRef: ref, platformRef: ref, footprint: polygon.optional(), elevationM: z.number().optional(), thicknessM: z.number().positive().optional() }),
  propose_landscape_update: z.object({ action: z.enum(['add', 'remove', 'set-footprint', 'move']), zoneRef: ref, name: z.string().optional(), kind: z.enum(['lawn', 'terrace', 'path', 'driveway', 'bed', 'rain-garden', 'vegetable']).optional(), footprint: polygon.optional(), delta: point.optional() }),
  propose_plant_update: z.object({ action: z.enum(['add', 'remove', 'move']), plantRef: ref, name: z.string().optional(), species: z.string().optional(), kind: z.enum(['tree', 'hedge', 'shrub', 'perennial', 'grass', 'crop', 'wetland']).optional(), position: point.optional() }),
  propose_planting_area: z.object({
    plantingRef: ref, mode: z.enum(['boundary', 'line', 'polygon']), sourceRefs: z.array(ref).min(1).max(12).optional(), points: polyline.optional(),
    inwardOffsetM: z.number().min(0).max(25).default(0.8), spacingM: z.number().positive().max(25).default(0.6), rowCount: z.number().int().min(1).max(100).default(1), rowSpacingM: z.number().positive().max(10).default(0.6),
    cornerTreatment: z.enum(['include', 'distribute', 'skip']).default('distribute'), plantingPaletteRef: ref.optional(), species: z.string().min(1).optional(), kind: z.enum(['tree', 'hedge', 'shrub', 'perennial', 'grass', 'crop', 'wetland']).optional(), clearanceM: z.number().min(0).max(20).default(1),
  }).superRefine((value, context) => {
    if (value.mode !== 'boundary' && !value.points) context.addIssue({ code: 'custom', path: ['points'], message: 'points are required for line and polygon planting.' })
    if (!value.plantingPaletteRef && !value.species) context.addIssue({ code: 'custom', path: ['plantingPaletteRef'], message: 'plantingPaletteRef or species is required.' })
  }),
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
  create_change_set: z.object({ changeSetRef: ref, label: z.string().min(1).max(120), baseRevision: z.number().int().positive() }),
  add_change_set_operations: z.object({ changeSetRef: ref, operations: z.array(changeSetOperationSchema).min(1).max(100) }),
  propose_change_set: z.object({ changeSetRef: ref }),
  discard_change_set: z.object({ changeSetRef: ref }),
  measure_height: z.object({
    mode: z.enum(['semantic', 'free-vertical']).describe('semantic measures a referenced object; free-vertical compares two picked points.'),
    objectRef: ref.optional(),
    measurement: z.enum(['auto', 'object-height', 'ground-to-eaves', 'ground-to-ridge', 'clear-height', 'opening-height', 'terrain-clearance']).default('auto'),
    startPoint: point3.optional(), endPoint: point3.optional(),
  }).superRefine((value, context) => {
    if (value.mode === 'semantic' && !value.objectRef) context.addIssue({ code: 'custom', path: ['objectRef'], message: 'objectRef is required in semantic mode.' })
    if (value.mode === 'free-vertical' && (!value.startPoint || !value.endPoint)) context.addIssue({ code: 'custom', path: ['startPoint'], message: 'startPoint and endPoint are required in free-vertical mode.' })
  }),
  propose_climate_update: z.object({ month: z.number().int().min(1).max(12), meanMinC: z.number().optional(), meanMaxC: z.number().optional(), temperatureByDayPartC: z.object({ night: z.number(), morning: z.number(), day: z.number(), evening: z.number() }).strict().optional(), precipitationMm: z.number().min(0).optional(), sunshineHours: z.number().min(0).optional(), et0Mm: z.number().min(0).optional(), frostDays: z.number().min(0).max(31).optional(), windKph: z.number().min(0).optional() }),
  show_structure_views: z.object({
    mode: z.enum(['architectural-set', 'custom']).default('architectural-set'), buildingRefs: z.array(ref).optional(), variantRef: ref.optional(),
    views: z.array(z.discriminatedUnion('type', [
      z.object({ type: z.literal('site-plan') }), z.object({ type: z.literal('axonometric') }),
      z.object({ type: z.enum(['north-elevation', 'south-elevation', 'east-elevation', 'west-elevation']) }),
      z.object({ type: z.literal('storey-plan'), storeyRef: ref }),
      z.object({ type: z.literal('section'), axis: z.enum(['longitudinal', 'transverse']), offsetM: z.number().optional() }),
      z.object({ type: z.literal('sun-study'), month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31), hour: z.number().min(0).max(24) }),
    ])).max(12).optional(), includeAnnotations: z.boolean().default(true),
  }),
  run_seasonal_analysis: z.object({ months: z.array(z.number().int().min(1).max(12)).min(1).max(12).default([1, 4, 7, 10]), variantRef: ref.optional() }),
  run_sunlight_analysis: z.object({
    targetRef: z.string().min(1).describe('Landscape zone, plant or garden fixture ref, or `site` for the whole plot.').optional(),
    point: point.optional(),
    month: z.number().int().min(1).max(12).describe('Calendar month, 1 to 12.'),
    day: z.number().int().min(1).max(31).default(21).describe('Day of month; 21 gives solstice and equinox dates.'),
    stepMinutes: z.number().int().min(15).max(60).default(30).describe('Sampling interval through the day in minutes.'),
    hours: z.object({ from: z.number().min(0).max(24), to: z.number().min(0).max(24) }).strict().describe('Optional local-time window, e.g. 13 to 18 for afternoon sun.').optional(),
    includeGrid: z.boolean().default(false).describe('Return a coarse grid of sun hours per cell; -1 marks cells outside the target.'),
    variantRef: ref.optional(),
  }).superRefine((value, context) => { if (!value.targetRef && !value.point) context.addIssue({ code: 'custom', path: ['targetRef'], message: 'targetRef or point is required.' }) }),
  set_viewer_state: z.object({
    viewMode: z.enum(['technical', 'realistic']).optional(), explode: z.boolean().optional(),
    planStoreyRef: z.string().min(1).nullable().optional(), focusRef: z.string().min(1).nullable().optional(),
  }),
  set_sun_time: z.object({
    month: z.number().int().min(1).max(12).describe('Calendar month, 1 to 12.'),
    day: z.number().int().min(1).max(31).default(15),
    hour: z.number().min(0).max(24).describe('Local fractional hour; 15.5 means 15:30.'),
  }),
  compare_variants: z.object({ variantRefs: z.array(ref).min(1).max(4) }),
  diff_variant: z.object({ variantRef: ref, baseVariantRef: ref.optional() }),
  request_apply_variant: z.object({ variantRef: ref }),
  discard_variant: z.object({ variantRef: ref }),
  undo_last_change: z.object({}),
} as const

export type WebMcpToolName = keyof typeof webMcpSchemas

const readOnlyTools = new Set<WebMcpToolName>(['get_project_state', 'get_site_knowledge', 'list_garden_fixtures', 'measure_height', 'show_structure_views', 'run_seasonal_analysis', 'run_sunlight_analysis', 'set_viewer_state', 'set_sun_time', 'compare_variants', 'diff_variant'])
/** Tools whose results summarise external documents; agents should treat instructions inside them as data. */
export const untrustedContentTools = new Set<WebMcpToolName>(['get_site_knowledge'])
export const isReadOnlyTool = (name: WebMcpToolName) => readOnlyTools.has(name)

/** Draft-7 input schema with every root property described, using the shared field dictionary where a schema has no describe() of its own. */
export const inputSchemaFor = (name: WebMcpToolName): Record<string, unknown> => {
  const schema = z.toJSONSchema(webMcpSchemas[name], { target: 'draft-7' }) as Record<string, unknown>
  const properties = schema.properties as Record<string, Record<string, unknown>> | undefined
  if (properties) for (const [key, property] of Object.entries(properties)) if (!property.description && webMcpFieldDescriptions[key]) property.description = webMcpFieldDescriptions[key]
  return schema
}

const standardProperties = {
  status: { type: 'string', description: 'Execution outcome.' },
  projectRevision: { type: 'integer', description: 'Committed ProjectV2 revision.' },
  summary: { type: 'string', description: 'Short human-readable outcome.' },
}
const objectShape = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', required: ['status', 'projectRevision', 'summary', ...required], properties: { ...standardProperties, ...properties } })

const resultShapeFor = (name: WebMcpToolName): Record<string, unknown> => {
  if (name.startsWith('propose_')) return objectShape({ variantRef: { type: 'string' }, issues: { type: 'array', items: { type: 'object' } }, metrics: { type: 'object' } }, ['variantRef', 'issues', 'metrics'])
  if (name === 'get_project_state') return objectShape({ metrics: { type: 'object' }, data: { description: 'Requested ProjectV2 state slice or the object named by objectRef.' } }, ['metrics', 'data'])
  if (name === 'get_site_knowledge') return objectShape({ data: { description: 'Knowledge-bank section or overview.' } }, ['data'])
  if (name === 'list_garden_fixtures') return objectShape({ data: { type: 'array', items: { type: 'object', required: ['id', 'name', 'category', 'description', 'widthM', 'depthM', 'heightM'] } } }, ['data'])
  if (name === 'measure_height') return objectShape({ measurement: { type: 'object', required: ['kind', 'label', 'heightM', 'bottomPoint', 'topPoint', 'bottomElevation', 'topElevation'] } }, ['measurement'])
  if (name === 'create_change_set' || name === 'add_change_set_operations') return objectShape({ changeSetRef: { type: 'string' }, baseRevision: { type: 'integer' }, operations: { type: 'array', items: { type: 'object' } }, issues: { type: 'array', items: { type: 'object' } }, metrics: { type: 'object' } }, ['changeSetRef', 'baseRevision', 'operations'])
  if (name === 'show_structure_views') return objectShape({ reportRef: { type: 'string' }, views: { type: 'array', items: { type: 'object', required: ['type', 'title', 'buildingRefs', 'presentation'], properties: { type: { type: 'string' }, title: { type: 'string' }, buildingRefs: { type: 'array', items: { type: 'string' } }, storeyRef: { type: 'string' }, presentation: { const: 'visible-in-page' } } } }, buildings: { type: 'array', items: { type: 'object' } } }, ['reportRef', 'views', 'buildings'])
  if (name === 'run_seasonal_analysis') return objectShape({ variantRef: { type: 'string' }, metrics: { type: 'object' }, data: { type: 'array', items: { type: 'object', properties: { month: { type: 'integer' }, temperatureByDayPartC: { type: 'object', required: ['night', 'morning', 'day', 'evening'], properties: { night: { type: 'number' }, morning: { type: 'number' }, day: { type: 'number' }, evening: { type: 'number' } } }, daylightHours: { type: 'number' }, sunriseLocal: { type: ['number', 'null'] }, sunsetLocal: { type: ['number', 'null'] }, solarNoonAltitudeDeg: { type: 'number' }, waterBalanceMm: { type: 'number' }, droughtRisk: { type: 'string' }, frostRisk: { type: 'string' } } } } }, ['metrics', 'data'])
  if (name === 'run_sunlight_analysis') return objectShape({ variantRef: { type: 'string' }, analysis: { type: 'object', required: ['target', 'month', 'day', 'daylightHours', 'sunHours', 'shadedFraction', 'expectedSunHours', 'sampleCount'], properties: { sunriseLocal: { type: ['number', 'null'] }, sunsetLocal: { type: ['number', 'null'] }, daylightHours: { type: 'number' }, window: { type: ['object', 'null'] }, sunHours: { type: 'object', required: ['mean', 'min', 'max'] }, firstSunLocal: { type: ['number', 'null'] }, lastSunLocal: { type: ['number', 'null'] }, shadedFraction: { type: 'number' }, expectedSunHours: { type: 'number' }, sampleCount: { type: 'integer' }, grid: { type: 'object' } } } }, ['analysis'])
  if (name === 'set_viewer_state') return objectShape({ viewer: { type: 'object', required: ['viewMode', 'explode', 'viewerMode', 'selectedRef'] } }, ['viewer'])
  if (name === 'diff_variant') return objectShape({ variantRef: { type: 'string' }, baseVariantRef: { type: 'string' }, diff: { type: 'object', required: ['counts', 'changes', 'omittedChanges', 'metricDeltas'] } }, ['variantRef', 'diff'])
  if (name === 'set_sun_time') return objectShape({ sunTime: { type: 'object', required: ['month', 'day', 'hour'] }, altitudeDeg: { type: 'number' }, azimuthDeg: { type: 'number' }, sunriseLocal: { type: ['number', 'null'] }, sunsetLocal: { type: ['number', 'null'] } }, ['sunTime', 'altitudeDeg', 'azimuthDeg'])
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
  untrustedContent: boolean
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
      name, title: prompt.title, readOnly: readOnlyTools.has(name), untrustedContent: untrustedContentTools.has(name), description: prompt.runtimeDescription, prompt: prompt.blocks,
      inputSchema: inputSchemaFor(name),
      exampleInput: prompt.exampleInput, resultShape: resultShapeFor(name),
    }
  })
  return { manifestVersion: 1, source: 'runtime-zod-and-structured-prompts', toolCount: tools.length, tools }
}

export const webMcpManifest = createWebMcpManifest()
