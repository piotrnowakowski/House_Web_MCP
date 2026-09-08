import { z } from 'zod'
import { operationReference, webMcpFieldDescriptions, webMcpToolPrompts, type WebMcpPromptBlocks } from '../../prompts/webmcp-tools'

// Shared primitives carry no describe(): descriptions below the root are stripped from the registered schema anyway,
// and Zod still validates every field at execution time.
const point = z.object({ x: z.number(), z: z.number() }).strict()
const point3 = point.extend({ y: z.number() }).strict()
const polygon = z.array(point).min(3).max(64)
const polyline = z.array(point).min(2).max(128)
const ref = z.string().min(1)
const colorHex = z.string().regex(/^#[0-9a-fA-F]{6}$/)
const wallMaterial = z.enum(['charred-timber', 'natural-timber', 'light-render', 'brick', 'metal-panel'])
const plantKind = z.enum(['tree', 'hedge', 'shrub', 'perennial', 'grass', 'crop', 'wetland'])
const fixtureCatalogId = z.enum(['raised-bed-2x1', 'tomato-row', 'potato-row', 'cucumber-trellis', 'outdoor-dining-set', 'garden-lounge-set', 'slatted-bench', 'sun-lounger', 'cantilever-parasol'])
const roofMaterial = z.enum(['standing-seam-metal', 'tile', 'slate', 'membrane'])
const roofJunction = z.object({ ref, type: z.enum(['valley', 'intersection']), segmentRefs: z.tuple([ref, ref]) }).strict()
const roofSegmentDefinition = z.object({
  segmentRef: ref, footprint: polygon, ridgeDirection: z.enum(['x', 'z']), storeyRef: ref.optional(), spaceRef: ref.optional(),
  roofType: z.enum(['flat', 'gable', 'hip']).optional(), pitchDegrees: z.number().min(0).max(70).optional(), overhangM: z.number().min(0).max(3).optional(),
  baseElevationM: z.number().optional(), material: roofMaterial.optional(), colorHex: colorHex.optional(),
}).strict()
const roofUpdateBase = z.object({
  action: z.enum(['update', 'add-segment', 'split-segment']).default('update'), buildingRef: ref, roofRef: ref.optional(), segmentRef: ref.optional(),
  footprint: polygon.optional(), ridgeDirection: z.enum(['x', 'z']).optional(), storeyRef: ref.optional(), spaceRef: ref.optional(), segments: z.array(roofSegmentDefinition).min(2).max(8).optional(), junctions: z.array(roofJunction).max(16).optional(),
  roofType: z.enum(['flat', 'gable', 'hip']).optional(), pitchDegrees: z.number().min(0).max(70).optional(), overhangM: z.number().min(0).max(3).optional(),
  baseElevationM: z.number().optional(), targetEavesElevationM: z.number().optional(), verticalDeltaM: z.number().optional(), material: roofMaterial.optional(), colorHex: colorHex.optional(),
  synchronization: z.enum(['roof-only', 'roof-and-supporting-walls', 'storey-height']).default('roof-only'), alignToSegmentRef: ref.optional(), alignEdge: z.enum(['eaves', 'ridge']).optional(),
})
const validateRoofUpdate = (value: z.infer<typeof roofUpdateBase>, context: z.RefinementCtx) => {
  const vertical = [value.baseElevationM, value.targetEavesElevationM, value.verticalDeltaM, value.alignToSegmentRef].filter((item) => item !== undefined)
  if (vertical.length > 1) context.addIssue({ code: 'custom', path: ['baseElevationM'], message: 'Use only one direct elevation, delta, or alignment target.' })
  if (value.alignEdge && !value.alignToSegmentRef) context.addIssue({ code: 'custom', path: ['alignEdge'], message: 'alignEdge requires alignToSegmentRef.' })
  if (value.roofRef && value.segmentRef) context.addIssue({ code: 'custom', path: ['segmentRef'], message: 'Use roofRef or segmentRef, not both.' })
  if (value.action === 'add-segment' && (!value.segmentRef || !value.footprint || !value.ridgeDirection)) context.addIssue({ code: 'custom', path: ['segmentRef'], message: 'add-segment requires segmentRef, footprint and ridgeDirection.' })
  if (value.action === 'split-segment' && (!value.segmentRef || !value.segments?.length || !value.junctions?.length)) context.addIssue({ code: 'custom', path: ['segments'], message: 'split-segment requires segmentRef, at least two replacement segments, and at least one declared junction.' })
  if (value.action === 'update' && (value.footprint || value.ridgeDirection || value.storeyRef || value.spaceRef || value.junctions) && !value.segmentRef && !value.roofRef) context.addIssue({ code: 'custom', path: ['segmentRef'], message: 'Segment geometry, support and junction updates require segmentRef.' })
}

/**
 * Every operation `propose_change` and `manage_change_set` accept, validated strictly at execution.
 * Fifteen map one-to-one onto ProjectV2 commands; four macros (wall.finish with scope, wall.opening-layout, planting.area,
 * garden-fixture.preset) expand into commands in the handler. The registered JSON Schema does not carry these shapes.
 */
export const operationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('site.update'), boundary: polygon.optional(), northDegrees: z.number().optional() }),
  z.object({ type: z.literal('terrain.update'), elevationPoints: z.array(point.extend({ elevation: z.number() })).min(1) }),
  z.object({ type: z.literal('building.update'), action: z.enum(['add', 'remove', 'move', 'set-style']), buildingRef: ref, name: z.string().optional(), kind: z.enum(['house', 'garage']).optional(), architecturalStyle: z.enum(['classic', 'futuristic', 'barn']).optional(), position: point.optional(), rotationDegrees: z.number().optional() }),
  z.object({
    type: z.literal('storey.update'), action: z.enum(['add', 'remove', 'set-height', 'extend-footprint']), buildingRef: ref, storeyRef: ref, name: z.string().optional(), clearHeightM: z.number().min(2).max(8).optional(),
    footprint: polygon.optional(), extensionFootprint: polygon.optional(), spaceRef: ref.optional(), spaceName: z.string().optional(), usage: z.string().optional(),
  }).superRefine((value, context) => { if (value.action === 'extend-footprint' && !value.footprint && !value.extensionFootprint) context.addIssue({ code: 'custom', path: ['footprint'], message: 'footprint or extensionFootprint is required when extending a storey.' }) }),
  z.object({ type: z.literal('slab.update'), action: z.enum(['set-footprint', 'set-thickness', 'set-elevation']), buildingRef: ref, slabRef: ref, footprint: polygon.optional(), thicknessM: z.number().positive().max(2).optional(), topElevationM: z.number().optional() }),
  z.object({ type: z.literal('space.update'), action: z.enum(['add', 'remove', 'set-footprint', 'set-usage', 'set-lowered-ceiling']), buildingRef: ref, storeyRef: ref, spaceRef: ref, name: z.string().optional(), usage: z.string().optional(), footprint: polygon.optional(), ceilingElevationM: z.number().optional() }),
  z.object({ type: z.literal('wall.update'), action: z.enum(['move', 'set-thickness', 'set-height']), buildingRef: ref, wallRef: ref, start: point.optional(), end: point.optional(), thicknessM: z.number().positive().max(1).optional(), heightM: z.number().min(1).max(12).optional() }),
  z.object({ type: z.literal('wall.finish'), buildingRef: ref, scope: z.enum(['wall', 'all-exterior']).default('wall'), wallRef: ref.optional(), material: wallMaterial, colorHex, textureId: z.string().optional() })
    .superRefine((value, context) => { if (value.scope === 'wall' && !value.wallRef) context.addIssue({ code: 'custom', path: ['wallRef'], message: 'wallRef is required when scope is wall.' }) }),
  z.object({ type: z.literal('wall.opening-layout'), buildingRef: ref, wallRef: ref, preset: z.enum(['full-glass', 'two-windows', 'center-window', 'balcony-door', 'solid-wall']) }),
  z.object({ type: z.literal('opening.update'), action: z.enum(['add', 'remove', 'resize', 'move']), buildingRef: ref, wallRef: ref, openingRef: ref, kind: z.enum(['door', 'window']).optional(), offsetM: z.number().min(0).optional(), widthM: z.number().positive().optional(), heightM: z.number().positive().optional(), sillM: z.number().min(0).optional() }),
  roofUpdateBase.extend({ type: z.literal('roof.update') }).superRefine(validateRoofUpdate),
  z.object({ type: z.literal('platform.update'), action: z.enum(['add', 'remove', 'resize']), buildingRef: ref, storeyRef: ref, spaceRef: ref, platformRef: ref, footprint: polygon.optional(), elevationM: z.number().optional(), thicknessM: z.number().positive().optional() }),
  z.object({ type: z.literal('landscape.update'), action: z.enum(['add', 'remove', 'set-footprint', 'move', 'set-surface']), zoneRef: ref, name: z.string().optional(), kind: z.enum(['lawn', 'terrace', 'path', 'driveway', 'bed', 'rain-garden', 'vegetable']).optional(), footprint: polygon.optional(), delta: point.optional(), textureId: z.string().optional() }),
  z.object({ type: z.literal('plant.update'), action: z.enum(['add', 'remove', 'move']), plantRef: ref, name: z.string().optional(), species: z.string().optional(), kind: plantKind.optional(), position: point.optional() }),
  z.object({
    type: z.literal('planting.area'), plantingRef: ref, mode: z.enum(['boundary', 'line', 'polygon']), sourceRefs: z.array(ref).min(1).max(12).optional(), points: polyline.optional(),
    inwardOffsetM: z.number().min(0).max(25).default(0.8), spacingM: z.number().positive().max(25).default(0.6), rowCount: z.number().int().min(1).max(100).default(1), rowSpacingM: z.number().positive().max(10).default(0.6),
    cornerTreatment: z.enum(['include', 'distribute', 'skip']).default('distribute'), plantingPaletteRef: ref.optional(), species: z.string().min(1).optional(), kind: plantKind.optional(), clearanceM: z.number().min(0).max(20).default(1),
  }).superRefine((value, context) => {
    if (value.mode !== 'boundary' && !value.points) context.addIssue({ code: 'custom', path: ['points'], message: 'points are required for line and polygon planting.' })
    if (!value.plantingPaletteRef && !value.species) context.addIssue({ code: 'custom', path: ['plantingPaletteRef'], message: 'plantingPaletteRef or species is required.' })
  }),
  z.object({ type: z.literal('garden-fixture.update'), action: z.enum(['add', 'remove', 'move', 'rotate']), fixtureRef: ref, catalogId: fixtureCatalogId.optional(), name: z.string().optional(), position: point.optional(), rotationDegrees: z.number().optional() })
    .superRefine((value, context) => {
      const issue = (path: string, message: string) => context.addIssue({ code: 'custom', path: [path], message })
      if (value.action === 'add' && !value.catalogId) issue('catalogId', 'catalogId is required when adding a fixture.')
      if (['add', 'move'].includes(value.action) && !value.position) issue('position', `position is required when action is ${value.action}.`)
      if (value.action === 'rotate' && value.rotationDegrees === undefined) issue('rotationDegrees', 'rotationDegrees is required when rotating a fixture.')
    }),
  z.object({ type: z.literal('garden-fixture.preset'), preset: z.enum(['starter-kitchen-garden', 'tomato-raised-bed', 'potato-raised-bed', 'cucumber-raised-bed']), setRef: ref, origin: point.optional(), placement: z.enum(['at-origin', 'next-to-existing']).optional(), rotationDegrees: z.number().optional() })
    .superRefine((value, context) => { if (!value.origin && value.placement !== 'next-to-existing') context.addIssue({ code: 'custom', path: ['origin'], message: 'origin is required unless placement is next-to-existing.' }) }),
  z.object({ type: z.literal('climate.update'), month: z.number().int().min(1).max(12), meanMinC: z.number().optional(), meanMaxC: z.number().optional(), temperatureByDayPartC: z.object({ night: z.number(), morning: z.number(), day: z.number(), evening: z.number() }).strict().optional(), precipitationMm: z.number().min(0).optional(), sunshineHours: z.number().min(0).optional(), et0Mm: z.number().min(0).optional(), frostDays: z.number().min(0).max(31).optional(), windKph: z.number().min(0).optional() }),
])
export type WebMcpOperation = z.infer<typeof operationSchema>
export const operationsSchema = z.object({ operations: z.array(operationSchema).min(1).max(100) })

