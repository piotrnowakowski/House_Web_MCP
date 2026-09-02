import { z } from 'zod'
import { calculateMetrics } from '../domain/commands'
import { analyzeSeason } from '../domain/seasonal'
import type { ProjectCommand, ProjectIssue, ProjectMetrics, ProjectV1, VariantModel } from '../domain/types'
import { useStudioStore } from '../state/store'
import { exportProjectJson, exportSceneGlb, exportScenePng } from './export'

type ToolStatus = 'ok' | 'variant_created' | 'needs_confirmation' | 'applied' | 'rejected' | 'cancelled' | 'error'
interface ToolPayload {
  status: ToolStatus
  projectRevision: number
  summary: string
  variantRef?: string
  issues?: ProjectIssue[]
  metrics?: ProjectMetrics
  data?: unknown
}

const content = (payload: ToolPayload): WebMcpToolResult => ({ content: [{ type: 'text', text: JSON.stringify(payload) }] })
const schema = (value: z.ZodType) => z.toJSONSchema(value, { target: 'draft-7' }) as Record<string, unknown>
const positionSchema = z.object({ x: z.number().describe('East-west coordinate in meters.'), z: z.number().describe('North-south coordinate in meters.') })
const refString = z.string().min(1).describe('Stable semantic reference such as room/living-room.')

const getStateSchema = z.object({ detail: z.enum(['summary', 'site', 'structure', 'garden', 'full']).default('summary') })
const plotSchema = z.object({
  northDegrees: z.number().optional(),
  boundary: z.array(positionSchema).min(3).optional(),
  elevationPoints: z.array(positionSchema.extend({ elevation: z.number() })).min(1).optional(),
})
const buildingSchema = z.object({
  action: z.enum(['add', 'remove', 'set-roof', 'move']), buildingRef: refString, name: z.string().optional(), kind: z.enum(['house', 'garage']).optional(),
  position: positionSchema.optional(), rotationDegrees: z.number().optional(), roofType: z.enum(['flat', 'gable', 'hip']).optional(),
  pitchDegrees: z.number().min(0).max(70).optional(), overhangM: z.number().min(0).max(3).optional(),
})
const floorSchema = z.object({
  action: z.enum(['add', 'remove', 'set-height']), buildingRef: refString, floorRef: refString,
  name: z.string().optional(), heightM: z.number().min(2).max(8).optional(),
})
const roomSchema = z.object({
  action: z.enum(['add', 'remove', 'move', 'resize', 'set-ceiling']), buildingRef: refString, floorRef: refString, roomRef: refString,
  name: z.string().optional(), usage: z.string().optional(), position: positionSchema.optional(), widthM: z.number().min(1).max(30).optional(),
  depthM: z.number().min(1).max(30).optional(), heightM: z.number().min(2).max(10).optional(), rotationDegrees: z.number().optional(),
  ceilingType: z.enum(['flat', 'lowered', 'sloped']).optional(),
})
const mezzanineSchema = z.object({
  action: z.enum(['add', 'remove', 'resize']), buildingRef: refString, floorRef: refString, roomRef: refString, mezzanineRef: refString,
  position: positionSchema.optional(), widthM: z.number().min(1).optional(), depthM: z.number().min(1).optional(), elevationM: z.number().min(1.8).optional(),
})
const garageSchema = z.object({
  action: z.enum(['add', 'remove', 'resize', 'move']), garageRef: refString, mode: z.enum(['integrated', 'attached']).optional(),
  position: positionSchema.optional(), widthM: z.number().min(2.5).optional(), depthM: z.number().min(4).optional(), heightM: z.number().min(2.2).optional(),
})
const gardenPlanSchema = z.object({
  goals: z.array(z.string()).min(1).describe('Design goals, for example low water, play lawn, vegetables, or year-round interest.'),
  preserveRefs: z.array(refString).default([]), waterPreference: z.enum(['low', 'balanced', 'lush']).default('low'),
})
const gardenUpdateSchema = z.object({
  action: z.enum(['add-zone', 'remove-zone', 'move-zone', 'add-plant', 'remove-plant', 'move-plant']), subjectRef: refString,
  name: z.string().optional(), kind: z.enum(['lawn', 'terrace', 'path', 'driveway', 'bed', 'rain-garden', 'vegetable', 'tree', 'hedge', 'shrub', 'perennial', 'grass', 'crop', 'wetland']).optional(),
  position: positionSchema.optional(), widthM: z.number().positive().optional(), depthM: z.number().positive().optional(), species: z.string().optional(),
})
const climateSchema = z.object({
  month: z.number().int().min(1).max(12), meanMinC: z.number().optional(), meanMaxC: z.number().optional(), precipitationMm: z.number().min(0).optional(),
  sunshineHours: z.number().min(0).optional(), et0Mm: z.number().min(0).optional(), frostDays: z.number().min(0).max(31).optional(), windKph: z.number().min(0).optional(),
})
const seasonSchema = z.object({ months: z.array(z.number().int().min(1).max(12)).min(1).max(12).default([1, 4, 7, 10]), variantRef: refString.optional() })
const compareSchema = z.object({ variantRefs: z.array(refString).min(1).max(4) })
const variantRefSchema = z.object({ variantRef: refString })
const emptySchema = z.object({})
const exportSchema = z.object({ format: z.enum(['json', 'glb', 'png']) })

