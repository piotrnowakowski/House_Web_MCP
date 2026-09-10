import { parseProject } from '../domain/schema'
import { calculateMetrics, validateProject } from '../domain/commands'
import { isZielonkiProject } from '../domain/terrain'
import { mergeProjects, sameProject } from '../domain/projectMerge'
import type { PersistedWorkspace, Polygon2, ProjectV2, ProposalRecord } from '../domain/types'
import { zielonkiKnowledgeBase, zielonkiPlot } from '../../knowledge-bank/zielonki/data'

const DB_NAME = 'house-web-mcp'
const STORE_NAME = 'projects'
const DB_VERSION = 2
/** Key of the single autosave written before projects were stored per ref; migrated on first read. */
export const LEGACY_WORKSPACE_KEY = 'zielonki-spatial-editor-balanced-facades-v2'
const ACTIVE_POINTER_KEY = 'active'
const WORKSPACE_PREFIX = 'workspace/'
const workspaceKey = (ref: string) => `${WORKSPACE_PREFIX}${ref}`

export interface WorkspaceSummary { ref: string; name: string; revision: number; updatedAt: string; proposalCount: number; boundary: Polygon2 }

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION)
  request.onupgradeneeded = () => {
    const database = request.result
    if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME)
  }
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

const withStore = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | IDBRequest<T>[]) => {
  const database = await openDatabase()
  try {
    return await new Promise<T[]>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode)
      const requests = run(transaction.objectStore(STORE_NAME))
      const list = Array.isArray(requests) ? requests : [requests]
      transaction.oncomplete = () => resolve(list.map((request) => request.result))
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  } finally { database.close() }
}
const getRecord = async (key: string) => (await withStore<unknown>('readonly', (store) => store.get(key)))[0]
const putRecords = (entries: Array<[string, unknown]>) => withStore<IDBValidKey>('readwrite', (store) => entries.map(([key, value]) => store.put(value, key)))
const deleteRecords = (keys: string[]) => withStore<undefined>('readwrite', (store) => keys.map((key) => store.delete(key)))
const allEntries = async () => {
  const [keys, values] = await withStore<unknown>('readonly', (store) => [store.getAllKeys() as unknown as IDBRequest<unknown>, store.getAll() as unknown as IDBRequest<unknown>])
  return (keys as IDBValidKey[]).map((key, index) => [String(key), (values as unknown[])[index]] as const)
}

const refreshZielonkiKnowledge = (project: ProjectV2) => {
  const usesZielonkiLand = isZielonkiProject(project) || (project.site.knowledgeBase.cadastralDistrict === '120617_2.0018 Zielonki' && ['54/3', '55/3', '58/3'].every((number) => project.site.parcels.some((parcel) => parcel.cadastralNumber === number)))
  if (usesZielonkiLand && project.site.knowledgeBase.datasetVersion !== zielonkiKnowledgeBase.datasetVersion) {
    if (project.site.knowledgeBase.datasetVersion !== 'zielonki-knowledge-bank-2026-09-03-outline-v4') {
      project.site.boundary = structuredClone(zielonkiPlot.boundary)
      project.site.terrain.boundary = structuredClone(zielonkiPlot.boundary)
      project.site.parcels = structuredClone(zielonkiPlot.parcels)
      project.site.entrances = structuredClone(zielonkiPlot.entrances)
    } else {
      project.site.parcels = project.site.parcels.map((parcel) => {
        const current = zielonkiPlot.parcels.find((item) => item.cadastralNumber === parcel.cadastralNumber)
        return current ? { ...parcel, landRole: current.landRole, landUseZones: structuredClone(current.landUseZones) } : parcel
      })
    }
    project.site.knowledgeBase = structuredClone(zielonkiKnowledgeBase)
  }
  return project
}

