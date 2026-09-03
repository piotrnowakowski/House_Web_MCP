import { z } from 'zod'
import { webMcpToolPrompts } from '../../prompts/webmcp-tools'
import { applyCommands, calculateMetrics, validateProject } from '../domain/commands'
import { gardenFixtureCatalog, gardenFixtureSetCommands, nextGardenBedPosition } from '../domain/gardenFixtures'
import { buildingPlacement } from '../domain/roofWings'
import { measureHeight } from '../domain/heightMeasurements'
import { createPlantingAreaPlan } from '../domain/plantingAreas'
import { analyzeSeason } from '../domain/seasonal'
import { solarPosition, sunriseSunset } from '../domain/solar'
import { analyzeSunlight, downsampleSunGrid, formatSunMoment, resolveSunTarget } from '../domain/sunlight'
import type { ProjectCommand, ProjectIssue, ProjectMetrics, ProjectV2, VariantModel } from '../domain/types'
import { wallFinishCommands } from '../domain/wallFinishes'
import { wallOpeningLayoutCommands } from '../domain/wallOpeningLayouts'
import { useStudioStore } from '../state/store'
import { showStructureViews } from './structureViews'
import { webMcpSchemas } from './webmcpDefinitions'

type ToolPayload = { status: string; projectRevision: number; summary: string; variantRef?: string; issues?: ProjectIssue[]; metrics?: ProjectMetrics; data?: unknown; [key: string]: unknown }
const content = (payload: ToolPayload): WebMcpToolResult => ({ content: [{ type: 'text', text: JSON.stringify(payload) }] })
const variantPayload = (variant: VariantModel): ToolPayload => ({ status: 'variant_created', projectRevision: variant.baseRevision, variantRef: variant.ref, summary: `${variant.label} created for visible review.`, issues: variant.issues, metrics: variant.metrics })
const createVariant = (label: string, command: ProjectCommand) => variantPayload(useStudioStore.getState().createVariant(label, [command]))
const createVariantFromCommands = (label: string, commands: ProjectCommand[]) => variantPayload(useStudioStore.getState().createVariant(label, commands))
const projectForVariant = (project: ProjectV2, variants: VariantModel[], variantRef?: string) => {
  if (!variantRef) return project
  const variant = variants.find((item) => item.ref === variantRef)
  if (!variant) throw new Error(`Variant not found: ${variantRef}`)
  return variant.project
}

interface DraftChangeSet { ref: string; label: string; baseRevision: number; commands: ProjectCommand[] }
const draftChangeSets = new Map<string, DraftChangeSet>()
const commandAudit = (commands: ProjectCommand[]) => commands.map((command, index) => ({ index: index + 1, type: command.type, command }))
const getDraft = (changeSetRef: string) => draftChangeSets.get(changeSetRef) ?? (() => { throw new Error(`Draft change set not found: ${changeSetRef}`) })()
const assertCurrentDraft = (draft: DraftChangeSet, project: ProjectV2) => {
  if (draft.baseRevision !== project.revision) throw new Error(`Draft change set is stale: base revision ${draft.baseRevision}, current revision ${project.revision}.`)
}

let variantWaiter: { resolve: (value: ToolPayload) => void; reject: (reason: unknown) => void; cleanup: () => void } | null = null
export const resolveVariantConfirmation = (approved: boolean) => {
  const state = useStudioStore.getState(); const variantRef = state.confirmationVariantRef
  if (!variantRef) return
  try {
    if (approved) { const project = state.applyVariant(variantRef); variantWaiter?.resolve({ status: 'applied', projectRevision: project.revision, variantRef, summary: 'The user approved and applied the variant.', metrics: calculateMetrics(project) }) }
    else { state.discardVariant(variantRef); variantWaiter?.resolve({ status: 'rejected', projectRevision: state.project.revision, variantRef, summary: 'The user rejected the variant.' }) }
  } catch (error) { variantWaiter?.reject(error); state.setConfirmationVariantRef(null) }
  finally { variantWaiter?.cleanup(); variantWaiter = null }
}

