import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { isModernBarnPreset } from '../domain/presets'
import { modernBarnProject, sampleProject } from '../domain/sampleProject'
import { ZIELONKI_PROJECT_REF, createTerrainProject } from '../domain/terrain'
import { saveWorkspace } from '../services/persistence'
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
    expect(useStudioStore.getState().savedWorkspaces.map((item) => item.ref)).toEqual([terrain.ref])
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