/** Accepts a version-1 workspace envelope or a bare project record and returns a validated workspace. */
const toWorkspace = (value: unknown): PersistedWorkspace => {
  const candidate = value as Partial<PersistedWorkspace>
  if (candidate.version === 1 && candidate.project) {
    const project = refreshZielonkiKnowledge(parseProject(candidate.project))
    const proposals = Array.isArray(candidate.proposals) ? candidate.proposals.map((proposal) => {
      const parsed = parseProject((proposal as ProposalRecord).project)
      const previousVersion = parsed.site.knowledgeBase.datasetVersion
      const refreshed = refreshZielonkiKnowledge(parsed)
      return { ...proposal, project: refreshed, ...(previousVersion !== refreshed.site.knowledgeBase.datasetVersion ? { issues: validateProject(refreshed), metrics: calculateMetrics(refreshed) } : {}) }
    }) as ProposalRecord[] : []
    return { version: 1, project, proposals, draftChangeSets: Array.isArray(candidate.draftChangeSets) ? candidate.draftChangeSets : [] }
  }
  return { version: 1, project: refreshZielonkiKnowledge(parseProject(value)), proposals: [], draftChangeSets: [] }
}

const knowledgeChanged = (value: unknown, workspace: PersistedWorkspace) => {
  const stored = value as Partial<PersistedWorkspace> & Partial<ProjectV2>
  return (stored.project ?? stored).site?.knowledgeBase?.datasetVersion !== workspace.project.site.knowledgeBase.datasetVersion ||
    workspace.proposals.some((proposal, index) => stored.proposals?.[index]?.project.site.knowledgeBase.datasetVersion !== proposal.project.site.knowledgeBase.datasetVersion)
}

/** Moves the pre-multi-project autosave under its project ref; safe to call on every read. */
const migrateLegacyRecord = async () => {
  const legacy = await getRecord(LEGACY_WORKSPACE_KEY)
  if (legacy === undefined) return
  const workspace = toWorkspace(legacy)
  const active = await getRecord(ACTIVE_POINTER_KEY)
  await putRecords([[workspaceKey(workspace.project.ref), workspace], ...(active === undefined ? [[ACTIVE_POINTER_KEY, workspace.project.ref] as [string, unknown]] : [])])
  await deleteRecords([LEGACY_WORKSPACE_KEY])
}

/** Saves the workspace under its project ref and marks that project as the one to continue. */
export const saveWorkspace = async (workspace: PersistedWorkspace) => { await putRecords([[workspaceKey(workspace.project.ref), workspace], [ACTIVE_POINTER_KEY, workspace.project.ref]]) }

export const normalizeWorkspaceName = (value: string) => {
  const name = value.trim()
  if (!name) throw new Error('Wpisz nazwę wersji.')
  if (name.length > 120) throw new Error('Nazwa może mieć maksymalnie 120 znaków.')
  return name
}

/** Rename only the saved project's metadata, preserving its contents, audit history and active pointer. */
export const renameWorkspace = async (ref: string, value: string) => {
  const name = normalizeWorkspaceName(value)
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(workspaceKey(ref))
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error ?? new Error('Nie udało się zapisać nazwy.'))
      request.onsuccess = () => {
        if (!request.result) {
          transaction.abort()
          reject(new Error('Nie znaleziono zapisanej wersji.'))
          return
        }
        const workspace = request.result as PersistedWorkspace
        store.put({ ...workspace, project: { ...workspace.project, name } }, workspaceKey(ref))
      }
    })
  } finally { database.close() }
}

/** Loads one saved workspace by project ref, or the last active one when no ref is given; null when nothing matches. */
export const loadWorkspace = async (ref?: string): Promise<PersistedWorkspace | null> => {
  await migrateLegacyRecord()
  const target = ref ?? (await getRecord(ACTIVE_POINTER_KEY) as string | undefined)
  if (!target) return null
  const value = await getRecord(workspaceKey(target))
  if (value === undefined) return null
  const workspace = toWorkspace(value)
  if (knowledgeChanged(value, workspace)) await putRecords([[workspaceKey(target), workspace]])
  return workspace
}

