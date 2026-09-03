import { z } from 'zod'
import { webMcpToolPrompts } from '../../prompts/webmcp-tools'
import { calculateMetrics, validateProject } from '../domain/commands'
import { gardenFixtureCatalog, gardenFixtureSetCommands, nextGardenBedPosition } from '../domain/gardenFixtures'
import { buildingPlacement } from '../domain/geometry'
import { measureHeight } from '../domain/heightMeasurements'
import { diffProjects } from '../domain/diff'
import { findProjectObject, knowledgeSlice } from '../domain/refs'
import { createPlantingAreaPlan } from '../domain/plantingAreas'
import { roofSegmentSummary } from '../domain/roofs'
import { analyzeSeason } from '../domain/seasonal'
import { solarPosition, sunriseSunset } from '../domain/solar'
import { analyzeSunlight, downsampleSunGrid, formatSunMoment, resolveSunTarget } from '../domain/sunlight'
import type { ProjectCommand, ProjectIssue, ProjectMetrics, ProjectV2, VariantModel } from '../domain/types'
import { wallFinishCommands } from '../domain/wallFinishes'
import { wallOpeningLayoutCommands } from '../domain/wallOpeningLayouts'
import { useStudioStore } from '../state/store'
import { showStructureViews } from './structureViews'
import { inputSchemaFor, untrustedContentTools, webMcpSchemas, type WebMcpToolName } from './webmcpDefinitions'

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

const commandAudit = (commands: ProjectCommand[]) => commands.map((command, index) => ({ index: index + 1, type: command.type, command }))
const proposalData = ({ project: _project, ...proposal }: ReturnType<typeof useStudioStore.getState>['proposals'][number]) => proposal

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
  if (!state.variants.some((variant) => variant.ref === variantRef)) {
    try { state.reopenProposal(variantRef) } catch (error) { reject(error); return }
  }
  if (variantWaiter) { reject(new Error('Another variant is awaiting confirmation.')); return }
  const abort = () => { state.setConfirmationVariantRef(null); variantWaiter = null; reject(new DOMException('Variant confirmation cancelled.', 'AbortError')) }
  signal.addEventListener('abort', abort, { once: true }); variantWaiter = { resolve, reject, cleanup: () => signal.removeEventListener('abort', abort) }; state.setConfirmationVariantRef(variantRef)
})

/** Agents self-correct better from "field: problem" lines than from a serialized issue array. */
const describeToolError = (error: unknown) => {
  if (error instanceof z.ZodError) return error.issues.map((issue) => `${issue.path.map(String).join('.') || 'input'}: ${issue.message}`).join('; ')
  return error instanceof Error ? error.message : 'Tool execution failed.'
}

type Handler<S extends z.ZodType> = (input: z.infer<S>, options: WebMcpExecuteOptions) => ToolPayload | Promise<ToolPayload>
const define = <S extends z.ZodType>(definition: { name: string; title: string; runtimeDescription: string; input: S; readOnly?: boolean; handler: Handler<S> }): WebMcpTool => ({
  name: definition.name, title: definition.title, description: definition.runtimeDescription, inputSchema: inputSchemaFor(definition.name as WebMcpToolName),
  annotations: definition.readOnly || untrustedContentTools.has(definition.name as WebMcpToolName)
    ? { ...(definition.readOnly ? { readOnlyHint: true } : {}), ...(untrustedContentTools.has(definition.name as WebMcpToolName) ? { untrustedContentHint: true } : {}) }
    : undefined,
  execute: async (raw, options) => {
    try { const context = { signal: options?.signal ?? new AbortController().signal }; if (context.signal.aborted) throw new DOMException('Tool execution cancelled.', 'AbortError'); return content(await definition.handler(definition.input.parse(raw), context)) }
    catch (error) { const aborted = error instanceof DOMException && error.name === 'AbortError'; return content({ status: aborted ? 'cancelled' : 'error', projectRevision: useStudioStore.getState().project.revision, summary: describeToolError(error) }) }
  },
})

