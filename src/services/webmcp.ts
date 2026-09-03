import { z } from 'zod'
import { webMcpToolPrompts } from '../../prompts/webmcp-tools'
import { calculateMetrics, validateProject } from '../domain/commands'
import { gardenFixtureCatalog, gardenFixtureSetCommands, nextGardenBedPosition } from '../domain/gardenFixtures'
import { buildingPlacement } from '../domain/geometry'
import { measureHeight } from '../domain/heightMeasurements'
import { createPlantingAreaPlan } from '../domain/plantingAreas'
import { roofSegmentSummary } from '../domain/roofs'
import { analyzeSeason } from '../domain/seasonal'
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
      const { mode: _mode, ...command } = input
      return createVariant('Garden fixture update', { type: 'garden-fixture.update', ...command })
    }
    const { preset, setRef, origin, placement, rotationDegrees } = input
    const project = useStudioStore.getState().project
    const resolvedOrigin = placement === 'next-to-existing' ? nextGardenBedPosition(project) : origin
    if (!resolvedOrigin) throw new Error('Garden fixture set origin is required.')
    const label = preset === 'starter-kitchen-garden' ? 'Starter kitchen garden' : `${preset.replaceAll('-', ' ')} addition`
    return createVariantFromCommands(label, gardenFixtureSetCommands(preset, setRef, resolvedOrigin, rotationDegrees))
  } }),
  define({ ...webMcpToolPrompts.manage_change_set, input: webMcpSchemas.manage_change_set, handler: (input) => {
    const state = useStudioStore.getState(); const project = state.project
    if (input.action === 'create') {
      state.createDraftChangeSet(input.changeSetRef, input.label, input.baseRevision)
      return { status: 'draft_created', projectRevision: project.revision, summary: `${input.label} draft created.`, changeSetRef: input.changeSetRef, baseRevision: input.baseRevision, operations: [], issues: [], metrics: calculateMetrics(project) }
    }
    if (input.action === 'add-operations') {
      const { draft, preview } = state.addDraftOperations(input.changeSetRef, input.operations as ProjectCommand[])
      return { status: 'draft_updated', projectRevision: project.revision, summary: `${input.operations.length} operation(s) added; ${draft.commands.length} total.`, changeSetRef: input.changeSetRef, baseRevision: draft.baseRevision, operations: commandAudit(draft.commands), issues: validateProject(preview), metrics: calculateMetrics(preview) }
    }
    if (input.action === 'finalize') {
      const variant = state.finalizeDraftChangeSet(input.changeSetRef)
      return { ...variantPayload(variant), changeSetRef: input.changeSetRef, operations: commandAudit(variant.commands) }
    }
    state.discardDraftChangeSet(input.changeSetRef)
    return { status: 'ok', projectRevision: project.revision, summary: 'Draft change set discarded.', changeSetRef: input.changeSetRef }
  } }),
  define({ ...webMcpToolPrompts.measure_height, input: webMcpSchemas.measure_height, readOnly: true, handler: (input) => {
    const project = useStudioStore.getState().project; const measurement = measureHeight(project, input)
    return { status: 'ok', projectRevision: project.revision, summary: `${measurement.label}: ${measurement.heightM.toFixed(2)} m.`, measurement }
  } }),
  define({ ...webMcpToolPrompts.propose_climate_update, input: webMcpSchemas.propose_climate_update, handler: ({ month, ...values }) => createVariant('Climate update', { type: 'climate.update', month, values }) }),
  define({ ...webMcpToolPrompts.show_structure_views, input: webMcpSchemas.show_structure_views, readOnly: true, handler: (input, { signal }) => showStructureViews(input, signal) }),
  define({ ...webMcpToolPrompts.run_seasonal_analysis, input: webMcpSchemas.run_seasonal_analysis, readOnly: true, handler: ({ months, variantRef }) => { const state = useStudioStore.getState(); const project = projectForVariant(state.project, state.variants, variantRef); return { status: 'ok', projectRevision: state.project.revision, variantRef, summary: `Seasonal analysis completed for ${months.length} month(s).`, metrics: calculateMetrics(project), data: analyzeSeason(project, months) } } }),
  define({ ...webMcpToolPrompts.compare_variants, input: webMcpSchemas.compare_variants, readOnly: true, handler: ({ variantRefs }) => { const state = useStudioStore.getState(); const variants = variantRefs.map((variantRef) => state.variants.find((variant) => variant.ref === variantRef) ?? (() => { throw new Error(`Variant not found: ${variantRef}`) })()); return { status: 'ok', projectRevision: state.project.revision, summary: `Compared ${variants.length} variants.`, data: variants.map(({ ref: variantRef, label, baseRevision, metrics, issues }) => ({ variantRef, label, baseRevision, metrics, issues })) } } }),
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
