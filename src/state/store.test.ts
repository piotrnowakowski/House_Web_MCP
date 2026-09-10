import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { isModernBarnPreset } from '../domain/presets'
import { modernBarnProject, sampleProject } from '../domain/sampleProject'
import { ZIELONKI_PROJECT_REF, createTerrainProject } from '../domain/terrain'
import { listWorkspaces, loadWorkspace, saveWorkspace } from '../services/persistence'
import { REAR_CARPORT_STUDY_REF } from '../services/publishedRearCarport'
import { useStudioStore } from './store'

beforeEach(() => useStudioStore.setState({ project: structuredClone(modernBarnProject), variants: [], history: [], month: 7, sunTime: { month: 7, day: 15, hour: 14 }, sunAnimation: 'none', sunOverlay: { enabled: false, targetRef: null, result: null } }))

describe('sun time state', () => {
  it('keeps month in sync when the sun time changes', () => {
    useStudioStore.getState().setSunTime({ month: 3, day: 21, hour: 15.25 })
    expect(useStudioStore.getState().sunTime).toEqual({ month: 3, day: 21, hour: 15.25 })
    expect(useStudioStore.getState().month).toBe(3)
  })

  it('moves the sun to the middle of the month when only the month changes', () => {
    useStudioStore.getState().setMonth(9)
    expect(useStudioStore.getState().sunTime).toEqual({ month: 9, day: 15, hour: 14 })
    expect(useStudioStore.getState().month).toBe(9)
  })

  it('accepts partial sun time updates and clamps the day to the month', () => {
    useStudioStore.getState().setSunTime({ hour: 6.5 })
    expect(useStudioStore.getState().sunTime).toEqual({ month: 7, day: 15, hour: 6.5 })
    useStudioStore.getState().setSunTime({ month: 2, day: 31 })
    expect(useStudioStore.getState().sunTime.day).toBe(28)
  })

  it('toggles the sun-hours overlay and clears its result on project replacement', () => {
    useStudioStore.getState().setSunOverlay({ enabled: true, targetRef: 'zone/lawn' })
    expect(useStudioStore.getState().sunOverlay).toMatchObject({ enabled: true, targetRef: 'zone/lawn' })
    useStudioStore.getState().replaceProject(structuredClone(modernBarnProject))
    expect(useStudioStore.getState().sunOverlay.result).toBeNull()
  })
})