export const webMcpTools: WebMcpTool[] = [
  define({ ...webMcpToolPrompts.get_project_state, input: webMcpSchemas.get_project_state, readOnly: true, handler: ({ detail, objectRef }) => {
    const state = useStudioStore.getState(); const project = state.project; const metrics = calculateMetrics(project)
    if (objectRef) {
      const found = findProjectObject(project, objectRef)
      if (!found) throw new Error(`Object not found: ${objectRef}. Use a building, storey, slab, wall, opening, space, roof, zone, plant, fixture, parcel or entrance ref.`)
      return { status: 'ok', projectRevision: project.revision, summary: `Returned ${found.kind} ${objectRef}.`, metrics, data: found }
    }
    const { knowledgeBase: _knowledgeBase, ...siteWithoutKnowledge } = project.site
    const projectWithoutKnowledge = { ...project, site: siteWithoutKnowledge }
    const data = detail === 'summary' ? { schemaVersion: 2, name: project.name, revision: project.revision, metrics, buildingRefs: project.buildings.map((building) => building.ref), variantRefs: state.variants.map((variant) => variant.ref) }
      : detail === 'site' ? siteWithoutKnowledge : detail === 'structure' ? { buildings: project.buildings } : detail === 'landscape' ? { landscape: project.landscape, climateProfile: project.climateProfile } : projectWithoutKnowledge
    return { status: 'ok', projectRevision: project.revision, summary: `Returned ${detail} ProjectV2 state.`, metrics, data }
  } }),
  define({ ...webMcpToolPrompts.get_site_knowledge, input: webMcpSchemas.get_site_knowledge, readOnly: true, handler: ({ section }) => {
    const project = useStudioStore.getState().project
    return { status: 'ok', projectRevision: project.revision, summary: `Returned knowledge bank ${section ?? 'overview'}.`, data: knowledgeSlice(project, section) }
  } }),
  define({ ...webMcpToolPrompts.get_proposals, input: webMcpSchemas.get_proposals, readOnly: true, handler: ({ proposalRef, status, includeDrafts }) => {
    const state = useStudioStore.getState(); const counts = state.proposals.reduce((result, proposal) => ({ ...result, [proposal.status]: result[proposal.status] + 1 }), { pending: 0, approved: 0, rejected: 0, stale: 0 })
    const proposals = proposalRef ? state.proposals.filter((proposal) => proposal.ref === proposalRef) : state.proposals.filter((proposal) => !status || proposal.status === status)
    if (proposalRef && !proposals.length) throw new Error(`Proposal not found: ${proposalRef}`)
    return { status: 'ok', projectRevision: state.project.revision, summary: proposalRef ? `Returned proposal ${proposalRef}.` : `Returned ${proposals.length} proposal record(s).`, counts, proposals: proposals.map(proposalData), drafts: includeDrafts ? state.draftChangeSets : [] }
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
  define({ ...webMcpToolPrompts.propose_roof_update, input: webMcpSchemas.propose_roof_update, handler: (input) => {
    const state = useStudioStore.getState(); const beforeBuilding = state.project.buildings.find((building) => building.ref === input.buildingRef)
    if (!beforeBuilding) throw new Error(`Building not found: ${input.buildingRef}`)
    const targetRef = input.segmentRef ?? (input.roofRef && input.roofRef !== beforeBuilding.roof.ref ? input.roofRef : undefined)
    const before = beforeBuilding.roof.segments.map((segment) => roofSegmentSummary(segment, beforeBuilding.roof.junctions))
    const label = input.action === 'split-segment' ? 'Roof segment split' : input.action === 'add-segment' ? 'Roof segment addition' : targetRef ? 'Roof segment update' : 'Roof update'
    const variant = state.createVariant(label, [{ type: 'roof.update', ...input }])
    const afterBuilding = variant.project.buildings.find((building) => building.ref === input.buildingRef)!
    const after = afterBuilding.roof.segments.map((segment) => roofSegmentSummary(segment, afterBuilding.roof.junctions))
    const beforeByRef = new Map(before.map((segment) => [segment.segmentRef, segment])); const afterByRef = new Map(after.map((segment) => [segment.segmentRef, segment]))
    const changedRefs = [...new Set([...beforeByRef.keys(), ...afterByRef.keys()])].filter((ref) => JSON.stringify(beforeByRef.get(ref)) !== JSON.stringify(afterByRef.get(ref)))
    const roofChanges = changedRefs.map((ref) => ({
      kind: !beforeByRef.has(ref) ? 'added' : !afterByRef.has(ref) ? 'removed' : 'updated', before: beforeByRef.get(ref), after: afterByRef.get(ref),
    }))
    const selectedRef = roofChanges.find((change) => change.after)?.after?.segmentRef ?? targetRef ?? afterBuilding.roof.ref
    state.setSelectedRef(selectedRef)
    const buildingHeight = {
      beforeM: Number(buildingPlacement(beforeBuilding).heightM.toFixed(3)),
      afterM: Number(buildingPlacement(afterBuilding).heightM.toFixed(3)),
    }
    return { ...variantPayload(variant), targetScope: input.action === 'split-segment' ? 'segment-split' : input.action === 'add-segment' ? 'segment-addition' : targetRef ? 'segment' : 'complete-roof', roofChanges, junctions: afterBuilding.roof.junctions, buildingHeight, buildingHeightM: buildingHeight.afterM, affectedRefs: [afterBuilding.ref, ...changedRefs, ...afterBuilding.roof.junctions.map((junction) => junction.ref)] }
  } }),
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
  define({ ...webMcpToolPrompts.propose_garden_fixture, input: webMcpSchemas.propose_garden_fixture, handler: (input) => {
    if (input.mode === 'single') {
      return createVariant('Garden fixture update', { type: 'garden-fixture.update', action: input.action!, fixtureRef: input.fixtureRef!, catalogId: input.catalogId, name: input.name, position: input.position, rotationDegrees: input.rotationDegrees })
    }
    const preset = input.preset!; const setRef = input.setRef!; const { origin, placement } = input; const rotationDegrees = input.rotationDegrees ?? 0
    const project = useStudioStore.getState().project
    const resolvedOrigin = placement === 'next-to-existing' ? nextGardenBedPosition(project) : origin
    if (!resolvedOrigin) throw new Error('Garden fixture set origin is required.')
    const label = preset === 'starter-kitchen-garden' ? 'Starter kitchen garden' : `${preset.replaceAll('-', ' ')} addition`
    return createVariantFromCommands(label, gardenFixtureSetCommands(preset, setRef, resolvedOrigin, rotationDegrees))
  } }),
  define({ ...webMcpToolPrompts.manage_change_set, input: webMcpSchemas.manage_change_set, handler: (input) => {
    const state = useStudioStore.getState(); const project = state.project
    if (input.action === 'create') {
      state.createDraftChangeSet(input.changeSetRef, input.label!, input.baseRevision!)
      return { status: 'draft_created', projectRevision: project.revision, summary: `${input.label} draft created.`, changeSetRef: input.changeSetRef, baseRevision: input.baseRevision!, operations: [], issues: [], metrics: calculateMetrics(project) }
    }
    if (input.action === 'add-operations') {
      const { draft, preview } = state.addDraftOperations(input.changeSetRef, input.operations! as ProjectCommand[])
      return { status: 'draft_updated', projectRevision: project.revision, summary: `${input.operations!.length} operation(s) added; ${draft.commands.length} total.`, changeSetRef: input.changeSetRef, baseRevision: draft.baseRevision, operations: commandAudit(draft.commands), issues: validateProject(preview), metrics: calculateMetrics(preview) }
    }
    if (input.action === 'finalize') {
      const variant = state.finalizeDraftChangeSet(input.changeSetRef)
      return { ...variantPayload(variant), changeSetRef: input.changeSetRef, operations: commandAudit(variant.commands) }
    }
    state.discardDraftChangeSet(input.changeSetRef)
    return { status: 'ok', projectRevision: project.revision, summary: 'Draft change set discarded.', changeSetRef: input.changeSetRef }
  } }),
  define({ ...webMcpToolPrompts.measure_height, input: webMcpSchemas.measure_height, readOnly: true, handler: (input) => {
    const project = useStudioStore.getState().project
    const request = input.mode === 'semantic' ? { mode: 'semantic' as const, objectRef: input.objectRef!, measurement: input.measurement } : { mode: 'free-vertical' as const, startPoint: input.startPoint!, endPoint: input.endPoint! }
    const measurement = measureHeight(project, request)
    return { status: 'ok', projectRevision: project.revision, summary: `${measurement.label}: ${measurement.heightM.toFixed(2)} m.`, measurement }
  } }),
  define({ ...webMcpToolPrompts.propose_climate_update, input: webMcpSchemas.propose_climate_update, handler: ({ month, ...values }) => createVariant('Climate update', { type: 'climate.update', month, values }) }),
  define({ ...webMcpToolPrompts.show_structure_views, input: webMcpSchemas.show_structure_views, readOnly: true, handler: (input, { signal }) => showStructureViews(input, signal) }),
  define({ ...webMcpToolPrompts.run_seasonal_analysis, input: webMcpSchemas.run_seasonal_analysis, readOnly: true, handler: ({ months, variantRef }) => { const state = useStudioStore.getState(); const project = projectForVariant(state.project, state.variants, variantRef); return { status: 'ok', projectRevision: state.project.revision, variantRef, summary: `Seasonal analysis completed for ${months.length} month(s).`, metrics: calculateMetrics(project), data: analyzeSeason(project, months) } } }),
  define({ ...webMcpToolPrompts.run_sunlight_analysis, input: webMcpSchemas.run_sunlight_analysis, readOnly: true, handler: ({ targetRef, point, variantRef, includeGrid, month, day, stepMinutes, hours }) => {
    const state = useStudioStore.getState(); const project = projectForVariant(state.project, state.variants, variantRef)
    const target = resolveSunTarget(project, targetRef, point)
    const analysis = analyzeSunlight(project, { target, month, day, stepMinutes, hours, includeGrid })
    if (analysis.grid) analysis.grid = downsampleSunGrid(analysis.grid, 12)
    const label = target.kind === 'point' ? `Point ${target.x}, ${target.z}` : target.kind === 'site' ? 'Site' : target.ref
    return { status: 'ok', projectRevision: state.project.revision, variantRef, summary: `${label}: ${analysis.sunHours.mean} h direct sun on ${formatSunMoment(month, analysis.day, 12).slice(0, -6)} (${analysis.expectedSunHours} h expected after typical cloud).`, analysis }
  } }),
  define({ ...webMcpToolPrompts.set_viewer_state, input: webMcpSchemas.set_viewer_state, readOnly: true, handler: ({ viewMode, explode, planStoreyRef, focusRef }) => {
    const state = useStudioStore.getState()
    if (focusRef) { const found = findProjectObject(state.project, focusRef); if (!found && focusRef !== 'site') throw new Error(`Object not found: ${focusRef}.`) }
    if (viewMode) state.setViewMode(viewMode)
    if (explode !== undefined) { state.setViewerMode('edit'); state.setExplodeStoreys(explode) }
    if (planStoreyRef !== undefined) {
      if (planStoreyRef && !state.project.buildings.some((building) => building.storeys.some((storey) => storey.ref === planStoreyRef))) throw new Error(`Storey not found: ${planStoreyRef}.`)
      state.setActivePlanStoreyRef(planStoreyRef)
    }
    if (focusRef !== undefined) {
      state.setSelectedRef(focusRef)
      const kind = focusRef ? findProjectObject(state.project, focusRef)?.kind : undefined
      if (kind === 'building') state.refocusCamera(); else if (kind === 'fixture') state.focusGardenFixtures()
    }
    const next = useStudioStore.getState()
    return { status: 'ok', projectRevision: next.project.revision, summary: `Viewer: ${next.viewMode}${next.explodeStoreys ? ', exploded' : ''}${next.selectedRef ? `, selected ${next.selectedRef}` : ''}.`, viewer: { viewMode: next.viewMode, explode: next.explodeStoreys, viewerMode: next.viewerMode, activePlanStoreyRef: next.activePlanStoreyRef, selectedRef: next.selectedRef } }
  } }),
  define({ ...webMcpToolPrompts.set_sun_time, input: webMcpSchemas.set_sun_time, readOnly: true, handler: ({ month, day, hour }) => {
    const state = useStudioStore.getState(); state.setSunTime({ month, day, hour })
    const sunTime = useStudioStore.getState().sunTime
    const site = { latitude: state.project.climateProfile.latitude, longitude: state.project.climateProfile.longitude, timezone: state.project.climateProfile.timezone }
    const sun = solarPosition(site, sunTime); const events = sunriseSunset(site, sunTime)
    return { status: 'ok', projectRevision: state.project.revision, summary: `Viewer sun set to ${formatSunMoment(sunTime.month, sunTime.day, sunTime.hour)}: altitude ${sun.altitudeDeg.toFixed(1)}°, azimuth ${sun.azimuthDeg.toFixed(0)}°.`, sunTime, altitudeDeg: Number(sun.altitudeDeg.toFixed(2)), azimuthDeg: Number(sun.azimuthDeg.toFixed(2)), sunriseLocal: events ? Number(events.sunriseHour.toFixed(2)) : null, sunsetLocal: events ? Number(events.sunsetHour.toFixed(2)) : null }
  } }),
  define({ ...webMcpToolPrompts.compare_variants, input: webMcpSchemas.compare_variants, readOnly: true, handler: ({ variantRefs }) => { const state = useStudioStore.getState(); const variants = variantRefs.map((variantRef) => state.variants.find((variant) => variant.ref === variantRef) ?? (() => { throw new Error(`Variant not found: ${variantRef}`) })()); return { status: 'ok', projectRevision: state.project.revision, summary: `Compared ${variants.length} variants.`, data: variants.map(({ ref: variantRef, label, baseRevision, metrics, issues }) => ({ variantRef, label, baseRevision, metrics, issues })) } } }),
  define({ ...webMcpToolPrompts.diff_variant, input: webMcpSchemas.diff_variant, readOnly: true, handler: ({ variantRef, baseVariantRef }) => {
    const state = useStudioStore.getState()
    const variant = state.variants.find((item) => item.ref === variantRef) ?? (() => { throw new Error(`Variant not found: ${variantRef}`) })()
    const base = baseVariantRef ? projectForVariant(state.project, state.variants, baseVariantRef) : state.project
    const diff = diffProjects(base, variant.project, { maxChanges: 40 })
    const area = diff.metricDeltas.homeAreaM2 ? `; home area ${diff.metricDeltas.homeAreaM2.delta > 0 ? '+' : ''}${diff.metricDeltas.homeAreaM2.delta} m²` : ''
    return { status: 'ok', projectRevision: state.project.revision, variantRef, baseVariantRef, summary: `${variant.label}: ${diff.counts.added} added, ${diff.counts.removed} removed, ${diff.counts.modified} modified${area}.`, diff }
  } }),
  define({ ...webMcpToolPrompts.manage_variant, input: webMcpSchemas.manage_variant, handler: (input, { signal }) => {
    if (input.action === 'request-apply') return requestVariantApproval(input.variantRef, signal)
    const state = useStudioStore.getState(); state.discardVariant(input.variantRef, input.reason)
    return { status: 'rejected', projectRevision: state.project.revision, variantRef: input.variantRef, summary: 'Proposal rejected and retained in history.' }
  } }),
  define({ ...webMcpToolPrompts.undo_last_change, input: webMcpSchemas.undo_last_change, handler: () => { const project = useStudioStore.getState().undo(); return { status: 'ok', projectRevision: project.revision, summary: 'Last committed change was undone.', metrics: calculateMetrics(project) } } }),
]

export const registerWebMcpTools = () => {
  const modelContext = document.modelContext; const available = Boolean(modelContext?.registerTool); useStudioStore.getState().setWebMcpAvailable(available)
  if (!modelContext) return () => undefined
  const controller = new AbortController()
  Promise.all(webMcpTools.map((tool) => modelContext.registerTool(tool, { signal: controller.signal }))).catch((error) => { if (!controller.signal.aborted) useStudioStore.getState().setToast(`WebMCP registration failed: ${error instanceof Error ? error.message : 'unknown error'}`) })
  return () => controller.abort()
}