/** Strict view definitions, parsed in the handler; the registered schema only promises `{type, ...}` objects. */
export const structureViewsSchema = z.array(z.discriminatedUnion('type', [
  z.object({ type: z.literal('site-plan') }), z.object({ type: z.literal('axonometric') }),
  z.object({ type: z.enum(['north-elevation', 'south-elevation', 'east-elevation', 'west-elevation']) }),
  z.object({ type: z.literal('storey-plan'), storeyRef: ref }),
  z.object({ type: z.literal('section'), axis: z.enum(['longitudinal', 'transverse']), offsetM: z.number().optional() }),
  z.object({ type: z.literal('sun-study'), month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31), hour: z.number().min(0).max(24) }),
])).max(12)

const looseTyped = z.looseObject({ type: z.string().min(1) })
const looseOperations = z.array(looseTyped).min(1).max(100)

export const webMcpSchemas = {
  get_project_state: z.object({ detail: z.enum(['summary', 'site', 'structure', 'landscape', 'full']).default('summary'), objectRef: ref.optional() }),
  get_site_knowledge: z.object({ section: z.enum(['sources', 'measurements', 'terrain', 'geotechnical', 'planting', 'designRules', 'caveats']).optional() }),
  get_proposals: z.object({
    action: z.enum(['list', 'diff', 'compare']).default('list').describe('list proposal history, diff one variant against the project, or compare up to four variants.'),
    proposalRef: ref.optional(), baseVariantRef: ref.optional(), variantRefs: z.array(ref).min(1).max(4).optional(),
    status: z.enum(['pending', 'approved', 'rejected', 'stale']).optional(), includeDrafts: z.boolean().default(true),
  }).superRefine((value, context) => {
    if (value.action === 'diff' && !value.proposalRef) context.addIssue({ code: 'custom', path: ['proposalRef'], message: 'diff requires proposalRef.' })
    if (value.action === 'compare' && !value.variantRefs?.length) context.addIssue({ code: 'custom', path: ['variantRefs'], message: 'compare requires variantRefs.' })
  }),
  list_catalog: z.object({ catalog: z.enum(['garden-fixtures', 'textures', 'operations']), surface: z.enum(['wall', 'ground']).optional(), type: z.string().min(1).optional() }),
  measure_height: z.object({
    mode: z.enum(['semantic', 'free-vertical']), objectRef: ref.optional(),
    measurement: z.enum(['auto', 'object-height', 'ground-to-eaves', 'ground-to-ridge', 'clear-height', 'opening-height', 'terrain-clearance']).default('auto'),
    startPoint: point3.optional(), endPoint: point3.optional(),
  }).superRefine((value, context) => {
    if (value.mode === 'semantic' && !value.objectRef) context.addIssue({ code: 'custom', path: ['objectRef'], message: 'objectRef is required in semantic mode.' })
    if (value.mode === 'free-vertical' && (!value.startPoint || !value.endPoint)) context.addIssue({ code: 'custom', path: ['startPoint'], message: 'startPoint and endPoint are required in free-vertical mode.' })
  }),
  run_analysis: z.object({
    kind: z.enum(['seasonal', 'sunlight']), months: z.array(z.number().int().min(1).max(12)).min(1).max(12).optional(),
    targetRef: z.string().min(1).optional(), point: point.optional(), month: z.number().int().min(1).max(12).optional(), day: z.number().int().min(1).max(31).optional(),
    stepMinutes: z.number().int().min(15).max(60).optional(), hours: z.object({ from: z.number().min(0).max(24), to: z.number().min(0).max(24) }).strict().optional(),
    includeGrid: z.boolean().optional(), variantRef: ref.optional(),
  }).superRefine((value, context) => {
    if (value.kind !== 'sunlight') return
    if (value.month === undefined) context.addIssue({ code: 'custom', path: ['month'], message: 'month is required for sunlight analysis.' })
    if (!value.targetRef && !value.point) context.addIssue({ code: 'custom', path: ['targetRef'], message: 'targetRef or point is required.' })
  }),
  show_structure_views: z.object({
    mode: z.enum(['architectural-set', 'custom']).default('architectural-set'), buildingRefs: z.array(ref).optional(), variantRef: ref.optional(),
    views: z.array(looseTyped).max(12).optional(), includeAnnotations: z.boolean().default(true),
  }),
  set_viewer_state: z.object({
    explode: z.boolean().optional(), planStoreyRef: z.string().min(1).nullable().optional(), focusRef: z.string().min(1).nullable().optional(),
    sunTime: z.object({ month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31).default(15), hour: z.number().min(0).max(24) }).strict().optional(),
  }),
  propose_change: z.object({ label: z.string().min(1).max(120).optional(), operations: looseOperations }),
  manage_change_set: z.object({
    action: z.enum(['create', 'add-operations', 'finalize', 'discard']).describe('create a draft, add-operations to it, finalize it into a ghost variant, or discard it.'), changeSetRef: ref,
    label: z.string().min(1).max(120).optional(), baseRevision: z.number().int().positive().optional(), operations: looseOperations.optional(),
  }).superRefine((value, context) => {
    if (value.action === 'create' && (!value.label || value.baseRevision === undefined)) context.addIssue({ code: 'custom', path: ['label'], message: 'create requires label and baseRevision.' })
    if (value.action === 'add-operations' && !value.operations?.length) context.addIssue({ code: 'custom', path: ['operations'], message: 'add-operations requires at least one operation.' })
  }),
  manage_variant: z.object({
    action: z.enum(['request-apply', 'discard', 'undo-last-change']).describe('request-apply asks the person to review; discard rejects a pending variant; undo-last-change reverts the last commit.'),
    variantRef: ref.optional(), reason: z.string().max(500).optional(),
  }).superRefine((value, context) => { if (value.action !== 'undo-last-change' && !value.variantRef) context.addIssue({ code: 'custom', path: ['variantRef'], message: `variantRef is required for ${value.action}.` }) }),
} as const

