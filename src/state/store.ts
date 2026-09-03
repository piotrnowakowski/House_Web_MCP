import { create } from 'zustand'
import { applyCommand, applyCommands, calculateMetrics, validateProject } from '../domain/commands'
import { applyModernBarnPreset, isModernBarnPreset } from '../domain/presets'
import { modernBarnProject } from '../domain/sampleProject'
import { REFERENCE_YEAR, type SunTime } from '../domain/solar'
import type { SunlightAnalysis } from '../domain/sunlight'
import type { DraftChangeSetModel, HeightMeasureKind, PersistedWorkspace, ProjectCommand, ProjectV2, ProposalRecord, StructureReport, TransformMode, VariantModel, ViewerMode, ViewMode } from '../domain/types'

interface StudioState {
  project: ProjectV2
  history: ProjectV2[]
  variants: VariantModel[]
  proposals: ProposalRecord[]
  draftChangeSets: DraftChangeSetModel[]
  selectedRef: string | null
  repositioningRef: string | null
  viewMode: ViewMode
  transformMode: TransformMode
  viewerMode: ViewerMode
  heightMeasureKind: HeightMeasureKind
  activePlanStoreyRef: string | null
  month: number
  sunTime: SunTime
  sunAnimation: 'none' | 'day' | 'year'
  sunOverlay: { enabled: boolean; targetRef: string | null; result: SunlightAnalysis | null }
  explodeStoreys: boolean
  webMcpAvailable: boolean
  texturesReady: boolean
  hydrated: boolean
  confirmationVariantRef: string | null
  structureReport: StructureReport | null
  toast: string | null
  helpOpen: boolean
  cameraRefocusRequest: number
  gardenFocusRequest: { sequence: number; targetX: number; targetZ: number }
  setSelectedRef: (ref: string | null) => void
  setViewMode: (mode: ViewMode) => void
  setTransformMode: (mode: TransformMode) => void
  setViewerMode: (mode: ViewerMode) => void
  setHeightMeasureKind: (kind: HeightMeasureKind) => void
  setActivePlanStoreyRef: (ref: string | null) => void
  setMonth: (month: number) => void
  setSunTime: (time: Partial<SunTime>) => void
  setSunAnimation: (mode: 'none' | 'day' | 'year') => void
  setSunOverlay: (overlay: Partial<{ enabled: boolean; targetRef: string | null; result: SunlightAnalysis | null }>) => void
  setExplodeStoreys: (value: boolean) => void
  setWebMcpAvailable: (value: boolean) => void
  setTexturesReady: (value: boolean) => void
  setHydrated: (value: boolean) => void
  setConfirmationVariantRef: (ref: string | null) => void
  setStructureReport: (report: StructureReport | null) => void
  setToast: (message: string | null) => void
  setHelpOpen: (value: boolean) => void
  refocusCamera: () => void
  focusGardenFixtures: (fixtureRef?: string) => void
  useModernBarnPreset: () => ProjectV2
  replaceProject: (project: ProjectV2) => void
  restoreWorkspace: (workspace: PersistedWorkspace) => void
  createVariant: (label: string, commands: ProjectCommand[], metadata?: Pick<ProposalRecord, 'sourceChangeSetRef' | 'recreatedFromRef'>) => VariantModel
  applyVariant: (ref: string) => ProjectV2
  discardVariant: (ref: string, reason?: string) => void
  reopenProposal: (ref: string) => VariantModel
  recreateProposal: (ref: string) => VariantModel
  createDraftChangeSet: (ref: string, label: string, baseRevision: number) => DraftChangeSetModel
  addDraftOperations: (ref: string, operations: ProjectCommand[]) => { draft: DraftChangeSetModel; preview: ProjectV2 }
  finalizeDraftChangeSet: (ref: string) => VariantModel
  discardDraftChangeSet: (ref: string) => void
  beginReposition: (ref: string) => void
  endReposition: () => void
  commitCommand: (command: ProjectCommand) => void
  commitCommands: (commands: ProjectCommand[], message?: string) => ProjectV2
  undo: () => ProjectV2
}

let variantSequence = 0
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)
const revokeReport = (report: StructureReport | null) => report?.views.forEach((view) => URL.revokeObjectURL(view.imageUrl))
const daysInMonth = (month: number) => new Date(Date.UTC(REFERENCE_YEAR, month, 0)).getUTCDate()
const clampSunTime = (time: SunTime): SunTime => {
  const month = Math.min(12, Math.max(1, Math.round(time.month)))
  return { month, day: Math.min(daysInMonth(month), Math.max(1, Math.round(time.day))), hour: Math.min(24, Math.max(0, time.hour)) }
}
const commandFocusRef = (commands: ProjectCommand[]) => {
  for (const command of commands) {
    for (const [key, value] of Object.entries(command)) if ((key === 'segmentRef' || key.endsWith('Ref')) && typeof value === 'string') return value
  }
  return null
}
const staleRecords = (records: ProposalRecord[], revision: number) => records.map((proposal) => proposal.status === 'pending' && proposal.baseRevision !== revision ? { ...proposal, status: 'stale' as const } : proposal)
const staleDrafts = (drafts: DraftChangeSetModel[], revision: number) => drafts.map((draft) => draft.baseRevision === revision ? draft : { ...draft, status: 'stale' as const })

