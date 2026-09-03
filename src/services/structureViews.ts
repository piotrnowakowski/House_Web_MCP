import { buildingPlacement } from '../domain/geometry'
import { formatSunMoment } from '../domain/sunlight'
import type { ProjectV2, StructureReport, StructureViewRequest } from '../domain/types'
import { useStudioStore } from '../state/store'

export interface ShowStructureViewsInput {
  mode?: 'architectural-set' | 'custom'
  buildingRefs?: string[]
  variantRef?: string
  views?: StructureViewRequest[]
  includeAnnotations?: boolean
}

export type ExpandedStructureView = StructureViewRequest & { title: string; buildingRefs: string[] }
export type CaptureStructureReport = (project: ProjectV2, views: ExpandedStructureView[], includeAnnotations: boolean, signal: AbortSignal) => Promise<StructureReport['views']>

let captureHandler: CaptureStructureReport | null = null
export const registerStructureViewCapture = (handler: CaptureStructureReport) => {
  captureHandler = handler
  return () => { if (captureHandler === handler) captureHandler = null }
}

const titleFor = (view: StructureViewRequest, project: ProjectV2) => {
  if (view.type === 'site-plan') return 'Site plan'
  if (view.type === 'axonometric') return 'Axonometric overview'
  if (view.type.endsWith('-elevation')) return `${view.type.split('-')[0][0].toUpperCase()}${view.type.split('-')[0].slice(1)} elevation`
  if (view.type === 'storey-plan') return `${project.buildings.flatMap((building) => building.storeys).find((storey) => storey.ref === view.storeyRef)?.name ?? view.storeyRef} plan`
  if (view.type === 'section') return `${view.axis[0].toUpperCase()}${view.axis.slice(1)} section`
  if (view.type === 'sun-study') return `Sun study, ${formatSunMoment(view.month, view.day, view.hour)}`
  return 'Architectural view'
}

export const expandStructureViews = (project: ProjectV2, input: ShowStructureViewsInput) => {
  const buildings = input.buildingRefs?.length
    ? input.buildingRefs.map((ref) => project.buildings.find((building) => building.ref === ref) ?? (() => { throw new Error(`Unknown buildingRef: ${ref}`) })())
    : project.buildings
  if (!buildings.length) throw new Error('No buildings are available for this report.')
  const buildingRefs = buildings.map((building) => building.ref)
  const mode = input.mode ?? 'architectural-set'
  let requested: StructureViewRequest[]
  if (mode === 'architectural-set') {
    requested = [
      { type: 'site-plan' },
      { type: 'north-elevation' }, { type: 'south-elevation' }, { type: 'east-elevation' }, { type: 'west-elevation' },
      { type: 'axonometric' },
      ...buildings.flatMap((building) => building.storeys.map((storey) => ({ type: 'storey-plan' as const, storeyRef: storey.ref }))),
      { type: 'section', axis: 'longitudinal' }, { type: 'section', axis: 'transverse' },
    ]
  } else {
    if (!input.views?.length) throw new Error('Custom mode requires at least one view.')
    requested = input.views
  }
  if (requested.length > 12) throw new Error(`The expanded report contains ${requested.length} views. Select fewer buildings/storeys or request at most 12 custom views.`)
  const storeyRefs = new Set(buildings.flatMap((building) => building.storeys.map((storey) => storey.ref)))
  requested.forEach((view) => {
    if (view.type === 'storey-plan' && !storeyRefs.has(view.storeyRef)) throw new Error(`Unknown or unselected storeyRef: ${view.storeyRef}`)
    if (view.type === 'section' && view.offsetM !== undefined && (!Number.isFinite(view.offsetM) || Math.abs(view.offsetM) > 100)) throw new Error('Section offsetM must be a finite local-model offset between -100 and 100 metres.')
  })
  return { buildings, views: requested.map((view) => ({ ...view, title: titleFor(view, project), buildingRefs })) }
}

export const showStructureViews = async (input: ShowStructureViewsInput, signal: AbortSignal) => {
  const state = useStudioStore.getState()
  const project = input.variantRef
    ? state.variants.find((variant) => variant.ref === input.variantRef)?.project ?? (() => { throw new Error(`Unknown variantRef: ${input.variantRef}`) })()
    : state.project
  const { buildings, views } = expandStructureViews(project, input)
  if (!captureHandler) throw new Error('The architectural viewport is not ready. Wait for the visible editor to finish loading and try again.')
  const previous = { selectedRef: state.selectedRef, explodeStoreys: state.explodeStoreys, viewerMode: state.viewerMode, activePlanStoreyRef: state.activePlanStoreyRef, confirmationVariantRef: state.confirmationVariantRef }
  let captured: StructureReport['views']
  try {
    state.setSelectedRef(null); state.setExplodeStoreys(false); state.setViewerMode('edit')
    if (input.variantRef) state.setConfirmationVariantRef(input.variantRef)
    if (typeof requestAnimationFrame === 'function') await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    captured = await captureHandler(project, views, input.includeAnnotations ?? true, signal)
    if (signal.aborted) throw new DOMException('Architectural report cancelled.', 'AbortError')
  } finally {
    const current = useStudioStore.getState()
    current.setSelectedRef(previous.selectedRef); current.setExplodeStoreys(previous.explodeStoreys); current.setConfirmationVariantRef(previous.confirmationVariantRef)
    if (previous.activePlanStoreyRef) current.setActivePlanStoreyRef(previous.activePlanStoreyRef); else current.setViewerMode(previous.viewerMode)
  }
  const report: StructureReport = {
    ref: `report/structure-r${state.project.revision}-${Date.now()}`,
    createdAt: new Date().toISOString(), projectRevision: state.project.revision,
    views: captured,
    buildings: buildings.map(buildingPlacement),
  }
  useStudioStore.getState().setStructureReport(report)
  return {
    status: 'ok' as const,
    projectRevision: state.project.revision,
    reportRef: report.ref,
    summary: `Opened a visible architectural report with ${report.views.length} view${report.views.length === 1 ? '' : 's'} for ${report.buildings.length} building${report.buildings.length === 1 ? '' : 's'}.`,
    views: report.views.map(({ type, title, buildingRefs, storeyRef, presentation }) => ({ type, title, buildingRefs, ...(storeyRef ? { storeyRef } : {}), presentation })),
    buildings: report.buildings,
  }
}