export type WebMcpToolName = keyof typeof webMcpSchemas

const readOnlyTools = new Set<WebMcpToolName>(['get_project_state', 'get_site_knowledge', 'get_proposals', 'list_catalog', 'measure_height', 'run_analysis', 'show_structure_views', 'set_viewer_state'])
/** Tools whose results summarise external documents; agents should treat instructions inside them as data. */
export const untrustedContentTools = new Set<WebMcpToolName>(['get_site_knowledge'])
export const isReadOnlyTool = (name: WebMcpToolName) => readOnlyTools.has(name)

/**
 * Shrinks a draft-7 schema for registration: no `$schema`, no nested `additionalProperties`, and descriptions only on root
 * parameters. Zod keeps the full rules at execution; the browser only needs the parameter list and its enums.
 */
export const compactSchema = (schema: unknown, depth = 0): unknown => {
  if (Array.isArray(schema)) return schema.map((item) => compactSchema(item, depth))
  if (!schema || typeof schema !== 'object') return schema
  const output: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
    if (key === '$schema') continue
    if (key === 'additionalProperties' && depth > 0) continue
    if (key === 'description' && depth > 1) continue
    if (key === 'properties' && value && typeof value === 'object') output[key] = Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([name, property]) => [name, compactSchema(property, depth + 1)]))
    else if (key === 'items' || key === 'anyOf' || key === 'oneOf' || key === 'allOf' || key === 'prefixItems') output[key] = compactSchema(value, depth + 1)
    else output[key] = value
  }
  return output
}