export const useStudioStore = create<StudioState>((set, get) => ({
  project: structuredClone(modernBarnProject), history: [], variants: [], proposals: [], draftChangeSets: [], selectedRef: null, repositioningRef: null,
  viewMode: 'realistic', transformMode: 'translate', viewerMode: 'edit', heightMeasureKind: 'auto', activePlanStoreyRef: null, month: 7,
  sunTime: { month: 7, day: 15, hour: 14 }, sunAnimation: 'none', sunOverlay: { enabled: false, targetRef: null, result: null },
  explodeStoreys: false, webMcpAvailable: false, texturesReady: false, hydrated: false, confirmationVariantRef: null, structureReport: null,
  toast: 'Loaded the ProjectV2 Zielonki spatial model.', helpOpen: false, cameraRefocusRequest: 0, gardenFocusRequest: { sequence: 0, targetX: 0, targetZ: 0 },
  setSelectedRef: (selectedRef) => set({ selectedRef }),
  setViewMode: (viewMode) => set({ viewMode }),
  setTransformMode: (transformMode) => set({ transformMode }),
  setViewerMode: (viewerMode) => set({ viewerMode, activePlanStoreyRef: viewerMode === 'plan' ? get().activePlanStoreyRef : null }),
  setHeightMeasureKind: (heightMeasureKind) => set({ heightMeasureKind }),
  setActivePlanStoreyRef: (activePlanStoreyRef) => set({ activePlanStoreyRef, viewerMode: activePlanStoreyRef ? 'plan' : 'edit' }),
  setMonth: (month) => set((state) => { const time = clampSunTime({ ...state.sunTime, month, day: 15 }); return { month: time.month, sunTime: time } }),
  setSunTime: (time) => set((state) => { const next = clampSunTime({ ...state.sunTime, ...time }); return { sunTime: next, month: next.month } }),
  setSunAnimation: (sunAnimation) => set({ sunAnimation }),
  setSunOverlay: (overlay) => set((state) => ({ sunOverlay: { ...state.sunOverlay, ...overlay } })),
  setExplodeStoreys: (explodeStoreys) => set({ explodeStoreys }),
  setWebMcpAvailable: (webMcpAvailable) => set({ webMcpAvailable }),
  setTexturesReady: (texturesReady) => set({ texturesReady }),
  setHydrated: (hydrated) => set({ hydrated }),
  setConfirmationVariantRef: (confirmationVariantRef) => set({ confirmationVariantRef }),
  setStructureReport: (structureReport) => { revokeReport(get().structureReport); set({ structureReport }) },
  setToast: (toast) => set({ toast }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  beginReposition: (repositioningRef) => set({ repositioningRef, viewerMode: 'edit', transformMode: 'translate', toast: 'Drag the selected object to its new position.' }),
  endReposition: () => set({ repositioningRef: null }),
  refocusCamera: () => set((state) => ({
    cameraRefocusRequest: state.cameraRefocusRequest + 1,
    viewerMode: 'edit',
    activePlanStoreyRef: null,
    toast: `Camera refocused on ${state.project.buildings[0]?.name ?? 'the building'}.`,
  })),
  focusGardenFixtures: (fixtureRef) => set((state) => {
    const fixtures = fixtureRef ? state.project.landscape.fixtures.filter((fixture) => fixture.ref === fixtureRef) : state.project.landscape.fixtures
    if (!fixtures.length) return { toast: fixtureRef ? `Fixture not found: ${fixtureRef}.` : 'Place a garden fixture first.' }
    const targetX = fixtures.reduce((sum, fixture) => sum + fixture.position.x, 0) / fixtures.length
    const targetZ = fixtures.reduce((sum, fixture) => sum + fixture.position.z, 0) / fixtures.length
    return { gardenFocusRequest: { sequence: state.gardenFocusRequest.sequence + 1, targetX, targetZ }, viewerMode: 'edit', activePlanStoreyRef: null, toast: fixtureRef ? `Camera focused on ${fixtures[0].name}.` : 'Camera focused on the placed garden fixtures.' }
  }),
  useModernBarnPreset: () => {
    const state = get()
    if (isModernBarnPreset(state.project)) {
      set({ selectedRef: state.project.buildings.find((item) => item.kind === 'house')?.ref ?? null, cameraRefocusRequest: state.cameraRefocusRequest + 1, toast: 'Modern barn preset is already active.' })
      return state.project
    }
    const next = applyModernBarnPreset(state.project)
    next.revision = state.project.revision + 1
    next.updatedAt = new Date().toISOString()
    const blocking = validateProject(next).filter((issue) => issue.severity === 'error')
    if (blocking.length) throw new Error(blocking[0].message)
    const houseRef = next.buildings.find((item) => item.kind === 'house')?.ref ?? null
    set({ project: next, history: [...state.history, structuredClone(state.project)].slice(-40), variants: [], proposals: staleRecords(state.proposals, next.revision), draftChangeSets: staleDrafts(state.draftChangeSets, next.revision), selectedRef: houseRef, cameraRefocusRequest: state.cameraRefocusRequest + 1, toast: 'Modern barn preset applied: two levels and a 45° gable.' })
    return next
  },
  replaceProject: (project) => { revokeReport(get().structureReport); set((state) => ({ project, variants: [], proposals: [], draftChangeSets: [], history: [], structureReport: null, sunOverlay: { ...state.sunOverlay, result: null }, toast: `Loaded ${project.name}.` })) },
  restoreWorkspace: (workspace) => {
    revokeReport(get().structureReport)
    const proposals = staleRecords(workspace.proposals, workspace.project.revision)
    const variants = proposals.filter((proposal) => proposal.status === 'pending')
    set({ project: workspace.project, proposals, variants, draftChangeSets: staleDrafts(workspace.draftChangeSets, workspace.project.revision), history: [], structureReport: null, sunOverlay: { enabled: false, targetRef: null, result: null }, toast: `Loaded ${workspace.project.name} with ${proposals.length} proposal record${proposals.length === 1 ? '' : 's'}.` })
  },
  createVariant: (label, commands, metadata) => {
    const current = get().project
    const preview = applyCommands(current, commands)
    variantSequence += 1
    const createdAt = new Date().toISOString()
    const proposal: ProposalRecord = {
      ref: `variant/${slug(label)}-r${current.revision}-${Date.now().toString(36)}-${variantSequence}`, label, baseRevision: current.revision,
      createdAt, commands: structuredClone(commands), project: preview, issues: validateProject(preview), metrics: calculateMetrics(preview), status: 'pending', ...metadata,
    }
    set((state) => ({ variants: [...state.variants, proposal], proposals: [...state.proposals, proposal], toast: `${label} is ready to review.` }))
    return proposal
  },
  applyVariant: (ref) => {
    const state = get(); const variant = state.variants.find((item) => item.ref === ref)
    if (!variant) throw new Error(`Variant not found: ${ref}`)
    if (variant.baseRevision !== state.project.revision) throw new Error('Variant is stale. Create it again from the current project.')
    if (variant.issues.some((issue) => issue.severity === 'error')) throw new Error('Variant contains blocking validation errors.')
    const next = { ...structuredClone(variant.project), revision: state.project.revision + 1, updatedAt: new Date().toISOString() }
    const decisionAt = new Date().toISOString()
    const proposals = state.proposals.map((proposal) => proposal.ref === ref ? { ...proposal, status: 'approved' as const, decisionAt, resultingRevision: next.revision } : proposal.status === 'pending' ? { ...proposal, status: 'stale' as const } : proposal)
    set({ project: next, history: [...state.history, structuredClone(state.project)].slice(-40), variants: [], proposals, draftChangeSets: staleDrafts(state.draftChangeSets, next.revision), confirmationVariantRef: null, repositioningRef: null, toast: `${variant.label} applied.` })
    return next
  },
  discardVariant: (ref, reason) => set((state) => ({
    variants: state.variants.filter((item) => item.ref !== ref),
    proposals: state.proposals.map((proposal) => proposal.ref === ref ? { ...proposal, status: 'rejected' as const, decisionAt: new Date().toISOString(), rejectionReason: reason } : proposal),
    confirmationVariantRef: state.confirmationVariantRef === ref ? null : state.confirmationVariantRef, toast: 'Proposal rejected and retained in history.',
  })),
  reopenProposal: (ref) => {
    const state = get(); const proposal = state.proposals.find((item) => item.ref === ref)
    if (!proposal) throw new Error(`Proposal not found: ${ref}`)
    if (proposal.status !== 'pending' || proposal.baseRevision !== state.project.revision) throw new Error('Only a current pending proposal can be reopened for approval.')
    if (!state.variants.some((item) => item.ref === ref)) set({ variants: [...state.variants, proposal] })
    set({ confirmationVariantRef: ref, selectedRef: commandFocusRef(proposal.commands), cameraRefocusRequest: state.cameraRefocusRequest + 1, toast: `${proposal.label} reopened for review.` })
    return proposal
  },
  recreateProposal: (ref) => {
    const proposal = get().proposals.find((item) => item.ref === ref)
    if (!proposal) throw new Error(`Proposal not found: ${ref}`)
    const recreated = get().createVariant(`${proposal.label} (recreated)`, proposal.commands, { recreatedFromRef: proposal.ref })
    get().reopenProposal(recreated.ref)
    return recreated
  },
  createDraftChangeSet: (ref, label, baseRevision) => {
    const state = get(); if (baseRevision !== state.project.revision) throw new Error(`Cannot create draft from revision ${baseRevision}; current revision is ${state.project.revision}.`)
    if (state.draftChangeSets.some((draft) => draft.ref === ref)) throw new Error(`Draft change set already exists: ${ref}`)
    const draft: DraftChangeSetModel = { ref, label, baseRevision, createdAt: new Date().toISOString(), commands: [], status: 'draft' }
    set({ draftChangeSets: [...state.draftChangeSets, draft] }); return draft
  },
  addDraftOperations: (ref, operations) => {
    const state = get(); const draft = state.draftChangeSets.find((item) => item.ref === ref)
    if (!draft) throw new Error(`Draft change set not found: ${ref}`)
    if (draft.status === 'stale' || draft.baseRevision !== state.project.revision) throw new Error(`Draft change set is stale: base revision ${draft.baseRevision}, current revision ${state.project.revision}.`)
    const commands = [...draft.commands, ...structuredClone(operations)]; const preview = applyCommands(state.project, commands); const updated = { ...draft, commands }
    set({ draftChangeSets: state.draftChangeSets.map((item) => item.ref === ref ? updated : item) }); return { draft: updated, preview }
  },
  finalizeDraftChangeSet: (ref) => {
    const state = get(); const draft = state.draftChangeSets.find((item) => item.ref === ref)
    if (!draft) throw new Error(`Draft change set not found: ${ref}`)
    if (draft.status === 'stale' || draft.baseRevision !== state.project.revision) throw new Error(`Draft change set is stale: base revision ${draft.baseRevision}, current revision ${state.project.revision}.`)
    if (!draft.commands.length) throw new Error('Cannot finalize an empty change set.')
    const variant = get().createVariant(draft.label, draft.commands, { sourceChangeSetRef: draft.ref })
    set({ draftChangeSets: get().draftChangeSets.filter((item) => item.ref !== ref) }); return variant
  },
  discardDraftChangeSet: (ref) => {
    const state = get(); if (!state.draftChangeSets.some((item) => item.ref === ref)) throw new Error(`Draft change set not found: ${ref}`)
    set({ draftChangeSets: state.draftChangeSets.filter((item) => item.ref !== ref), toast: 'Draft change set discarded.' })
  },
  commitCommand: (command) => {
    const state = get(); const next = applyCommand(state.project, command)
    const blocking = validateProject(next).filter((issue) => issue.severity === 'error')
    if (blocking.length) throw new Error(blocking[0].message)
    next.revision = state.project.revision + 1
    set({ project: next, history: [...state.history, structuredClone(state.project)].slice(-40), variants: [], proposals: staleRecords(state.proposals, next.revision), draftChangeSets: staleDrafts(state.draftChangeSets, next.revision), repositioningRef: null, toast: 'Spatial edit applied.' })
  },
  commitCommands: (commands, message = 'Spatial edits applied.') => {
    const state = get(); const next = applyCommands(state.project, commands)
    const blocking = validateProject(next).filter((issue) => issue.severity === 'error')
    if (blocking.length) throw new Error(blocking[0].message)
    next.revision = state.project.revision + 1
    next.updatedAt = new Date().toISOString()
    set({ project: next, history: [...state.history, structuredClone(state.project)].slice(-40), variants: [], proposals: staleRecords(state.proposals, next.revision), draftChangeSets: staleDrafts(state.draftChangeSets, next.revision), repositioningRef: null, toast: message })
    return next
  },
  undo: () => {
    const state = get(); const previous = state.history.at(-1)
    if (!previous) throw new Error('There is no committed change to undo.')
    set({ project: previous, history: state.history.slice(0, -1), variants: [], proposals: state.proposals.map((proposal) => proposal.status === 'pending' ? { ...proposal, status: 'stale' as const } : proposal), draftChangeSets: state.draftChangeSets.map((draft) => ({ ...draft, status: 'stale' as const })), confirmationVariantRef: null, repositioningRef: null, toast: 'Last change undone.' })
    return previous
  },
}))
