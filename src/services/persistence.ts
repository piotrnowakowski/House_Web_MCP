import { parseProject } from '../domain/schema'
import { isZielonkiProject } from '../domain/terrain'
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
  if (isZielonkiProject(project) && project.site.knowledgeBase.datasetVersion !== zielonkiKnowledgeBase.datasetVersion) {
    project.site.boundary = structuredClone(zielonkiPlot.boundary)
    project.site.terrain.boundary = structuredClone(zielonkiPlot.boundary)
    project.site.parcels = structuredClone(zielonkiPlot.parcels)
    project.site.entrances = structuredClone(zielonkiPlot.entrances)
    project.site.knowledgeBase = structuredClone(zielonkiKnowledgeBase)
  }
  return project
}

/** Accepts a version-1 workspace envelope or a bare project record and returns a validated workspace. */
const toWorkspace = (value: unknown): PersistedWorkspace => {
  const candidate = value as Partial<PersistedWorkspace>
  if (candidate.version === 1 && candidate.project) {
    const project = refreshZielonkiKnowledge(parseProject(candidate.project))
    const proposals = Array.isArray(candidate.proposals) ? candidate.proposals.map((proposal) => ({ ...proposal, project: parseProject((proposal as ProposalRecord).project) })) as ProposalRecord[] : []
    return { version: 1, project, proposals, draftChangeSets: Array.isArray(candidate.draftChangeSets) ? candidate.draftChangeSets : [] }
  }
  return { version: 1, project: refreshZielonkiKnowledge(parseProject(value)), proposals: [], draftChangeSets: [] }
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

/** Loads one saved workspace by project ref, or the last active one when no ref is given; null when nothing matches. */
export const loadWorkspace = async (ref?: string): Promise<PersistedWorkspace | null> => {
  await migrateLegacyRecord()
  const target = ref ?? (await getRecord(ACTIVE_POINTER_KEY) as string | undefined)
  if (!target) return null
  const value = await getRecord(workspaceKey(target))
  if (value === undefined) return null
  return toWorkspace(value)
}

/** Every saved project, newest first, with just enough to draw a card. */
export const listWorkspaces = async (): Promise<WorkspaceSummary[]> => {
  await migrateLegacyRecord()
  const summaries: WorkspaceSummary[] = []
  for (const [key, value] of await allEntries()) {
    if (!key.startsWith(WORKSPACE_PREFIX)) continue
    try {
      const workspace = toWorkspace(value)
      summaries.push({ ref: workspace.project.ref, name: workspace.project.name, revision: workspace.project.revision, updatedAt: workspace.project.updatedAt, proposalCount: workspace.proposals.length, boundary: workspace.project.site.boundary })
    } catch { /* an unreadable record is skipped rather than blocking the start screen */ }
  }
  return summaries.sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))
}

/** Removes a saved project; when it was the active one, nothing is active until the next save. */
export const deleteWorkspace = async (ref: string) => {
  const active = await getRecord(ACTIVE_POINTER_KEY)
  await deleteRecords([workspaceKey(ref), ...(active === ref ? [ACTIVE_POINTER_KEY] : [])])
}

export const saveProject = (project: ProjectV2) => saveWorkspace({ version: 1, project, proposals: [], draftChangeSets: [] })
export const loadProject = async (ref?: string): Promise<ProjectV2 | null> => (await loadWorkspace(ref))?.project ?? null
