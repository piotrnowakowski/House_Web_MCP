import { create } from 'zustand'
import { applyCommand, applyCommands, calculateMetrics, validateProject } from '../domain/commands'
import { applyModernBarnPreset, isModernBarnPreset } from '../domain/presets'
import { modernBarnProject } from '../domain/sampleProject'
import { REFERENCE_YEAR, type SunTime } from '../domain/solar'
import type { SunlightAnalysis } from '../domain/sunlight'
import type { HeightMeasureKind, ProjectCommand, ProjectV2, StructureReport, TransformMode, VariantModel, ViewerMode, ViewMode } from '../domain/types'

interface StudioState {
  project: ProjectV2
  history: ProjectV2[]
  variants: VariantModel[]
  selectedRef: string | null
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
  setHydrated: (value: boolean) => void
  setConfirmationVariantRef: (ref: string | null) => void
  setStructureReport: (report: StructureReport | null) => void
  setToast: (message: string | null) => void
  setHelpOpen: (value: boolean) => void
  refocusCamera: () => void
  focusGardenFixtures: () => void
  useModernBarnPreset: () => ProjectV2
  replaceProject: (project: ProjectV2) => void
  createVariant: (label: string, commands: ProjectCommand[]) => VariantModel
  applyVariant: (ref: string) => ProjectV2
  discardVariant: (ref: string) => void
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

export const useStudioStore = create<StudioState>((set, get) => ({
  project: structuredClone(modernBarnProject), history: [], variants: [], selectedRef: null,
  viewMode: 'realistic', transformMode: 'translate', viewerMode: 'edit', heightMeasureKind: 'auto', activePlanStoreyRef: null, month: 7,
  sunTime: { month: 7, day: 15, hour: 14 }, sunAnimation: 'none', sunOverlay: { enabled: false, targetRef: null, result: null },
  explodeStoreys: false, webMcpAvailable: false, hydrated: false, confirmationVariantRef: null, structureReport: null,
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
  setHydrated: (hydrated) => set({ hydrated }),
  setConfirmationVariantRef: (confirmationVariantRef) => set({ confirmationVariantRef }),
  setStructureReport: (structureReport) => { revokeReport(get().structureReport); set({ structureReport }) },
  setToast: (toast) => set({ toast }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  refocusCamera: () => set((state) => ({
    cameraRefocusRequest: state.cameraRefocusRequest + 1,
    viewerMode: 'edit',
    activePlanStoreyRef: null,
    toast: `Camera refocused on ${state.project.buildings[0]?.name ?? 'the building'}.`,
  })),
  focusGardenFixtures: () => set((state) => {
    if (!state.project.landscape.fixtures.length) return { toast: 'Place a garden fixture first.' }
    const targetX = state.project.landscape.fixtures.reduce((sum, fixture) => sum + fixture.position.x, 0) / state.project.landscape.fixtures.length
    const targetZ = state.project.landscape.fixtures.reduce((sum, fixture) => sum + fixture.position.z, 0) / state.project.landscape.fixtures.length
    return { gardenFocusRequest: { sequence: state.gardenFocusRequest.sequence + 1, targetX, targetZ }, viewerMode: 'edit', activePlanStoreyRef: null, toast: 'Camera focused on the placed garden fixtures.' }
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
    set({ project: next, history: [...state.history, structuredClone(state.project)].slice(-40), variants: [], selectedRef: houseRef, cameraRefocusRequest: state.cameraRefocusRequest + 1, toast: 'Modern barn preset applied: two levels and a 45° gable.' })
    return next
  },
  replaceProject: (project) => { revokeReport(get().structureReport); set((state) => ({ project, variants: [], history: [], structureReport: null, sunOverlay: { ...state.sunOverlay, result: null }, toast: `Loaded ${project.name}.` })) },
  createVariant: (label, commands) => {
    const current = get().project
    const preview = applyCommands(current, commands)
    variantSequence += 1
    const variant: VariantModel = {
      ref: `variant/${slug(label)}-r${current.revision}-${variantSequence}`, label, baseRevision: current.revision,
      createdAt: new Date().toISOString(), commands, project: preview, issues: validateProject(preview), metrics: calculateMetrics(preview),
    }
    set((state) => ({ variants: [...state.variants, variant], toast: `${label} is ready to review.` }))
    return variant
  },
  applyVariant: (ref) => {
    const state = get(); const variant = state.variants.find((item) => item.ref === ref)
    if (!variant) throw new Error(`Variant not found: ${ref}`)
    if (variant.baseRevision !== state.project.revision) throw new Error('Variant is stale. Create it again from the current project.')
    if (variant.issues.some((issue) => issue.severity === 'error')) throw new Error('Variant contains blocking validation errors.')
    const next = { ...structuredClone(variant.project), revision: state.project.revision + 1, updatedAt: new Date().toISOString() }
    set({ project: next, history: [...state.history, structuredClone(state.project)].slice(-40), variants: [], confirmationVariantRef: null, toast: `${variant.label} applied.` })
    return next
  },
  discardVariant: (ref) => set((state) => ({ variants: state.variants.filter((item) => item.ref !== ref), confirmationVariantRef: null, toast: 'Variant discarded.' })),
  commitCommand: (command) => {
    const state = get(); const next = applyCommand(state.project, command)
    const blocking = validateProject(next).filter((issue) => issue.severity === 'error')
    if (blocking.length) throw new Error(blocking[0].message)
    next.revision = state.project.revision + 1
    set({ project: next, history: [...state.history, structuredClone(state.project)].slice(-40), variants: [], toast: 'Spatial edit applied.' })
  },
  commitCommands: (commands, message = 'Spatial edits applied.') => {
    const state = get(); const next = applyCommands(state.project, commands)
    const blocking = validateProject(next).filter((issue) => issue.severity === 'error')
    if (blocking.length) throw new Error(blocking[0].message)
    next.revision = state.project.revision + 1
    next.updatedAt = new Date().toISOString()
    set({ project: next, history: [...state.history, structuredClone(state.project)].slice(-40), variants: [], toast: message })
    return next
  },
  undo: () => {
    const state = get(); const previous = state.history.at(-1)
    if (!previous) throw new Error('There is no committed change to undo.')
    set({ project: previous, history: state.history.slice(0, -1), variants: [], confirmationVariantRef: null, toast: 'Last change undone.' })
    return previous
  },
}))