const variantPayload = (variant: VariantModel): ToolPayload => ({
  status: 'variant_created', projectRevision: variant.baseRevision, variantRef: variant.ref,
  summary: `${variant.label} created for visual review. It has ${variant.issues.filter((issue) => issue.severity === 'error').length} blocking issues and ${variant.issues.filter((issue) => issue.severity === 'warning').length} warnings.`,
  issues: variant.issues, metrics: variant.metrics,
})

const createVariant = (label: string, command: ProjectCommand) => variantPayload(useStudioStore.getState().createVariant(label, [command]))

let variantWaiter: { ref: string; resolve: (value: ToolPayload) => void; reject: (reason: unknown) => void; cleanup: () => void } | null = null
let exportWaiter: { format: 'json' | 'glb' | 'png'; resolve: (value: ToolPayload) => void; reject: (reason: unknown) => void; cleanup: () => void } | null = null

export const resolveVariantConfirmation = (approved: boolean) => {
  const state = useStudioStore.getState()
  const ref = state.confirmationVariantRef
  if (!ref) return
  try {
    if (approved) {
      const project = state.applyVariant(ref)
      variantWaiter?.resolve({ status: 'applied', projectRevision: project.revision, variantRef: ref, summary: 'The user approved and applied the variant.', metrics: calculateMetrics(project) })
    } else {
      state.discardVariant(ref)
      variantWaiter?.resolve({ status: 'rejected', projectRevision: state.project.revision, variantRef: ref, summary: 'The user rejected the variant.' })
    }
  } catch (error) {
    variantWaiter?.reject(error)
    state.setConfirmationVariantRef(null)
  } finally {
    variantWaiter?.cleanup()
    variantWaiter = null
  }
}

export const resolveExportConfirmation = async (approved: boolean) => {
  const state = useStudioStore.getState()
  const format = state.pendingExport
  if (!format) return
  try {
    if (!approved) {
      exportWaiter?.resolve({ status: 'rejected', projectRevision: state.project.revision, summary: 'The user cancelled the export.' })
      return
    }
    if (format === 'json') exportProjectJson(state.project)
    else if (format === 'glb') await exportSceneGlb()
    else exportScenePng()
    exportWaiter?.resolve({ status: 'ok', projectRevision: state.project.revision, summary: `${format.toUpperCase()} export completed after user confirmation.` })
  } catch (error) {
    exportWaiter?.reject(error)
  } finally {
    exportWaiter?.cleanup()
    exportWaiter = null
    state.setPendingExport(null)
  }
}

const requestVariantApproval = (ref: string, signal: AbortSignal) => new Promise<ToolPayload>((resolve, reject) => {
  const state = useStudioStore.getState()
  const variant = state.variants.find((item) => item.ref === ref)
  if (!variant) return reject(new Error(`Variant not found: ${ref}`))
  if (variantWaiter) return reject(new Error('Another variant is already awaiting confirmation.'))
  const abort = () => {
    state.setConfirmationVariantRef(null)
    variantWaiter = null
    reject(new DOMException('The agent cancelled the confirmation request.', 'AbortError'))
  }
  signal.addEventListener('abort', abort, { once: true })
  variantWaiter = { ref, resolve, reject, cleanup: () => signal.removeEventListener('abort', abort) }
  state.setConfirmationVariantRef(ref)
  state.setToast('Agent requests approval. Review the ghost model before applying.')
})

const requestExportApproval = (format: 'json' | 'glb' | 'png', signal: AbortSignal) => new Promise<ToolPayload>((resolve, reject) => {
  const state = useStudioStore.getState()
  if (exportWaiter) return reject(new Error('Another export is already awaiting confirmation.'))
  const abort = () => {
    state.setPendingExport(null)
    exportWaiter = null
    reject(new DOMException('The agent cancelled the export request.', 'AbortError'))
  }
  signal.addEventListener('abort', abort, { once: true })
  exportWaiter = { format, resolve, reject, cleanup: () => signal.removeEventListener('abort', abort) }
  state.setPendingExport(format)
  state.setToast(`Agent requests permission to export ${format.toUpperCase()}.`)
})

