import { beforeEach, describe, expect, it } from 'vitest'
import { modernBarnProject } from '../domain/sampleProject'
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