/** Every saved project, newest first, with just enough to draw a card. */
export const listWorkspaces = async (): Promise<WorkspaceSummary[]> => {
  await migrateLegacyRecord()
  const summaries: WorkspaceSummary[] = []
  const refreshed: Array<[string, unknown]> = []
  for (const [key, value] of await allEntries()) {
    if (!key.startsWith(WORKSPACE_PREFIX)) continue
    try {
      const workspace = toWorkspace(value)
      if (knowledgeChanged(value, workspace)) refreshed.push([key, workspace])
      summaries.push({ ref: workspace.project.ref, name: workspace.project.name, revision: workspace.project.revision, updatedAt: workspace.project.updatedAt, proposalCount: workspace.proposals.length, boundary: workspace.project.site.boundary })
    } catch { /* an unreadable record is skipped rather than blocking the start screen */ }
  }
  if (refreshed.length) await putRecords(refreshed)
  return summaries.sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))
}

/** Removes a saved project; when it was the active one, nothing is active until the next save. */
export const deleteWorkspace = async (ref: string) => {
  const active = await getRecord(ACTIVE_POINTER_KEY)
  await deleteRecords([workspaceKey(ref), ...(active === ref ? [ACTIVE_POINTER_KEY] : [])])
}

export const saveProject = (project: ProjectV2) => saveWorkspace({ version: 1, project, proposals: [], draftChangeSets: [] })
export const loadProject = async (ref?: string): Promise<ProjectV2 | null> => (await loadWorkspace(ref))?.project ?? null

/** Atomically merge a published snapshot into its browser working copy, preserving backups and conflicts. */
export const synchronizePublishedProject = async (published: ProjectV2, legacyBase: ProjectV2): Promise<string[]> => {
  const publishedErrors = validateProject(published).filter((issue) => issue.severity === 'error')
  if (publishedErrors.length) throw new Error(`Invalid published project: ${publishedErrors[0].message}`)
  if (published.ref !== legacyBase.ref) throw new Error('Published project and legacy baseline refs must match.')
  await migrateLegacyRecord()
  const database = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const currentKey = workspaceKey(published.ref)
      const baseKey = `published-base/${published.ref}`
      const snapshotId = `${published.revision}-${published.updatedAt.replace(/\D/g, '')}`
      const copyRef = `${published.ref}/published-${snapshotId}`
      const requests = [currentKey, baseKey, workspaceKey(copyRef)].map((key) => store.get(key))
      let remaining = requests.length
      let conflicts: string[] = []
      tx.oncomplete = () => resolve(conflicts)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error ?? new Error('Published project update was cancelled.'))
      for (const request of requests) request.onsuccess = () => {
        if (--remaining) return
        try {
          const current = requests[0].result === undefined ? null : toWorkspace(requests[0].result)
          const base = requests[1].result ? parseProject(requests[1].result) : legacyBase
          if (requests[1].result && sameProject(base, published)) return
          const incoming: PersistedWorkspace = { version: 1, project: structuredClone(published), proposals: [], draftChangeSets: [] }
          if (!current) {
            store.put(incoming, currentKey)
            store.put(published, baseKey)
            return
          }
          const result = mergeProjects(base, current.project, published)
          conflicts = result.conflicts
          if (!conflicts.length) conflicts = validateProject(result.project).filter((issue) => issue.severity === 'error').map((issue) => issue.message)
          if (conflicts.length) {
            // Keep both complete versions. A previous published copy may already contain user edits.
            if (requests[2].result === undefined) {
              incoming.project.ref = copyRef
              incoming.project.name += ' · published version'
              store.put(incoming, workspaceKey(copyRef))
            }
            return
          }
          if (result.changed) {
            const backup = structuredClone(current)
            backup.project.ref += `/before-published-${snapshotId}`
            backup.project.name += ' · before published update'
            store.put(backup, workspaceKey(backup.project.ref))
            store.put({ ...current, project: result.project,
              proposals: current.proposals.map((item) => item.status === 'pending' ? { ...item, status: 'stale' } : item),
              draftChangeSets: current.draftChangeSets.map((item) => ({ ...item, status: 'stale' })),
            }, currentKey)
          }
          store.put(published, baseKey)
        } catch (error) { tx.abort(); reject(error) }
      }
    })
  } finally { database.close() }
}
