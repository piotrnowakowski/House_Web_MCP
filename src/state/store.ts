import { create } from 'zustand'
import { applyCommand, applyCommands, calculateMetrics, validateProject } from '../domain/commands'
import { sampleProject } from '../domain/sampleProject'
import type { ProjectCommand, ProjectV1, TransformMode, VariantModel, ViewMode } from '../domain/types'

interface StudioState {
  project: ProjectV1
  history: ProjectV1[]
  variants: VariantModel[]
  selectedRef: string | null
  viewMode: ViewMode
  transformMode: TransformMode
  month: number
  explodeFloors: boolean
  webMcpAvailable: boolean
  hydrated: boolean
  confirmationVariantRef: string | null
  pendingExport: 'json' | 'glb' | 'png' | null
  toast: string | null
  helpOpen: boolean
  setSelectedRef: (ref: string | null) => void
  setViewMode: (mode: ViewMode) => void
  setTransformMode: (mode: TransformMode) => void
  setMonth: (month: number) => void
  setExplodeFloors: (value: boolean) => void
  setWebMcpAvailable: (value: boolean) => void
  setHydrated: (value: boolean) => void
  setConfirmationVariantRef: (ref: string | null) => void
  setPendingExport: (format: StudioState['pendingExport']) => void
  setToast: (message: string | null) => void
  setHelpOpen: (value: boolean) => void
  replaceProject: (project: ProjectV1) => void
  createVariant: (label: string, commands: ProjectCommand[]) => VariantModel
  applyVariant: (ref: string) => ProjectV1
  discardVariant: (ref: string) => void
  commitCommand: (command: ProjectCommand) => void
  undo: () => ProjectV1
}

let variantSequence = 0
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)

export const useStudioStore = create<StudioState>((set, get) => ({
  project: structuredClone(sampleProject),
  history: [], variants: [], selectedRef: null, viewMode: 'technical', transformMode: 'translate', month: 7,
  explodeFloors: false, webMcpAvailable: false, hydrated: false, confirmationVariantRef: null, pendingExport: null, toast: 'Loaded surveyed Zielonki /3 construction site with /4 agricultural context.',
  helpOpen: false,
  setSelectedRef: (selectedRef) => set({ selectedRef }),
  setViewMode: (viewMode) => set({ viewMode }),
  setTransformMode: (transformMode) => set({ transformMode }),
  setMonth: (month) => set({ month: Math.min(12, Math.max(1, month)) }),
  setExplodeFloors: (explodeFloors) => set({ explodeFloors }),
  setWebMcpAvailable: (webMcpAvailable) => set({ webMcpAvailable }),
  setHydrated: (hydrated) => set({ hydrated }),
  setConfirmationVariantRef: (confirmationVariantRef) => set({ confirmationVariantRef }),
  setPendingExport: (pendingExport) => set({ pendingExport }),
  setToast: (toast) => set({ toast }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  replaceProject: (project) => set({ project, variants: [], history: [], toast: `Loaded ${project.name}.` }),
  createVariant: (label, commands) => {
    const current = get().project
    const preview = applyCommands(current, commands)
    variantSequence += 1
    const variant: VariantModel = {
      ref: `variant/${slug(label)}-r${current.revision}-${variantSequence}`,
      label, baseRevision: current.revision, createdAt: new Date().toISOString(), commands,
      project: preview, issues: validateProject(preview), metrics: calculateMetrics(preview),
    }
    set((state) => ({ variants: [...state.variants, variant], toast: `${label} is ready to review.` }))
    return variant
  },
  applyVariant: (ref) => {
    const state = get()
    const variant = state.variants.find((item) => item.ref === ref)
    if (!variant) throw new Error(`Variant not found: ${ref}`)
    if (variant.baseRevision !== state.project.revision) throw new Error('Variant is stale. Create it again from the current project.')
    if (variant.issues.some((issue) => issue.severity === 'error')) throw new Error('Variant contains blocking validation errors.')
    const next = { ...structuredClone(variant.project), revision: state.project.revision + 1, updatedAt: new Date().toISOString() }
    set({ project: next, history: [...state.history, structuredClone(state.project)].slice(-40), variants: [], confirmationVariantRef: null, toast: `${variant.label} applied.` })
    return next
  },
  discardVariant: (ref) => set((state) => ({ variants: state.variants.filter((item) => item.ref !== ref), confirmationVariantRef: null, toast: 'Variant discarded.' })),
  commitCommand: (command) => {
    const state = get()
    const next = applyCommand(state.project, command)
    const blocking = validateProject(next).filter((issue) => issue.severity === 'error')
    if (blocking.length) throw new Error(blocking[0].message)
    next.revision = state.project.revision + 1
    set({ project: next, history: [...state.history, structuredClone(state.project)].slice(-40), variants: [], toast: 'Manual edit applied.' })
  },
  undo: () => {
    const state = get()
    const previous = state.history.at(-1)
    if (!previous) throw new Error('There is no committed change to undo.')
    set({ project: previous, history: state.history.slice(0, -1), variants: [], confirmationVariantRef: null, toast: 'Last change undone.' })
    return previous
  },
}))
