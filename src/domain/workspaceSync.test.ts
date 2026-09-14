import { expect, it } from 'vitest'
import { sampleProject } from './sampleProject'
import { mergeWorkspaces, validateWorkspace } from './workspaceSync'
import type { PersistedWorkspace } from './types'
const base = (): PersistedWorkspace => ({ version: 1, project: structuredClone(sampleProject), proposals: [], draftChangeSets: [] })
it('merges independent fields and deletions by ref, not array position', () => {
  const before = base(), local = base(), remote = base()
  local.project.name = 'Local'; local.project.landscape.plants.pop()
  remote.project.buildings[0].name = 'Remote house'; remote.project.landscape.plants.reverse()
  const result = mergeWorkspaces(before, local, remote)
  expect(result.conflicts).toEqual([])
  expect(result.workspace.project.name).toBe('Local')
  expect(result.workspace.project.buildings[0].name).toBe('Remote house')
  expect(result.workspace.project.landscape.plants).toHaveLength(local.project.landscape.plants.length)
  expect(() => validateWorkspace(result.workspace)).not.toThrow()
})
it('reports edit/delete and same-field conflicts instead of choosing by revision', () => {
  const before = base(), local = base(), remote = base()
  local.project.name = 'A'; remote.project.name = 'B'; remote.project.revision = 999
  local.project.landscape.plants.pop(); remote.project.landscape.plants.at(-1)!.name = 'Edited tree'
  expect(mergeWorkspaces(before, local, remote).conflicts).toHaveLength(2)
})
it('preserves distinct draft records but stales approvals after a merge', () => {
  const before = base(), local = base(), remote = base()
  const draft = { ref: 'draft/local', label: 'Local', baseRevision: 1, createdAt: '', commands: [], status: 'draft' as const }
  local.draftChangeSets.push(draft); remote.draftChangeSets.push({ ...draft, ref: 'draft/remote' })
  const result = mergeWorkspaces(before, local, remote)
  expect(result.conflicts).toEqual([])
  expect(result.workspace.draftChangeSets).toHaveLength(2)
  expect(result.workspace.draftChangeSets.every(d => d.status === 'stale')).toBe(true)
})