/** Compact input schema with every root property described, using the shared field dictionary where a schema has no describe() of its own. */
export const inputSchemaFor = (name: WebMcpToolName): Record<string, unknown> => {
  const schema = compactSchema(z.toJSONSchema(webMcpSchemas[name], { target: 'draft-7' })) as Record<string, unknown>
  const properties = schema.properties as Record<string, Record<string, unknown>> | undefined
  if (properties) for (const [key, property] of Object.entries(properties)) if (!property.description && webMcpFieldDescriptions[key]) property.description = webMcpFieldDescriptions[key]
  return schema
}

/** What a browser or agent runtime pays for the catalog: names, descriptions, schemas and annotations, in characters and estimated tokens. */
export interface CatalogBudget { toolCount: number; chars: number; estimatedTokens: number; largest: { name: string; chars: number }; perTool: Array<{ name: string; chars: number }> }
const CHARS_PER_TOKEN = 3.5
export const catalogBudget = (tools: ReadonlyArray<{ name: string; description: string; inputSchema?: unknown; annotations?: unknown }>): CatalogBudget => {
  const perTool = tools.map((tool) => ({ name: tool.name, chars: JSON.stringify({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema ?? {}, annotations: tool.annotations ?? {} }).length }))
  const chars = perTool.reduce((sum, tool) => sum + tool.chars, 0)
  const largest = perTool.reduce((best, tool) => tool.chars > best.chars ? tool : best, { name: '', chars: 0 })
  return { toolCount: tools.length, chars, estimatedTokens: Math.ceil(chars / CHARS_PER_TOKEN), largest, perTool }
}

