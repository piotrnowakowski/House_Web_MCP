import type { WorkspaceSummary } from './persistence'
import { REAR_CARPORT_STUDY_REF } from './publishedRearCarport'

export interface WorkspaceGroup {
  ref: string
  name: string
  current?: WorkspaceSummary
  versions: WorkspaceSummary[]
  hasConflict: boolean
}

/** Recovery refs encode ancestry. Names, dates and revision numbers do not identify a project. */
export function workspaceProjectRef(ref: string): string {
  return ref.split(/\/(?:before-[^/]+|published-\d[^/]*)(?=\/|$)/)[0]
}

/** Group existing records for display without modifying, merging or promoting any saved version. */
export function groupWorkspaces(workspaces: WorkspaceSummary[]): WorkspaceGroup[] {
  const groups = new Map<string, WorkspaceGroup>()
  for (const workspace of workspaces) {
    const ref = workspaceProjectRef(workspace.ref)
    let group = groups.get(ref)
    if (!group) {
      group = { ref, name: workspace.name.replace(/ · (before published update|published version).*$/, ''), versions: [], hasConflict: false }
      groups.set(ref, group)
    }
    if (workspace.ref === ref) {
      group.current = workspace
      group.name = workspace.name
    } else {
      group.versions.push(workspace)
      if (/\/published-\d/.test(workspace.ref)) group.hasConflict = true
    }
  }
  for (const group of groups.values()) {
    group.versions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.ref.localeCompare(a.ref))
  }
  // Keep the added third design after the two existing projects, including when a copy has a newer date.
  return [...groups.values()].sort((a, b) => Number(a.ref === REAR_CARPORT_STUDY_REF) - Number(b.ref === REAR_CARPORT_STUDY_REF))
}

export function workspaceVersionKind(ref: string): string {
  if (/\/published-\d/.test(ref)) return 'Wersja opublikowana · konflikt'
  if (ref.includes('/before-published-')) return 'Kopia przed aktualizacją'
  return 'Zapisana wersja'
}