const requestVariantApproval = (variantRef: string, signal: AbortSignal) => new Promise<ToolPayload>((resolve, reject) => {
  const state = useStudioStore.getState()
  if (!state.variants.some((variant) => variant.ref === variantRef)) { reject(new Error(`Variant not found: ${variantRef}`)); return }
  if (variantWaiter) { reject(new Error('Another variant is awaiting confirmation.')); return }
  const abort = () => { state.setConfirmationVariantRef(null); variantWaiter = null; reject(new DOMException('Variant confirmation cancelled.', 'AbortError')) }
  signal.addEventListener('abort', abort, { once: true }); variantWaiter = { resolve, reject, cleanup: () => signal.removeEventListener('abort', abort) }; state.setConfirmationVariantRef(variantRef)
})

type Handler<S extends z.ZodType> = (input: z.infer<S>, options: WebMcpExecuteOptions) => ToolPayload | Promise<ToolPayload>
const define = <S extends z.ZodType>(definition: { name: string; title: string; runtimeDescription: string; input: S; readOnly?: boolean; handler: Handler<S> }): WebMcpTool => ({
  name: definition.name, title: definition.title, description: definition.runtimeDescription, inputSchema: z.toJSONSchema(definition.input, { target: 'draft-7' }) as Record<string, unknown>, annotations: definition.readOnly ? { readOnlyHint: true } : undefined,
  execute: async (raw, options) => {
    try { const context = { signal: options?.signal ?? new AbortController().signal }; if (context.signal.aborted) throw new DOMException('Tool execution cancelled.', 'AbortError'); return content(await definition.handler(definition.input.parse(raw), context)) }
    catch (error) { const aborted = error instanceof DOMException && error.name === 'AbortError'; return content({ status: aborted ? 'cancelled' : 'error', projectRevision: useStudioStore.getState().project.revision, summary: error instanceof Error ? error.message : 'Tool execution failed.' }) }
  },
})

