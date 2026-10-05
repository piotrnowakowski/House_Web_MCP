import { z } from 'zod'
import { ProjectSchema } from './schema'
import { validateProject } from './commands'
import { mergeJson, mergeProjects, type Json } from './projectMerge'
import type { PersistedWorkspace } from './types'

const command = z.object({ type: z.string().min(1) }).passthrough()
const audit = z.object({ ref: z.string().min(1), label: z.string(), baseRevision: z.number().int(), createdAt: z.string(), commands: z.array(command) }).passthrough()
const envelope = z.object({
  version: z.literal(1), project: ProjectSchema,
  proposals: z.array(audit.extend({ project: ProjectSchema, status: z.enum(['pending', 'approved', 'rejected', 'stale']), issues: z.array(z.unknown()), metrics: z.object({}).passthrough() }).passthrough()),
  draftChangeSets: z.array(audit.extend({ status: z.enum(['draft', 'stale']) }).passthrough()),
}).strict()
export function validateWorkspace(value: unknown): PersistedWorkspace {
  envelope.parse(value)
  const workspace = value as PersistedWorkspace
  for (const records of [workspace.proposals, workspace.draftChangeSets]) {
    if (new Set(records.map(item => item.ref)).size !== records.length) throw new Error('Duplicate audit references')
  }
  const errors = validateProject(workspace.project).filter(issue => issue.severity === 'error')
  if (errors.length) throw new Error(errors[0].message)
  return structuredClone(workspace)
}
export const stableJson = (value: unknown): string => {
  if (value === undefined) return 'null'
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(',')}}`
  return JSON.stringify(value)
}
export const sameWorkspace = (a: PersistedWorkspace, b: PersistedWorkspace) => stableJson(a) === stableJson(b)
export function staleWorkspace(workspace: PersistedWorkspace): PersistedWorkspace {
  return { ...workspace, proposals: workspace.proposals.map(item => item.status === 'pending' ? { ...item, status: 'stale' } : item), draftChangeSets: workspace.draftChangeSets.map(item => ({ ...item, status: 'stale' })) }
}
export function mergeWorkspaces(base: PersistedWorkspace, local: PersistedWorkspace, remote: PersistedWorkspace) {
  if (base.project.ref !== local.project.ref || local.project.ref !== remote.project.ref) throw new Error('Workspace identities must match')
  const project = mergeProjects(base.project, local.project, remote.project)
  const proposals = mergeJson(base.proposals as unknown as Json, local.proposals as unknown as Json, remote.proposals as unknown as Json)
  const drafts = mergeJson(base.draftChangeSets as unknown as Json, local.draftChangeSets as unknown as Json, remote.draftChangeSets as unknown as Json)
  const workspace = staleWorkspace({ version: 1, project: project.project, proposals: proposals.value as unknown as PersistedWorkspace['proposals'], draftChangeSets: drafts.value as unknown as PersistedWorkspace['draftChangeSets'] })
  return { workspace, conflicts: [...project.conflicts, ...proposals.conflicts.map(p => `/proposals${p}`), ...drafts.conflicts.map(p => `/draftChangeSets${p}`)] }
}
export interface SharedVersion { serverVersion: number; workspace: PersistedWorkspace }
export interface SyncWrite { expectedVersion: number; mutationId: string; workspace: PersistedWorkspace }
export interface SyncRecord { base?: SharedVersion; pending?: SyncWrite }