describe('start screen and project switching', () => {
  it('retains the active name through proposals, undo and redo and saves unsaved geometry', async () => {
    globalThis.indexedDB = new IDBFactory()
    useStudioStore.setState({ project: structuredClone(sampleProject), hydrated: true, proposals: [], draftChangeSets: [], future: [] })
    const proposal = useStudioStore.getState().createVariant('Move hydrangea', [{ type: 'plant.update', action: 'move', plantRef: 'plant/hydrangea', position: { x: -7.5, z: 9 } }])
    const before = structuredClone(useStudioStore.getState().project)
    await useStudioStore.getState().renameWorkspace(before.ref, '  Z wiatą z przodu  ')
    expect((await loadWorkspace(before.ref))?.project).toEqual({ ...before, name: 'Z wiatą z przodu' })
    expect(useStudioStore.getState().proposals[0].project.name).toBe(before.name)
    expect(useStudioStore.getState().applyVariant(proposal.ref).name).toBe('Z wiatą z przodu')
    expect(useStudioStore.getState().undo().name).toBe('Z wiatą z przodu')
    expect(useStudioStore.getState().redo().name).toBe('Z wiatą z przodu')
    await useStudioStore.getState().renameWorkspace(before.ref, 'Własna nazwa')
    expect((await loadWorkspace(before.ref))?.project.landscape).toEqual(useStudioStore.getState().project.landscape)
  })

  it('renames an unopened version without replacing the active working copy', async () => {
    globalThis.indexedDB = new IDBFactory()
    const saved = { ...structuredClone(sampleProject), ref: 'project/saved-copy' }
    await saveWorkspace({ version: 1, project: saved, proposals: [], draftChangeSets: [] })
    useStudioStore.setState({ hydrated: true, savedWorkspaces: await listWorkspaces() })
    const active = useStudioStore.getState().project
    await useStudioStore.getState().renameWorkspace(saved.ref, 'Bez garażu')
    expect(useStudioStore.getState().project).toBe(active)
    expect(useStudioStore.getState().savedWorkspaces[0].name).toBe('Bez garażu')
    expect((await loadWorkspace(saved.ref))?.project.name).toBe('Bez garażu')
  })

  it('refreshes cached warnings on pending proposals when reopening a workspace', () => {
    const project = structuredClone(modernBarnProject)
    const proposal = useStudioStore.getState().createVariant('Sedge adjustment', [{ type: 'plant.update', action: 'move', plantRef: 'plant/sedge', position: { x: -7, z: 9 } }])
    const expectedIssues = structuredClone(proposal.issues)
    const cached = structuredClone(useStudioStore.getState().proposals.find((item) => item.ref === proposal.ref)!)
    cached.issues.push({ severity: 'warning', code: 'planting.sun-mismatch', subjectRef: 'plant/apple', message: 'Obsolete mapped-tree sunlight warning' })
    useStudioStore.getState().restoreWorkspace({ version: 1, project, proposals: [cached], draftChangeSets: [] })
    const restored = useStudioStore.getState().variants[0]
    expect(restored.issues).toEqual(expectedIssues)
    expect(restored.issues.some((issue) => issue.code === 'site.geotechnical-review')).toBe(true)
    expect(restored.project).toEqual(proposal.project)
    expect(restored.commands).toEqual(proposal.commands)
    expect(useStudioStore.getState().proposals[0].issues).toEqual(expectedIssues)
  })

  it('migrates saved tree heights and prevents an older proposal from restoring the old dimensions', async () => {
    globalThis.indexedDB = new IDBFactory()
    const legacy = structuredClone(modernBarnProject)
    legacy.landscape.orchardCatalogVersion = 2
    const apple = legacy.landscape.plants.find((plant) => plant.ref === 'plant/apple')!
    apple.matureHeightM = 5.5
    apple.position = { x: -14, z: 12 }
    useStudioStore.getState().replaceProject(legacy)
    const proposal = useStudioStore.getState().createVariant('Old planting proposal', [{ type: 'plant.update', action: 'move', plantRef: 'plant/hydrangea', position: { x: -7, z: 9 } }])
    const proposals = structuredClone(useStudioStore.getState().proposals)
    await saveWorkspace({ version: 1, project: legacy, proposals, draftChangeSets: [] })
    await useStudioStore.getState().openWorkspace(legacy.ref)
    const state = useStudioStore.getState()
    expect(state.project.landscape.plants.find((plant) => plant.ref === apple.ref)).toMatchObject({ ref: apple.ref, matureHeightM: 15, surveyHandle: '50F5' })
    expect(state.project.landscape.plants.find((plant) => plant.ref === apple.ref)!.position).toEqual(modernBarnProject.landscape.plants.find((plant) => plant.ref === apple.ref)!.position)
    expect(state.project.revision).toBe(legacy.revision + 1)
    expect(state.proposals.find((item) => item.ref === proposal.ref)!.status).toBe('stale')
    expect(state.variants).toEqual([])
    await saveWorkspace({ version: 1, project: state.project, proposals: state.proposals, draftChangeSets: [] })
    await useStudioStore.getState().openWorkspace(legacy.ref)
    expect(useStudioStore.getState().project).toEqual(state.project)
  })
  it('opens on the launcher without a hydrated project and starts a new terrain from valid input', () => {
    useStudioStore.setState({ launcherOpen: true, hydrated: false })
    expect(useStudioStore.getState().launcherOpen).toBe(true)
    useStudioStore.getState().startTerrain({ name: 'Test plot', widthM: 30, depthM: 40, northDegrees: 10, latitude: 52.23, longitude: 21.01, timezone: 'Europe/Warsaw' })
    const state = useStudioStore.getState()
    expect(state.project.name).toBe('Test plot')
    expect(state.project.buildings).toEqual([])
    expect(state.project.site.northDegrees).toBe(10)
    expect(state.launcherOpen).toBe(false)
    expect(state.hydrated).toBe(true)
    expect(state.history).toEqual([])
    expect(state.toast).toMatch(/Test plot/)
  })

  it('refuses an impossible terrain and keeps the launcher open', () => {
    useStudioStore.setState({ launcherOpen: true, hydrated: false })
    expect(() => useStudioStore.getState().startTerrain({ name: 'Tiny', widthM: 1, depthM: 40, northDegrees: 0, latitude: 0, longitude: 0, timezone: 'UTC' })).toThrow(/Width/)
    expect(useStudioStore.getState().launcherOpen).toBe(true)
    expect(useStudioStore.getState().hydrated).toBe(false)
  })

  it('loads the bundled Zielonki study fresh with its starter garden', () => {
    useStudioStore.setState({ launcherOpen: true, hydrated: false, project: structuredClone(sampleProject) })
    useStudioStore.getState().loadBundledStudy()
    const state = useStudioStore.getState()
    expect(state.project.ref).toBe(ZIELONKI_PROJECT_REF)
    expect(isModernBarnPreset(state.project)).toBe(true)
    expect(state.project.landscape.fixtures.length).toBeGreaterThan(0)
    expect(state.launcherOpen).toBe(false)
    expect(state.hydrated).toBe(true)
  })

  it('reopens a saved project by ref and lists saved projects when the launcher opens', async () => {
    globalThis.indexedDB = new IDBFactory()
    const terrain = createTerrainProject({ name: 'Saved plot', widthM: 20, depthM: 20, northDegrees: 0, latitude: 50, longitude: 20, timezone: 'Europe/Warsaw' }, new Date('2026-09-04T10:00:00.000Z'))
    await saveWorkspace({ version: 1, project: terrain, proposals: [], draftChangeSets: [] })
    useStudioStore.setState({ launcherOpen: false, hydrated: true, project: structuredClone(modernBarnProject) })
    await useStudioStore.getState().openLauncher()
    expect(useStudioStore.getState().launcherOpen).toBe(true)
    expect(useStudioStore.getState().savedWorkspaces.map((item) => item.ref).sort()).toEqual([terrain.ref, REAR_CARPORT_STUDY_REF].sort())
    await useStudioStore.getState().openWorkspace(terrain.ref)
    expect(useStudioStore.getState().project.name).toBe('Saved plot')
    expect(useStudioStore.getState().launcherOpen).toBe(false)
    await useStudioStore.getState().openWorkspace('project/missing')
    expect(useStudioStore.getState().project.name).toBe('Saved plot')
    expect(useStudioStore.getState().toast).toMatch(/not found/i)
  })

  it('refocuses on the site when there is no building', () => {
    useStudioStore.getState().startTerrain({ name: 'Empty', widthM: 30, depthM: 30, northDegrees: 0, latitude: 0, longitude: 0, timezone: 'UTC' })
    useStudioStore.getState().refocusCamera()
    expect(useStudioStore.getState().toast).toMatch(/site/)
  })
})