const projectForVariant = (project: ProjectV1, variants: VariantModel[], ref?: string) => ref ? variants.find((variant) => variant.ref === ref)?.project ?? project : project

type Handler<T> = (input: T, options: WebMcpExecuteOptions) => ToolPayload | Promise<ToolPayload>
const define = <S extends z.ZodType>(definition: {
  name: string; title: string; description: string; input: S; readOnly?: boolean; handler: Handler<z.infer<S>>
}): WebMcpTool => ({
  name: definition.name, title: definition.title, description: definition.description, inputSchema: schema(definition.input),
  annotations: definition.readOnly ? { readOnlyHint: true } : undefined,
  execute: async (raw, options) => {
    try {
      const executionOptions = { signal: options?.signal ?? new AbortController().signal }
      if (executionOptions.signal.aborted) throw new DOMException('Tool execution cancelled.', 'AbortError')
      return content(await definition.handler(definition.input.parse(raw), executionOptions))
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === 'AbortError'
      return content({ status: aborted ? 'cancelled' : 'error', projectRevision: useStudioStore.getState().project.revision, summary: error instanceof Error ? error.message : 'Tool execution failed.' })
    }
  },
})

export const webMcpTools: WebMcpTool[] = [
  define({ name: 'get_project_state', title: 'Inspect Zielonki 3D project', description: 'Read the current Zielonki parcel, evidence, geotechnical, building, floor, room, garage, garden, climate, variant, and validation state. Use detail "site" for the concise sourced knowledge bank. Call this before proposing changes.', input: getStateSchema, readOnly: true, handler: ({ detail }) => {
    const state = useStudioStore.getState()
    const metrics = calculateMetrics(state.project)
    const constructionParcels = state.project.plot.parcels.filter((parcel) => parcel.landRole === 'construction')
    const agriculturalParcels = state.project.plot.parcels.filter((parcel) => parcel.landRole === 'agricultural')
    const data = detail === 'summary' ? {
      name: state.project.name,
      revision: state.project.revision,
      site: {
        locality: state.project.knowledgeBase.locality,
        constructionParcels: constructionParcels.map((parcel) => parcel.cadastralNumber),
        constructionAreaM2: constructionParcels.reduce((sum, parcel) => sum + parcel.officialAreaM2, 0),
        agriculturalParcels: agriculturalParcels.map((parcel) => parcel.cadastralNumber),
        agriculturalAreaM2: agriculturalParcels.reduce((sum, parcel) => sum + parcel.officialAreaM2, 0),
        foundationReviewRequired: true,
      },
      metrics,
      variantRefs: state.variants.map((variant) => variant.ref),
    }
      : detail === 'site' ? { plot: state.project.plot, knowledgeBase: state.project.knowledgeBase }
        : detail === 'structure' ? { plot: state.project.plot, buildings: state.project.buildings, designRules: state.project.knowledgeBase.designRules }
        : detail === 'garden' ? { garden: state.project.garden, climateProfile: state.project.climateProfile }
          : state.project
    return { status: 'ok', projectRevision: state.project.revision, summary: `Returned ${detail} project state.`, metrics, data }
  } }),
  define({ name: 'propose_plot_update', title: 'Propose plot update', description: 'Create a reversible 3D variant that changes the polygonal plot, north direction, or terrain elevation control points.', input: plotSchema, handler: (input) => createVariant('Plot update', { type: 'plot.update', ...input }) }),
  define({ name: 'propose_building_update', title: 'Propose building update', description: 'Create a reversible 3D variant that adds, removes, moves, rotates, or changes the roof of a building.', input: buildingSchema, handler: (input) => createVariant('Building update', { type: 'building.update', action: input.action, buildingRef: input.buildingRef, name: input.name, kind: input.kind, position: input.position, rotationDegrees: input.rotationDegrees, roof: input.roofType ? { type: input.roofType, pitchDegrees: input.pitchDegrees ?? (input.roofType === 'flat' ? 0 : 28), overhangM: input.overhangM ?? 0.4 } : undefined }) }),
  define({ name: 'propose_floor_update', title: 'Propose floor update', description: 'Create a reversible 3D variant that adds or removes a floor or changes its clear height.', input: floorSchema, handler: (input) => createVariant('Floor update', { type: 'floor.update', ...input }) }),
  define({ name: 'propose_room_update', title: 'Propose room update', description: 'Create a reversible 3D variant that adds, removes, moves, resizes, rotates, or changes the ceiling of an unlocked room.', input: roomSchema, handler: (input) => createVariant('Room update', { type: 'room.update', ...input }) }),
  define({ name: 'propose_mezzanine_update', title: 'Propose mezzanine update', description: 'Create a reversible 3D variant that adds, removes, or resizes a mezzanine inside an unlocked room.', input: mezzanineSchema, handler: (input) => createVariant('Mezzanine update', { type: 'mezzanine.update', ...input }) }),
  define({ name: 'propose_garage_update', title: 'Propose garage update', description: 'Create a reversible 3D variant for an integrated or attached garage.', input: garageSchema, handler: (input) => createVariant('Garage update', { type: 'garage.update', ...input }) }),
  define({ name: 'propose_garden_plan', title: 'Propose complete garden', description: 'Generate a reversible seasonal 3D garden variant from design goals, locked elements, and a water-use preference.', input: gardenPlanSchema, handler: (input) => createVariant('Agent garden plan', { type: 'garden.plan', ...input }) }),
  define({ name: 'propose_garden_update', title: 'Propose garden update', description: 'Create a reversible 3D variant that adds, removes, or moves one garden zone or plant.', input: gardenUpdateSchema, handler: (input) => createVariant('Garden update', { type: 'garden.update', ...input }) }),
  define({ name: 'propose_climate_update', title: 'Propose climate update', description: 'Create a reversible variant that edits one month of the local climate profile used by seasonal analysis.', input: climateSchema, handler: ({ month, ...values }) => createVariant('Climate profile update', { type: 'climate.update', month, values }) }),
  define({ name: 'run_seasonal_analysis', title: 'Run seasonal analysis', description: 'Estimate daylight, representative sun, water balance, drought, frost, foliage, and bloom for selected months.', input: seasonSchema, readOnly: true, handler: ({ months, variantRef }) => {
    const state = useStudioStore.getState()
    const project = projectForVariant(state.project, state.variants, variantRef)
    return { status: 'ok', projectRevision: state.project.revision, variantRef, summary: `Seasonal analysis completed for ${months.length} month(s).`, metrics: calculateMetrics(project), data: analyzeSeason(project, months) }
  } }),
  define({ name: 'compare_variants', title: 'Compare 3D variants', description: 'Compare metrics, validation issues, and revisions for up to four visible 3D variants.', input: compareSchema, readOnly: true, handler: ({ variantRefs }) => {
    const state = useStudioStore.getState()
    const variants = variantRefs.map((ref) => state.variants.find((item) => item.ref === ref)).filter((item): item is VariantModel => Boolean(item))
    return { status: 'ok', projectRevision: state.project.revision, summary: `Compared ${variants.length} variant(s).`, data: variants.map(({ ref, label, baseRevision, metrics, issues }) => ({ ref, label, baseRevision, metrics, issues })) }
  } }),
  define({ name: 'request_apply_variant', title: 'Request variant approval', description: 'Show the selected ghost variant in the 3D canvas and wait until the human explicitly applies or rejects it.', input: variantRefSchema, handler: ({ variantRef }, { signal }) => requestVariantApproval(variantRef, signal) }),
  define({ name: 'discard_variant', title: 'Discard variant', description: 'Discard a reversible proposal without changing the committed project.', input: variantRefSchema, handler: ({ variantRef }) => {
    const state = useStudioStore.getState(); state.discardVariant(variantRef)
    return { status: 'ok', projectRevision: state.project.revision, variantRef, summary: 'Variant discarded.' }
  } }),
  define({ name: 'undo_last_change', title: 'Undo committed change', description: 'Undo the most recent committed project change. This does not affect uncommitted variants.', input: emptySchema, handler: () => {
    const project = useStudioStore.getState().undo()
    return { status: 'ok', projectRevision: project.revision, summary: 'Last committed change was undone.', metrics: calculateMetrics(project) }
  } }),
  define({ name: 'request_export', title: 'Request project export', description: 'Ask the human to confirm export of the project as versioned JSON, the visible 3D scene as GLB, or a PNG image.', input: exportSchema, handler: ({ format }, { signal }) => requestExportApproval(format, signal) }),
]

export const registerWebMcpTools = () => {
  const modelContext = document.modelContext
  const available = Boolean(modelContext?.registerTool)
  useStudioStore.getState().setWebMcpAvailable(available)
  if (!modelContext) return () => undefined
  const controller = new AbortController()
  Promise.all(webMcpTools.map((tool) => modelContext.registerTool(tool, { signal: controller.signal }))).catch((error) => {
    if (!controller.signal.aborted) useStudioStore.getState().setToast(`WebMCP registration failed: ${error instanceof Error ? error.message : 'unknown error'}`)
  })
  return () => controller.abort()
}
