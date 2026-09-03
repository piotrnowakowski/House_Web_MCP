import { z } from 'zod'
import { operationReference, webMcpToolPrompts } from '../../prompts/webmcp-tools'
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
import { textureLibrary, texturesFor } from '../domain/textures'
import { wallFinishCommands } from '../domain/wallFinishes'
import { wallOpeningLayoutCommands } from '../domain/wallOpeningLayouts'
import { useStudioStore } from '../state/store'
import { showStructureViews } from './structureViews'
import { inputSchemaFor, operationsSchema, structureViewsSchema, untrustedContentTools, webMcpSchemas, type WebMcpOperation, type WebMcpToolName } from './webmcpDefinitions'

type ToolPayload = { status: string; projectRevision: number; summary: string; variantRef?: string; issues?: ProjectIssue[]; metrics?: ProjectMetrics; data?: unknown; [key: string]: unknown }
const content = (payload: ToolPayload): WebMcpToolResult => ({ content: [{ type: 'text', text: JSON.stringify(payload) }] })
const variantPayload = (variant: VariantModel): ToolPayload => ({ status: 'variant_created', projectRevision: variant.baseRevision, variantRef: variant.ref, summary: `${variant.label} created for visible review.`, issues: variant.issues, metrics: variant.metrics })
const projectForVariant = (project: ProjectV2, variants: VariantModel[], variantRef?: string) => {
  if (!variantRef) return project
  const variant = variants.find((item) => item.ref === variantRef)
  if (!variant) throw new Error(`Variant not found: ${variantRef}`)
  return variant.project
}

const refsOf = (command: ProjectCommand) => Object.entries(command).filter(([key, value]) => (key.endsWith('Ref') || key === 'plantingRef') && typeof value === 'string').map(([, value]) => value as string)
/** Compact per-command audit: index, type and the refs it names, never the full geometry; long lists are capped with a count. */
const AUDIT_LIMIT = 24
const commandAudit = (commands: ProjectCommand[]) => {
  const audit = commands.slice(0, AUDIT_LIMIT).map((command, index) => ({ index: index + 1, type: command.type, refs: command.type === 'planting-area.update' ? [command.metadata.plantingRef, `${command.plants.length} plants`] : refsOf(command) }))
  return commands.length > AUDIT_LIMIT ? [...audit, { index: AUDIT_LIMIT + 1, type: 'more', refs: [`${commands.length - AUDIT_LIMIT} further commands omitted`] }] : audit
}
/** Proposal records for listing: the audit replaces the raw commands so a pending planting scheme does not echo ninety plants. */
const proposalData = ({ project: _project, commands, ...proposal }: ReturnType<typeof useStudioStore.getState>['proposals'][number]) => ({ ...proposal, commandCount: commands.length, operations: commandAudit(commands) })
const draftData = ({ commands, ...draft }: ReturnType<typeof useStudioStore.getState>['draftChangeSets'][number]) => ({ ...draft, commandCount: commands.length, operations: commandAudit(commands) })

