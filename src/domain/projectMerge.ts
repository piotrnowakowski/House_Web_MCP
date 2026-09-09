import type { ProjectV2 } from './types'

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
const equal = (a: Json | undefined, b: Json | undefined): boolean => {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((key) => equal((a as Record<string, Json>)[key], (b as Record<string, Json>)[key]))
}

/** Three-way merge by entity ref. Missing entities are deletions; conflicts retain the local value. */
export function mergeProjects(base: ProjectV2, local: ProjectV2, incoming: ProjectV2) {
  const conflicts: string[] = []
  const merge = (before: Json | undefined, ours: Json | undefined, theirs: Json | undefined, path: string): Json | undefined => {
    if (equal(ours, theirs) || equal(before, theirs)) return ours
    if (equal(before, ours)) return theirs
    if (before && ours && theirs && typeof before === 'object' && typeof ours === 'object' && typeof theirs === 'object') {
      if (Array.isArray(before) && Array.isArray(ours) && Array.isArray(theirs)) {
        const lists = [before, ours, theirs]
        const entities = lists.every((items) => items.every((item) => item && !Array.isArray(item) && typeof item === 'object' && typeof item.ref === 'string')
          && new Set(items.map((item) => (item as { ref: string }).ref)).size === items.length)
        if (entities) {
          const maps = lists.map((items) => Object.fromEntries(items.map((item) => [(item as { ref: string }).ref, item])))
          const refs = new Set([...Object.keys(maps[1]), ...Object.keys(maps[2]), ...Object.keys(maps[0])])
          return [...refs].flatMap((ref) => {
            const value = merge(maps[0][ref], maps[1][ref], maps[2][ref], `${path}/${ref}`)
            return value === undefined ? [] : [value]
          })
        }
      } else if (!Array.isArray(before) && !Array.isArray(ours) && !Array.isArray(theirs)) {
        const result: Record<string, Json> = {}
        for (const key of new Set([...Object.keys(before), ...Object.keys(ours), ...Object.keys(theirs)])) {
          const value = merge(before[key], ours[key], theirs[key], `${path}/${key}`)
          if (value !== undefined) result[key] = value
        }
        return result
      }
    }
    conflicts.push(path)
    return ours
  }
  // Revision counters and timestamps describe snapshots; they cannot resolve design conflicts.
  const content = (project: ProjectV2) => ({ ...project, revision: 0, updatedAt: '' }) as unknown as Json
  const project = structuredClone(merge(content(base), content(local), content(incoming), '') as unknown as ProjectV2)
  const changed = !equal(content(project), content(local))
  project.revision = changed ? Math.max(local.revision, incoming.revision) + 1 : local.revision
  project.updatedAt = changed ? new Date().toISOString() : local.updatedAt
  return { project, conflicts, changed }
}

export const sameProject = (a: ProjectV2, b: ProjectV2) => equal(a as unknown as Json, b as unknown as Json)
