import { beforeEach, expect, it } from 'vitest'
import { modernBarnProject } from '../domain/sampleProject'
import { useStudioStore } from './store'

beforeEach(() => useStudioStore.getState().replaceProject(structuredClone(modernBarnProject)))

it('keeps fading out of project data and history and exits conflicting tools', () => {
  const project = useStudioStore.getState().project
  const history = useStudioStore.getState().history
  useStudioStore.getState().beginReposition('wall/example')
  useStudioStore.getState().setTransparencyMode(true)
  useStudioStore.getState().makeTransparent('roof/example')
  useStudioStore.getState().makeTransparent('wall/example')
  useStudioStore.getState().makeTransparent('wall/example')
  expect(useStudioStore.getState()).toMatchObject({ transparencyMode: true, transparentRefs: ['roof/example', 'wall/example'], repositioningRef: null })
  expect(useStudioStore.getState().project).toBe(project)
  expect(useStudioStore.getState().history).toBe(history)
  useStudioStore.getState().setViewerMode('measure-length')
  expect(useStudioStore.getState().transparencyMode).toBe(false)
  expect(useStudioStore.getState().transparentRefs).toHaveLength(2)
  useStudioStore.getState().resetTransparency()
  expect(useStudioStore.getState().transparentRefs).toEqual([])
})

it('clears temporary visibility when replacing or restoring a project', () => {
  useStudioStore.getState().makeTransparent('wall/example')
  useStudioStore.getState().replaceProject(structuredClone(modernBarnProject))
  expect(useStudioStore.getState().transparentRefs).toEqual([])
  useStudioStore.getState().setTransparencyMode(true)
  useStudioStore.getState().makeTransparent('wall/example')
  useStudioStore.getState().restoreWorkspace({ version: 1, project: structuredClone(modernBarnProject), proposals: [], draftChangeSets: [] })
  expect(useStudioStore.getState()).toMatchObject({ transparencyMode: false, transparentRefs: [] })
})