/** Expands typed operations into ProjectV2 commands; macros (wall.finish scope, façade presets, planting areas, fixture presets) become several commands. */
interface ExpandedOperations { commands: ProjectCommand[]; warnings: ProjectIssue[]; extras: Record<string, unknown> }
const expandOperations = (project: ProjectV2, rawOperations: unknown[]): ExpandedOperations => {
  const { operations } = operationsSchema.parse({ operations: rawOperations })
  const commands: ProjectCommand[] = []; const warnings: ProjectIssue[] = []; const extras: Record<string, unknown> = {}
  const expand = (operation: WebMcpOperation): ProjectCommand[] => {
    switch (operation.type) {
      case 'wall.finish': { const { type: _type, ...input } = operation; return wallFinishCommands(project, input) }
      case 'wall.opening-layout': return wallOpeningLayoutCommands(project, operation.buildingRef, operation.wallRef, operation.preset)
      case 'planting.area': {
        const { type: _type, ...input } = operation; const plan = createPlantingAreaPlan(project, input)
        if (!plan.plants.length) throw new Error('No plant positions remain after site and clearance validation.')
        warnings.push(...plan.conflicts.map((conflict) => ({ severity: 'warning' as const, code: conflict.code, message: conflict.message, subjectRef: conflict.subjectRef })))
        Object.assign(extras, { plantCount: plan.plants.length, totalLengthM: plan.metadata.totalLengthM, areaM2: plan.metadata.areaM2, spacingM: plan.metadata.spacingM, conflicts: plan.conflicts, affectedParcelRefs: plan.affectedParcelRefs })
        return [{ type: 'planting-area.update', metadata: plan.metadata, plants: plan.plants }]
      }
      case 'garden-fixture.preset': {
        const origin = operation.placement === 'next-to-existing' ? nextGardenBedPosition(project) : operation.origin
        if (!origin) throw new Error('Garden fixture set origin is required.')
        return gardenFixtureSetCommands(operation.preset, operation.setRef, origin, operation.rotationDegrees ?? 0)
      }
      case 'climate.update': { const { type, month, ...values } = operation; return [{ type, month, values }] }
      default: return [operation as ProjectCommand]
    }
  }
  operations.forEach((operation, index) => {
    try { commands.push(...expand(operation)) }
    catch (error) { if (error instanceof z.ZodError) throw error; throw new Error(`operations.${index} (${operation.type}): ${error instanceof Error ? error.message : 'invalid operation'}`) }
  })
  return { commands, warnings, extras }
}

/** A single operation keeps the label its dedicated tool used to give; several operations list their types. */
const singleLabel = (operation: WebMcpOperation) => {
  const words = (value: string) => value.replaceAll('-', ' ')
  switch (operation.type) {
    case 'storey.update': return operation.action === 'extend-footprint' ? 'Storey footprint extension' : 'Storey update'
    case 'wall.finish': return `${words(operation.material)} wall finish`
    case 'wall.opening-layout': return `${words(operation.preset)} façade`
    case 'roof.update': return operation.action === 'split-segment' ? 'Roof segment split' : operation.action === 'add-segment' ? 'Roof segment addition' : operation.segmentRef ? 'Roof segment update' : 'Roof update'
    case 'planting.area': return 'Planting area'
    case 'garden-fixture.preset': return operation.preset === 'starter-kitchen-garden' ? 'Starter kitchen garden' : `${words(operation.preset)} addition`
    case 'garden-fixture.update': return 'Garden fixture update'
    default: return operation.type.replace('.', ' ').replaceAll('-', ' ').replace(/^./, (first) => first.toUpperCase())
  }
}
const labelFor = (operations: WebMcpOperation[]) => {
  if (operations.length === 1) return singleLabel(operations[0])
  const types = [...new Set(operations.map((operation) => operation.type))]
  const words = types.slice(0, 3).map((type) => type.replace('.', ' ').replaceAll('-', ' '))
  return `${words.join(', ')}${types.length > 3 ? ` +${types.length - 3}` : ''}`.replace(/^./, (first) => first.toUpperCase())
}

