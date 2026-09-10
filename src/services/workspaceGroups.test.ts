import { describe, expect, it } from 'vitest'
import type { WorkspaceSummary } from './persistence'
import { groupWorkspaces } from './workspaceGroups'

const entry = (ref: string, name = 'Dom', revision = 45): WorkspaceSummary => ({ ref, name, revision, updatedAt: '2026-09-10T10:00:00Z', proposalCount: 0, boundary: [] })

describe('project and version hierarchy', () => {
  it('groups nested recovery copies by ancestry and uses the actual current record even at a lower revision', () => {
    const current = entry('project/zielonki-v2', 'Z wiatą z przodu', 45)
    const backup = entry('project/zielonki-v2/before-published-62-20260910', 'Old name', 61)
    const nested = entry(`${backup.ref}/before-interior-123`, 'Nested copy', 62)
    const conflict = entry('project/zielonki-v2/published-63-20260910', 'Incoming name', 63)
    const original = entry('project/zielonki-spatial-v2', 'Z garażem', 46)
    const records = [backup, nested, conflict, original, current]
    const before = structuredClone(records)
    const groups = groupWorkspaces(records)
    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ ref: current.ref, name: current.name, current, hasConflict: true })
    expect(groups[0].versions.map((item) => item.ref).sort()).toEqual([backup.ref, nested.ref, conflict.ref].sort())
    expect(groups[1]).toMatchObject({ ref: original.ref, current: original, versions: [] })
    expect(records).toEqual(before)
  })

  it('keeps projects with the same name distinct and does not promote an orphan backup to current', () => {
    const groups = groupWorkspaces([
      entry('project/one'), entry('project/two'),
      entry('project/deleted/before-pergola-r45', 'Dom · przed pergolą'),
      entry('project/one/custom-copy'),
    ])
    expect(groups).toHaveLength(4)
    expect(groups.find((item) => item.ref === 'project/deleted')).toMatchObject({ versions: [expect.objectContaining({ revision: 45 })] })
    expect(groups.find((item) => item.ref === 'project/deleted')?.current).toBeUndefined()
    expect(groups.find((item) => item.ref === 'project/one')?.versions).toEqual([])
  })
})