export const webMcpTools: WebMcpTool[] = [
  define({ ...webMcpToolPrompts.get_project_state, input: webMcpSchemas.get_project_state, readOnly: true, handler: ({ detail }) => {
    const state = useStudioStore.getState(); const metrics = calculateMetrics(state.project)
    const data = detail === 'summary' ? { schemaVersion: 2, name: state.project.name, revision: state.project.revision, metrics, buildingRefs: state.project.buildings.map((building) => building.ref), variantRefs: state.variants.map((variant) => variant.ref) }
      : detail === 'site' ? state.project.site : detail === 'structure' ? { buildings: state.project.buildings } : detail === 'landscape' ? { landscape: state.project.landscape, climateProfile: state.project.climateProfile, plantingGuidance: state.project.site.knowledgeBase.planting } : state.project
    return { status: 'ok', projectRevision: state.project.revision, summary: `Returned ${detail} ProjectV2 state.`, metrics, data }
  } }),
  define({ ...webMcpToolPrompts.list_garden_fixtures, input: webMcpSchemas.list_garden_fixtures, readOnly: true, handler: () => ({ status: 'ok', projectRevision: useStudioStore.getState().project.revision, summary: `Returned ${gardenFixtureCatalog.length} ready garden fixtures.`, data: gardenFixtureCatalog }) }),
  define({ ...webMcpToolPrompts.propose_site_update, input: webMcpSchemas.propose_site_update, handler: (input) => createVariant('Site update', { type: 'site.update', ...input }) }),
  define({ ...webMcpToolPrompts.propose_terrain_update, input: webMcpSchemas.propose_terrain_update, handler: (input) => createVariant('Terrain update', { type: 'terrain.update', ...input }) }),
  define({ ...webMcpToolPrompts.propose_building_update, input: webMcpSchemas.propose_building_update, handler: (input) => createVariant('Building update', { type: 'building.update', ...input }) }),
  define({ ...webMcpToolPrompts.propose_storey_update, input: webMcpSchemas.propose_storey_update, handler: (input) => {
    const state = useStudioStore.getState(); const before = calculateMetrics(state.project)
    const variant = state.createVariant(input.action === 'extend-footprint' ? 'Storey footprint extension' : 'Storey update', [{ type: 'storey.update', ...input }])
    const building = variant.project.buildings.find((item) => item.ref === input.buildingRef)!
    return { ...variantPayload(variant), areaAddedM2: Number((variant.metrics.homeAreaM2 - before.homeAreaM2).toFixed(3)), buildingHeightM: Number(buildingPlacement(building).heightM.toFixed(3)), levelCount: building.storeys.length, affectedRefs: [input.buildingRef, input.storeyRef, building.storeys.find((item) => item.ref === input.storeyRef)?.baseSlabRef, building.roof.ref].filter(Boolean) }
  } }),
  define({ ...webMcpToolPrompts.propose_slab_update, input: webMcpSchemas.propose_slab_update, handler: (input) => createVariant('Slab update', { type: 'slab.update', ...input }) }),
  define({ ...webMcpToolPrompts.propose_space_update, input: webMcpSchemas.propose_space_update, handler: (input) => createVariant('Space update', { type: 'space.update', ...input }) }),
  define({ ...webMcpToolPrompts.propose_wall_update, input: webMcpSchemas.propose_wall_update, handler: (input) => createVariant('Wall update', { type: 'wall.update', ...input }) }),
  define({ ...webMcpToolPrompts.propose_wall_opening_layout, input: webMcpSchemas.propose_wall_opening_layout, handler: ({ buildingRef, wallRef, preset }) => createVariantFromCommands(`${preset.replaceAll('-', ' ')} façade`, wallOpeningLayoutCommands(useStudioStore.getState().project, buildingRef, wallRef, preset)) }),
  define({ ...webMcpToolPrompts.propose_wall_finish_update, input: webMcpSchemas.propose_wall_finish_update, handler: (input) => createVariantFromCommands(`${input.material.replaceAll('-', ' ')} wall finish`, wallFinishCommands(useStudioStore.getState().project, input)) }),
  define({ ...webMcpToolPrompts.propose_opening_update, input: webMcpSchemas.propose_opening_update, handler: (input) => createVariant('Opening update', { type: 'opening.update', ...input }) }),
  define({ ...webMcpToolPrompts.propose_roof_update, input: webMcpSchemas.propose_roof_update, handler: ({ roofType, ...input }) => createVariant('Roof update', { type: 'roof.update', ...input, roofType }) }),
  define({ ...webMcpToolPrompts.propose_platform_update, input: webMcpSchemas.propose_platform_update, handler: (input) => createVariant('Platform update', { type: 'platform.update', ...input }) }),
  define({ ...webMcpToolPrompts.propose_landscape_update, input: webMcpSchemas.propose_landscape_update, handler: (input) => createVariant('Landscape update', { type: 'landscape.update', ...input }) }),
  define({ ...webMcpToolPrompts.propose_plant_update, input: webMcpSchemas.propose_plant_update, handler: (input) => createVariant('Plant update', { type: 'plant.update', ...input }) }),
  define({ ...webMcpToolPrompts.propose_planting_area, input: webMcpSchemas.propose_planting_area, handler: (input) => {
    const project = useStudioStore.getState().project; const plan = createPlantingAreaPlan(project, input)
    if (!plan.plants.length) throw new Error('No plant positions remain after site and clearance validation.')
    const variant = useStudioStore.getState().createVariant('Planting area', [{ type: 'planting-area.update', metadata: plan.metadata, plants: plan.plants }])
    variant.issues.push(...plan.conflicts.map((conflict) => ({ severity: 'warning' as const, code: conflict.code, message: conflict.message, subjectRef: conflict.subjectRef })))
    return { ...variantPayload(variant), plantCount: plan.plants.length, totalLengthM: plan.metadata.totalLengthM, areaM2: plan.metadata.areaM2, spacingM: plan.metadata.spacingM, conflicts: plan.conflicts, affectedParcelRefs: plan.affectedParcelRefs }
  } }),
  define({ ...webMcpToolPrompts.propose_garden_fixture_update, input: webMcpSchemas.propose_garden_fixture_update, handler: (input) => createVariant('Garden fixture update', { type: 'garden-fixture.update', ...input }) }),
  define({ ...webMcpToolPrompts.propose_garden_fixture_set, input: webMcpSchemas.propose_garden_fixture_set, handler: ({ preset, setRef, origin, placement, rotationDegrees }) => {
    const project = useStudioStore.getState().project
    const resolvedOrigin = placement === 'next-to-existing' ? nextGardenBedPosition(project) : origin
    if (!resolvedOrigin) throw new Error('Garden fixture set origin is required.')
    const label = preset === 'starter-kitchen-garden' ? 'Starter kitchen garden' : `${preset.replaceAll('-', ' ')} addition`
    return createVariantFromCommands(label, gardenFixtureSetCommands(preset, setRef, resolvedOrigin, rotationDegrees))
  } }),
  define({ ...webMcpToolPrompts.create_change_set, input: webMcpSchemas.create_change_set, handler: ({ changeSetRef, label, baseRevision }) => {
    const project = useStudioStore.getState().project
    if (baseRevision !== project.revision) throw new Error(`Cannot create draft from revision ${baseRevision}; current revision is ${project.revision}.`)
    if (draftChangeSets.has(changeSetRef)) throw new Error(`Draft change set already exists: ${changeSetRef}`)
    draftChangeSets.set(changeSetRef, { ref: changeSetRef, label, baseRevision, commands: [] })
    return { status: 'draft_created', projectRevision: project.revision, summary: `${label} draft created.`, changeSetRef, baseRevision, operations: [], issues: [], metrics: calculateMetrics(project) }
  } }),
  define({ ...webMcpToolPrompts.add_change_set_operations, input: webMcpSchemas.add_change_set_operations, handler: ({ changeSetRef, operations }) => {
    const project = useStudioStore.getState().project; const draft = getDraft(changeSetRef); assertCurrentDraft(draft, project)
    const combined = [...draft.commands, ...(operations as ProjectCommand[])]; const preview = applyCommands(project, combined)
    draft.commands = combined
    return { status: 'draft_updated', projectRevision: project.revision, summary: `${operations.length} operation(s) added; ${combined.length} total.`, changeSetRef, baseRevision: draft.baseRevision, operations: commandAudit(combined), issues: validateProject(preview), metrics: calculateMetrics(preview) }
  } }),
  define({ ...webMcpToolPrompts.propose_change_set, input: webMcpSchemas.propose_change_set, handler: ({ changeSetRef }) => {
    const project = useStudioStore.getState().project; const draft = getDraft(changeSetRef); assertCurrentDraft(draft, project)
    if (!draft.commands.length) throw new Error('Cannot finalize an empty change set.')
    const variant = useStudioStore.getState().createVariant(draft.label, draft.commands); draftChangeSets.delete(changeSetRef)
    return { ...variantPayload(variant), changeSetRef, operations: commandAudit(variant.commands) }
  } }),
  define({ ...webMcpToolPrompts.discard_change_set, input: webMcpSchemas.discard_change_set, handler: ({ changeSetRef }) => {
    const project = useStudioStore.getState().project
    if (!draftChangeSets.delete(changeSetRef)) throw new Error(`Draft change set not found: ${changeSetRef}`)
    return { status: 'ok', projectRevision: project.revision, summary: 'Draft change set discarded.', changeSetRef }
  } }),
  define({ ...webMcpToolPrompts.measure_height, input: webMcpSchemas.measure_height, readOnly: true, handler: (input) => {
    const project = useStudioStore.getState().project; const measurement = measureHeight(project, input)
    return { status: 'ok', projectRevision: project.revision, summary: `${measurement.label}: ${measurement.heightM.toFixed(2)} m.`, measurement }
  } }),
  define({ ...webMcpToolPrompts.propose_climate_update, input: webMcpSchemas.propose_climate_update, handler: ({ month, ...values }) => createVariant('Climate update', { type: 'climate.update', month, values }) }),
  define({ ...webMcpToolPrompts.show_structure_views, input: webMcpSchemas.show_structure_views, readOnly: true, handler: (input, { signal }) => showStructureViews(input, signal) }),
  define({ ...webMcpToolPrompts.run_seasonal_analysis, input: webMcpSchemas.run_seasonal_analysis, readOnly: true, handler: ({ months, variantRef }) => { const state = useStudioStore.getState(); const project = projectForVariant(state.project, state.variants, variantRef); return { status: 'ok', projectRevision: state.project.revision, variantRef, summary: `Seasonal analysis completed for ${months.length} month(s).`, metrics: calculateMetrics(project), data: analyzeSeason(project, months) } } }),
  define({ ...webMcpToolPrompts.run_sunlight_analysis, input: webMcpSchemas.run_sunlight_analysis, readOnly: true, handler: ({ targetRef, point, variantRef, includeGrid, month, day, stepMinutes, hours }) => {
    const state = useStudioStore.getState(); const project = projectForVariant(state.project, state.variants, variantRef)
    const target = resolveSunTarget(project, targetRef, point)
    const analysis = analyzeSunlight(project, { target, month, day, stepMinutes, hours, includeGrid })
    if (analysis.grid) analysis.grid = downsampleSunGrid(analysis.grid, 24)
    const label = target.kind === 'point' ? `Point ${target.x}, ${target.z}` : target.kind === 'site' ? 'Site' : target.ref
    return { status: 'ok', projectRevision: state.project.revision, variantRef, summary: `${label}: ${analysis.sunHours.mean} h direct sun on ${formatSunMoment(month, analysis.day, 12).slice(0, -6)} (${analysis.expectedSunHours} h expected after typical cloud).`, analysis }
  } }),
  define({ ...webMcpToolPrompts.set_sun_time, input: webMcpSchemas.set_sun_time, readOnly: true, handler: ({ month, day, hour }) => {
    const state = useStudioStore.getState(); state.setSunTime({ month, day, hour })
    const sunTime = useStudioStore.getState().sunTime
    const site = { latitude: state.project.climateProfile.latitude, longitude: state.project.climateProfile.longitude, timezone: state.project.climateProfile.timezone }
    const sun = solarPosition(site, sunTime); const events = sunriseSunset(site, sunTime)
    return { status: 'ok', projectRevision: state.project.revision, summary: `Viewer sun set to ${formatSunMoment(sunTime.month, sunTime.day, sunTime.hour)}: altitude ${sun.altitudeDeg.toFixed(1)}°, azimuth ${sun.azimuthDeg.toFixed(0)}°.`, sunTime, altitudeDeg: Number(sun.altitudeDeg.toFixed(2)), azimuthDeg: Number(sun.azimuthDeg.toFixed(2)), sunriseLocal: events ? Number(events.sunriseHour.toFixed(2)) : null, sunsetLocal: events ? Number(events.sunsetHour.toFixed(2)) : null }
  } }),
  define({ ...webMcpToolPrompts.compare_variants, input: webMcpSchemas.compare_variants, readOnly: true, handler: ({ variantRefs }) => { const state = useStudioStore.getState(); const variants = variantRefs.map((variantRef) => state.variants.find((variant) => variant.ref === variantRef) ?? (() => { throw new Error(`Variant not found: ${variantRef}`) })()); return { status: 'ok', projectRevision: state.project.revision, summary: `Compared ${variants.length} variants.`, data: variants.map(({ ref: variantRef, label, baseRevision, metrics, issues }) => ({ variantRef, label, baseRevision, metrics, issues })) } } }),
  define({ ...webMcpToolPrompts.request_apply_variant, input: webMcpSchemas.request_apply_variant, handler: ({ variantRef }, { signal }) => requestVariantApproval(variantRef, signal) }),
  define({ ...webMcpToolPrompts.discard_variant, input: webMcpSchemas.discard_variant, handler: ({ variantRef }) => { const state = useStudioStore.getState(); state.discardVariant(variantRef); return { status: 'ok', projectRevision: state.project.revision, variantRef, summary: 'Variant discarded.' } } }),
  define({ ...webMcpToolPrompts.undo_last_change, input: webMcpSchemas.undo_last_change, handler: () => { const project = useStudioStore.getState().undo(); return { status: 'ok', projectRevision: project.revision, summary: 'Last committed change was undone.', metrics: calculateMetrics(project) } } }),
]

export const registerWebMcpTools = () => {
  const modelContext = document.modelContext; const available = Boolean(modelContext?.registerTool); useStudioStore.getState().setWebMcpAvailable(available)
  if (!modelContext) return () => undefined
  const controller = new AbortController()
  Promise.all(webMcpTools.map((tool) => modelContext.registerTool(tool, { signal: controller.signal }))).catch((error) => { if (!controller.signal.aborted) useStudioStore.getState().setToast(`WebMCP registration failed: ${error instanceof Error ? error.message : 'unknown error'}`) })
  return () => controller.abort()
}