/** Before-and-after report for roof operations, so a split or realignment can be explained without reading the whole roof. */
const roofReport = (before: ProjectV2, after: ProjectV2, operation: Extract<WebMcpOperation, { type: 'roof.update' }>) => {
  const beforeBuilding = before.buildings.find((building) => building.ref === operation.buildingRef); const afterBuilding = after.buildings.find((building) => building.ref === operation.buildingRef)
  if (!beforeBuilding || !afterBuilding) return {}
  const targetRef = operation.segmentRef ?? (operation.roofRef && operation.roofRef !== beforeBuilding.roof.ref ? operation.roofRef : undefined)
  const summaries = (building: typeof beforeBuilding) => building.roof.segments.map((segment) => roofSegmentSummary(segment, building.roof.junctions))
  const beforeByRef = new Map(summaries(beforeBuilding).map((segment) => [segment.segmentRef, segment])); const afterByRef = new Map(summaries(afterBuilding).map((segment) => [segment.segmentRef, segment]))
  const changedRefs = [...new Set([...beforeByRef.keys(), ...afterByRef.keys()])].filter((ref) => JSON.stringify(beforeByRef.get(ref)) !== JSON.stringify(afterByRef.get(ref)))
  const roofChanges = changedRefs.map((ref) => ({ kind: !beforeByRef.has(ref) ? 'added' : !afterByRef.has(ref) ? 'removed' : 'updated', before: beforeByRef.get(ref), after: afterByRef.get(ref) }))
  const targetScope = operation.action === 'split-segment' ? 'segment-split' : operation.action === 'add-segment' ? 'segment-addition' : targetRef ? 'segment' : 'complete-roof'
  const buildingHeight = { beforeM: Number(buildingPlacement(beforeBuilding).heightM.toFixed(3)), afterM: Number(buildingPlacement(afterBuilding).heightM.toFixed(3)) }
  const selectedRef = roofChanges.find((change) => change.after)?.after?.segmentRef ?? targetRef ?? afterBuilding.roof.ref
  return { targetScope, roofChanges, junctions: afterBuilding.roof.junctions, buildingHeight, selectedRef, roofRefs: [...changedRefs, ...afterBuilding.roof.junctions.map((junction) => junction.ref)] }
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

const sunReadout = () => {
  const state = useStudioStore.getState(); const sunTime = state.sunTime
  const site = { latitude: state.project.climateProfile.latitude, longitude: state.project.climateProfile.longitude, timezone: state.project.climateProfile.timezone }
  const sun = solarPosition(site, sunTime); const events = sunriseSunset(site, sunTime)
  return { sunTime, altitudeDeg: Number(sun.altitudeDeg.toFixed(2)), azimuthDeg: Number(sun.azimuthDeg.toFixed(2)), sunriseLocal: events ? Number(events.sunriseHour.toFixed(2)) : null, sunsetLocal: events ? Number(events.sunsetHour.toFixed(2)) : null }
}

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
  define({ ...webMcpToolPrompts.get_proposals, input: webMcpSchemas.get_proposals, readOnly: true, handler: ({ action, proposalRef, baseVariantRef, variantRefs, status, includeDrafts }) => {
    const state = useStudioStore.getState()
    if (action === 'diff') {
      const variantRef = proposalRef!
      const variant = state.variants.find((item) => item.ref === variantRef) ?? state.proposals.find((item) => item.ref === variantRef) ?? (() => { throw new Error(`Variant not found: ${variantRef}`) })()
      const base = baseVariantRef ? projectForVariant(state.project, state.variants, baseVariantRef) : state.project
      const diff = diffProjects(base, variant.project, { maxChanges: 40 })
      const area = diff.metricDeltas.homeAreaM2 ? `; home area ${diff.metricDeltas.homeAreaM2.delta > 0 ? '+' : ''}${diff.metricDeltas.homeAreaM2.delta} m²` : ''
      return { status: 'ok', projectRevision: state.project.revision, variantRef, baseVariantRef, summary: `${variant.label}: ${diff.counts.added} added, ${diff.counts.removed} removed, ${diff.counts.modified} modified${area}.`, diff }
    }
    if (action === 'compare') {
      const variants = variantRefs!.map((variantRef) => state.variants.find((variant) => variant.ref === variantRef) ?? (() => { throw new Error(`Variant not found: ${variantRef}`) })())
      return { status: 'ok', projectRevision: state.project.revision, summary: `Compared ${variants.length} variants.`, data: variants.map(({ ref: variantRef, label, baseRevision, metrics, issues }) => ({ variantRef, label, baseRevision, metrics, issues })) }
    }
    const counts = state.proposals.reduce((result, proposal) => ({ ...result, [proposal.status]: result[proposal.status] + 1 }), { pending: 0, approved: 0, rejected: 0, stale: 0 })
    const proposals = proposalRef ? state.proposals.filter((proposal) => proposal.ref === proposalRef) : state.proposals.filter((proposal) => !status || proposal.status === status)
    if (proposalRef && !proposals.length) throw new Error(`Proposal not found: ${proposalRef}`)
    return { status: 'ok', projectRevision: state.project.revision, summary: proposalRef ? `Returned proposal ${proposalRef}.` : `Returned ${proposals.length} proposal record(s).`, counts, proposals: proposals.map(proposalData), drafts: includeDrafts ? state.draftChangeSets.map(draftData) : [] }
  } }),
  define({ ...webMcpToolPrompts.list_catalog, input: webMcpSchemas.list_catalog, readOnly: true, handler: ({ catalog, surface, type }) => {
    const revision = useStudioStore.getState().project.revision
    if (catalog === 'garden-fixtures') return { status: 'ok', projectRevision: revision, summary: `Returned ${gardenFixtureCatalog.length} garden fixtures.`, data: gardenFixtureCatalog }
    if (catalog === 'textures') {
      const scans = (surface ? texturesFor(surface) : textureLibrary).map(({ id, name, surfaces, tileM }) => ({ id, name, surfaces, tileM }))
      return { status: 'ok', projectRevision: revision, summary: `Returned ${scans.length} CC0 material scans${surface ? ` for ${surface} surfaces` : ''}; use none for a flat colour.`, data: scans }
    }
    if (type) {
      const entry = operationReference.find((item) => item.type === type)
      if (!entry) throw new Error(`Unknown operation type: ${type}. Known types: ${operationReference.map((item) => item.type).join(', ')}.`)
      return { status: 'ok', projectRevision: revision, summary: `${entry.type}: ${entry.purpose}`, data: [entry] }
    }
    return { status: 'ok', projectRevision: revision, summary: `Returned ${operationReference.length} operation types; pass type for the required and optional fields of one.`, data: operationReference.map((item) => ({ type: item.type, purpose: item.purpose })) }
  } }),
  define({ ...webMcpToolPrompts.measure_height, input: webMcpSchemas.measure_height, readOnly: true, handler: (input) => {
    const project = useStudioStore.getState().project
    const request = input.mode === 'semantic' ? { mode: 'semantic' as const, objectRef: input.objectRef!, measurement: input.measurement } : { mode: 'free-vertical' as const, startPoint: input.startPoint!, endPoint: input.endPoint! }
    const measurement = measureHeight(project, request)
    return { status: 'ok', projectRevision: project.revision, summary: `${measurement.label}: ${measurement.heightM.toFixed(2)} m.`, measurement }
  } }),
  define({ ...webMcpToolPrompts.run_analysis, input: webMcpSchemas.run_analysis, readOnly: true, handler: ({ kind, months, targetRef, point, month, day, stepMinutes, hours, includeGrid, variantRef }) => {
    const state = useStudioStore.getState(); const project = projectForVariant(state.project, state.variants, variantRef)
    if (kind === 'seasonal') {
      const selected = months ?? [1, 4, 7, 10]
      return { status: 'ok', kind, projectRevision: state.project.revision, variantRef, summary: `Seasonal analysis completed for ${selected.length} month(s).`, metrics: calculateMetrics(project), data: analyzeSeason(project, selected) }
    }
    const target = resolveSunTarget(project, targetRef, point)
    const analysis = analyzeSunlight(project, { target, month: month!, day: day ?? 21, stepMinutes: stepMinutes ?? 30, hours, includeGrid: includeGrid ?? false })
    if (analysis.grid) analysis.grid = downsampleSunGrid(analysis.grid, 12)
    const label = target.kind === 'point' ? `Point ${target.x}, ${target.z}` : target.kind === 'site' ? 'Site' : target.ref
    return { status: 'ok', kind, projectRevision: state.project.revision, variantRef, summary: `${label}: ${analysis.sunHours.mean} h direct sun on ${formatSunMoment(month!, analysis.day, 12).slice(0, -6)} (${analysis.expectedSunHours} h expected after typical cloud).`, analysis }
  } }),
  define({ ...webMcpToolPrompts.show_structure_views, input: webMcpSchemas.show_structure_views, readOnly: true, handler: (input, { signal }) => {
    const views = input.views ? structureViewsSchema.parse(input.views) : undefined
    return showStructureViews({ mode: input.mode, buildingRefs: input.buildingRefs, variantRef: input.variantRef, includeAnnotations: input.includeAnnotations, ...(views ? { views } : {}) }, signal)
  } }),
  define({ ...webMcpToolPrompts.set_viewer_state, input: webMcpSchemas.set_viewer_state, readOnly: true, handler: ({ explode, planStoreyRef, focusRef, sunTime }) => {
    const state = useStudioStore.getState()
    if (focusRef) { const found = findProjectObject(state.project, focusRef); if (!found && focusRef !== 'site') throw new Error(`Object not found: ${focusRef}.`) }
    if (explode !== undefined) { state.setViewerMode('edit'); state.setExplodeStoreys(explode) }
    if (planStoreyRef !== undefined) {
      if (planStoreyRef && !state.project.buildings.some((building) => building.storeys.some((storey) => storey.ref === planStoreyRef))) throw new Error(`Storey not found: ${planStoreyRef}.`)
      state.setActivePlanStoreyRef(planStoreyRef)
    }
    if (focusRef !== undefined) {
      state.setSelectedRef(focusRef)
      const kind = focusRef ? findProjectObject(state.project, focusRef)?.kind : undefined
      if (kind === 'building') state.refocusCamera(); else if (kind === 'fixture' && focusRef) state.focusGardenFixtures(focusRef)
    }
    if (sunTime) state.setSunTime(sunTime)
    const next = useStudioStore.getState(); const sun = sunTime ? sunReadout() : null
    const sunSummary = sun ? `, sun ${formatSunMoment(sun.sunTime.month, sun.sunTime.day, sun.sunTime.hour)} at altitude ${sun.altitudeDeg.toFixed(1)}°` : ''
    return { status: 'ok', projectRevision: next.project.revision, summary: `Viewer: ${next.explodeStoreys ? 'exploded' : 'assembled'}${next.selectedRef ? `, selected ${next.selectedRef}` : ''}${sunSummary}.`, viewer: { explode: next.explodeStoreys, viewerMode: next.viewerMode, activePlanStoreyRef: next.activePlanStoreyRef, selectedRef: next.selectedRef }, ...(sun ?? {}) }
  } }),
  define({ ...webMcpToolPrompts.propose_change, input: webMcpSchemas.propose_change, handler: ({ label, operations }) => {
    const state = useStudioStore.getState(); const before = state.project; const beforeMetrics = calculateMetrics(before)
    const { commands, warnings, extras } = expandOperations(before, operations)
    const parsedOperations = operationsSchema.parse({ operations }).operations
    const variant = state.createVariant(label ?? labelFor(parsedOperations), commands)
    variant.issues.push(...warnings)
    const buildingRefs = [...new Set(commands.flatMap((command) => 'buildingRef' in command && typeof command.buildingRef === 'string' ? [command.buildingRef] : []))]
    const building = buildingRefs.length === 1 ? variant.project.buildings.find((item) => item.ref === buildingRefs[0]) : undefined
    const roofOperation = parsedOperations.find((operation): operation is Extract<WebMcpOperation, { type: 'roof.update' }> => operation.type === 'roof.update')
    const roof = roofOperation ? roofReport(before, variant.project, roofOperation) : {}
    if (roof.selectedRef) state.setSelectedRef(roof.selectedRef)
    const affectedRefs = [...new Set([...commands.flatMap(refsOf), ...(roof.roofRefs ?? [])])].slice(0, 40)
    const { selectedRef: _selected, roofRefs: _roofRefs, ...roofFields } = roof
    return {
      ...variantPayload(variant), operations: commandAudit(commands), affectedRefs, areaAddedM2: Number((variant.metrics.homeAreaM2 - beforeMetrics.homeAreaM2).toFixed(3)),
      ...(building ? { buildingHeightM: Number(buildingPlacement(building).heightM.toFixed(3)), levelCount: building.storeys.length } : {}), ...roofFields, ...extras,
    }
  } }),
  define({ ...webMcpToolPrompts.manage_change_set, input: webMcpSchemas.manage_change_set, handler: (input) => {
    const state = useStudioStore.getState(); const project = state.project
    if (input.action === 'create') {
      state.createDraftChangeSet(input.changeSetRef, input.label!, input.baseRevision!)
      return { status: 'draft_created', projectRevision: project.revision, summary: `${input.label} draft created.`, changeSetRef: input.changeSetRef, baseRevision: input.baseRevision!, operations: [], issues: [], metrics: calculateMetrics(project) }
    }
    if (input.action === 'add-operations') {
      const { commands } = expandOperations(project, input.operations!)
      const { draft, preview } = state.addDraftOperations(input.changeSetRef, commands)
      return { status: 'draft_updated', projectRevision: project.revision, summary: `${input.operations!.length} operation(s) added; ${draft.commands.length} command(s) total.`, changeSetRef: input.changeSetRef, baseRevision: draft.baseRevision, operations: commandAudit(draft.commands), issues: validateProject(preview), metrics: calculateMetrics(preview) }
    }
    if (input.action === 'finalize') {
      const variant = state.finalizeDraftChangeSet(input.changeSetRef)
      return { ...variantPayload(variant), changeSetRef: input.changeSetRef, operations: commandAudit(variant.commands) }
    }
    state.discardDraftChangeSet(input.changeSetRef)
    return { status: 'ok', projectRevision: project.revision, summary: 'Draft change set discarded.', changeSetRef: input.changeSetRef }
  } }),
  define({ ...webMcpToolPrompts.manage_variant, input: webMcpSchemas.manage_variant, handler: (input, { signal }) => {
    if (input.action === 'undo-last-change') { const project = useStudioStore.getState().undo(); return { status: 'ok', projectRevision: project.revision, summary: 'Last committed change was undone.', metrics: calculateMetrics(project) } }
    if (input.action === 'request-apply') return requestVariantApproval(input.variantRef!, signal)
    const state = useStudioStore.getState(); state.discardVariant(input.variantRef!, input.reason)
    return { status: 'rejected', projectRevision: state.project.revision, variantRef: input.variantRef, summary: 'Proposal rejected and retained in history.' }
  } }),
]

type WebMcpRegistrationHost = typeof globalThis & { __projectV2WebMcpRegistrationController?: AbortController }

export const registerWebMcpTools = () => {
  const modelContext = document.modelContext; const available = Boolean(modelContext?.registerTool); useStudioStore.getState().setWebMcpAvailable(available)
  if (!modelContext) return () => undefined
  const registrationHost = globalThis as WebMcpRegistrationHost
  registrationHost.__projectV2WebMcpRegistrationController?.abort()
  const controller = new AbortController()
  registrationHost.__projectV2WebMcpRegistrationController = controller
  Promise.all(webMcpTools.map((tool) => modelContext.registerTool(tool, { signal: controller.signal }))).catch((error) => { if (!controller.signal.aborted) useStudioStore.getState().setToast(`WebMCP registration failed: ${error instanceof Error ? error.message : 'unknown error'}`) })
  return () => {
    controller.abort()
    if (registrationHost.__projectV2WebMcpRegistrationController === controller) delete registrationHost.__projectV2WebMcpRegistrationController
  }
}