const standardProperties = {
  status: { type: 'string', description: 'Execution outcome.' },
  projectRevision: { type: 'integer', description: 'Committed ProjectV2 revision.' },
  summary: { type: 'string', description: 'Short human-readable outcome.' },
}
const objectShape = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', required: ['status', 'projectRevision', 'summary', ...required], properties: { ...standardProperties, ...properties } })

const resultShapeFor = (name: WebMcpToolName): Record<string, unknown> => {
  if (name === 'propose_change') return objectShape({
    variantRef: { type: 'string' }, issues: { type: 'array', items: { type: 'object' } }, metrics: { type: 'object' }, operations: { type: 'array', items: { type: 'object', required: ['index', 'type'] } }, affectedRefs: { type: 'array', items: { type: 'string' } },
    areaAddedM2: { type: 'number' }, buildingHeightM: { type: 'number' }, levelCount: { type: 'integer' }, roofChanges: { type: 'array', items: { type: 'object' } }, junctions: { type: 'array', items: { type: 'object' } }, plantCount: { type: 'integer' }, conflicts: { type: 'array', items: { type: 'object' } },
  }, ['variantRef', 'issues', 'metrics', 'operations', 'affectedRefs'])
  if (name === 'get_project_state') return objectShape({ metrics: { type: 'object' }, data: { description: 'Requested ProjectV2 state slice or the object named by objectRef.' } }, ['metrics', 'data'])
  if (name === 'get_site_knowledge') return objectShape({ data: { description: 'Knowledge-bank section or overview.' } }, ['data'])
  if (name === 'get_proposals') return objectShape({ counts: { type: 'object' }, proposals: { type: 'array', items: { type: 'object' } }, drafts: { type: 'array', items: { type: 'object' } }, variantRef: { type: 'string' }, baseVariantRef: { type: 'string' }, diff: { type: 'object' }, data: { type: 'array', items: { type: 'object' } } })
  if (name === 'list_catalog') return objectShape({ data: { type: 'array', items: { type: 'object' } } }, ['data'])
  if (name === 'measure_height') return objectShape({ measurement: { type: 'object', required: ['kind', 'label', 'heightM', 'bottomPoint', 'topPoint', 'bottomElevation', 'topElevation'] } }, ['measurement'])
  if (name === 'manage_change_set') return objectShape({ changeSetRef: { type: 'string' }, baseRevision: { type: 'integer' }, operations: { type: 'array', items: { type: 'object' } }, issues: { type: 'array', items: { type: 'object' } }, metrics: { type: 'object' }, variantRef: { type: 'string' } }, ['changeSetRef'])
  if (name === 'show_structure_views') return objectShape({ reportRef: { type: 'string' }, views: { type: 'array', items: { type: 'object', required: ['type', 'title', 'buildingRefs', 'presentation'], properties: { type: { type: 'string' }, title: { type: 'string' }, buildingRefs: { type: 'array', items: { type: 'string' } }, storeyRef: { type: 'string' }, presentation: { const: 'visible-in-page' } } } }, buildings: { type: 'array', items: { type: 'object' } } }, ['reportRef', 'views', 'buildings'])
  if (name === 'run_analysis') return objectShape({ kind: { type: 'string' }, variantRef: { type: 'string' }, metrics: { type: 'object' }, data: { type: 'array', items: { type: 'object', properties: { month: { type: 'integer' }, temperatureByDayPartC: { type: 'object', required: ['night', 'morning', 'day', 'evening'] }, daylightHours: { type: 'number' }, sunriseLocal: { type: ['number', 'null'] }, sunsetLocal: { type: ['number', 'null'] }, solarNoonAltitudeDeg: { type: 'number' }, waterBalanceMm: { type: 'number' }, droughtRisk: { type: 'string' }, frostRisk: { type: 'string' } } } }, analysis: { type: 'object', properties: { sunriseLocal: { type: ['number', 'null'] }, sunsetLocal: { type: ['number', 'null'] }, daylightHours: { type: 'number' }, window: { type: ['object', 'null'] }, sunHours: { type: 'object', required: ['mean', 'min', 'max'] }, firstSunLocal: { type: ['number', 'null'] }, lastSunLocal: { type: ['number', 'null'] }, shadedFraction: { type: 'number' }, expectedSunHours: { type: 'number' }, sampleCount: { type: 'integer' }, grid: { type: 'object' } } } }, ['kind'])
  if (name === 'set_viewer_state') return objectShape({ viewer: { type: 'object', required: ['explode', 'viewerMode', 'selectedRef'] }, sunTime: { type: 'object' }, altitudeDeg: { type: 'number' }, azimuthDeg: { type: 'number' }, sunriseLocal: { type: ['number', 'null'] }, sunsetLocal: { type: ['number', 'null'] } }, ['viewer'])
  if (name === 'manage_variant') return objectShape({ variantRef: { type: 'string' }, metrics: { type: 'object' } })
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
  budget: { chars: number; estimatedTokens: number; tokenLimit: number }
  operations: typeof operationReference
  tools: WebMcpManifestTool[]
}

export const CHATGPT_TOOL_TOKEN_LIMIT = 5000

export const createWebMcpManifest = (): WebMcpManifest => {
  const tools = (Object.keys(webMcpSchemas) as WebMcpToolName[]).map((name) => {
    const prompt = webMcpToolPrompts[name]
    return {
      name, title: prompt.title, readOnly: readOnlyTools.has(name), untrustedContent: untrustedContentTools.has(name), description: prompt.runtimeDescription, prompt: prompt.blocks,
      inputSchema: inputSchemaFor(name),
      exampleInput: prompt.exampleInput, resultShape: resultShapeFor(name),
    }
  })
  const budget = catalogBudget(tools.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema, annotations: tool.readOnly ? { readOnlyHint: true } : undefined })))
  return { manifestVersion: 1, source: 'runtime-zod-and-structured-prompts', toolCount: tools.length, budget: { chars: budget.chars, estimatedTokens: budget.estimatedTokens, tokenLimit: CHATGPT_TOOL_TOKEN_LIMIT }, operations: operationReference, tools }
}

export const webMcpManifest = createWebMcpManifest()
