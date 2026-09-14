import { parseProject } from '../domain/schema'
import { calculateMetrics, validateProject } from '../domain/commands'
import { isZielonkiProject } from '../domain/terrain'
import { mergeProjects, sameProject } from '../domain/projectMerge'
import { stableJson } from '../domain/workspaceSync'
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
  request.onblocked = () => reject(new Error('Storage upgrade blocked by another tab. Close older tabs and retry.'))
  request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result) }
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
  await withStore<unknown>('readwrite', store => {
    const legacy = store.get(LEGACY_WORKSPACE_KEY)
    legacy.onsuccess = () => {
      if (legacy.result === undefined) return
      try {
        const workspace = toWorkspace(legacy.result)
        const ref = workspace.project.ref
        const current = store.get(workspaceKey(ref)), tombstone = store.get(`deleted/${ref}`), active = store.get(ACTIVE_POINTER_KEY)
        let remaining = 3
        const ready = () => {
          if (--remaining) return
          if (current.result !== undefined || tombstone.result) store.put(legacy.result, `recovery/legacy/${ref}`)
          else {
            store.put(workspace, workspaceKey(ref))
            if (active.result === undefined) store.put(ref, ACTIVE_POINTER_KEY)
          }
          store.delete(LEGACY_WORKSPACE_KEY)
        }
        current.onsuccess = ready; tombstone.onsuccess = ready; active.onsuccess = ready
      } catch { store.transaction.abort() }
    }
    return legacy
  })
}

/** Saves the workspace under its project ref and marks that project as the one to continue. */
const observedVersions = new Map<string, number>()
const observedContents = new Map<string, string | undefined>()
const storedContent = (value: unknown) => value === undefined ? undefined : stableJson(value)
const deletedRefs = new Set<string>()
const versionKey = (ref: string) => `local-version/${ref}`
export class LocalWriteConflict extends Error { constructor() { super('This workspace changed in another tab. Export your recovery copy, then reload before editing.') } }

interface SaveOptions { activate?: boolean; sync?: unknown; restoreDeleted?: boolean }
const saveWorkspaceImpl = async (workspace: PersistedWorkspace, options: SaveOptions = {}) => {
  const ref = workspace.project.ref
  if (deletedRefs.has(ref) && !options.restoreDeleted) throw new Error('This workspace was removed. Export it before restoring it explicitly.')
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const read = store.get(versionKey(ref))
      const contents = store.get(workspaceKey(ref))
      const tombstone = store.get(`deleted/${ref}`)
      let remaining = 3
      let nextVersion = 0
      tx.oncomplete = () => { if (options.restoreDeleted) deletedRefs.delete(ref); observedVersions.set(ref, nextVersion); observedContents.set(ref, storedContent(workspace)); resolve() }
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error ?? new LocalWriteConflict())
      const ready = () => {
        if (--remaining) return
        try {
        const current = Number(read.result ?? 0)
        const unchanged = storedContent(contents.result) === storedContent(workspace)
        if ((tombstone.result && !options.restoreDeleted) || (!unchanged && (current !== (observedVersions.get(ref) ?? 0) || storedContent(contents.result) !== observedContents.get(ref)))) { tx.abort(); return }
        // Opening an unchanged workspace in another tab must not invalidate its current editor.
        nextVersion = current + (unchanged ? 0 : 1)
        store.put(workspace, workspaceKey(ref))
        store.put(nextVersion, versionKey(ref))
        if (options.activate !== false) store.put(ref, ACTIVE_POINTER_KEY)
        if (options.sync !== undefined) store.put(options.sync, `shared-base/${ref}`)
        if (options.restoreDeleted) store.delete(`deleted/${ref}`)
        } catch (error) { tx.abort(); reject(error) }
      }
      read.onsuccess = ready; contents.onsuccess = ready; tombstone.onsuccess = ready
    })
  } finally { database.close() }
}

export const normalizeWorkspaceName = (value: string) => {
  const name = value.trim()
  if (!name) throw new Error('Wpisz nazwę wersji.')
  if (name.length > 120) throw new Error('Nazwa może mieć maksymalnie 120 znaków.')
  return name
}

/** Rename only the saved project's metadata, preserving its contents, audit history and active pointer. */
const renameWorkspaceImpl = async (ref: string, value: string) => {
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
        const version = store.get(versionKey(ref))
        version.onsuccess = () => store.put(Number(version.result ?? 0) + 1, versionKey(ref))
      }
    })
  } finally { database.close() }
}

/** Loads one saved workspace by project ref, or the last active one when no ref is given; null when nothing matches. */
const loadWorkspaceImpl = async (ref?: string): Promise<PersistedWorkspace | null> => {
  await migrateLegacyRecord()
  const target = ref ?? (await getRecord(ACTIVE_POINTER_KEY) as string | undefined)
  if (!target) return null
  const [value, version] = await withStore<unknown>('readonly', (store) => [store.get(workspaceKey(target)), store.get(versionKey(target))])
  observedVersions.set(target, Number(version ?? 0))
  observedContents.set(target, storedContent(value))
  if (value === undefined) return null
  const workspace = toWorkspace(value)
  if (knowledgeChanged(value, workspace)) await saveWorkspaceImpl(workspace, { activate: false })
  return workspace
}

/** Every saved project, newest first, with just enough to draw a card. */
const listWorkspacesImpl = async (): Promise<WorkspaceSummary[]> => {
  await migrateLegacyRecord()
  const summaries: WorkspaceSummary[] = []
  const entries = await allEntries()
  const entriesMap = new Map(entries)
  for (const [key, value] of entries) {
    if (!key.startsWith(WORKSPACE_PREFIX)) continue
    try {
      const workspace = toWorkspace(value)
      if (knowledgeChanged(value, workspace)) {
        // CAS the exact listing snapshot; never overwrite a concurrently edited workspace.
        const ref = workspace.project.ref
        const priorVersion = observedVersions.get(ref), priorContent = observedContents.get(ref)
        observedVersions.set(ref, Number(entriesMap.get(versionKey(ref)) ?? 0)); observedContents.set(ref, storedContent(value))
        try { await saveWorkspaceImpl(workspace, { activate: false }) }
        finally {
          // Listing must not give an already-open editor permission to overwrite a migration.
          if (priorVersion !== undefined) { observedVersions.set(ref, priorVersion); observedContents.set(ref, priorContent) }
        }
      }
      summaries.push({ ref: workspace.project.ref, name: workspace.project.name, revision: workspace.project.revision, updatedAt: workspace.project.updatedAt, proposalCount: workspace.proposals.length, boundary: workspace.project.site.boundary })
    } catch { /* an unreadable record is skipped rather than blocking the start screen */ }
  }
  return summaries.sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))
}

/** Removes a saved project; when it was the active one, nothing is active until the next save. */
const deleteWorkspaceImpl = async (ref: string) => {
  await withStore<unknown>('readwrite', (store) => {
    const version = store.get(versionKey(ref))
    version.onsuccess = () => store.put(Number(version.result ?? 0) + 1, versionKey(ref))
    const active = store.get(ACTIVE_POINTER_KEY)
    active.onsuccess = () => { if (active.result === ref) store.delete(ACTIVE_POINTER_KEY) }
    return [store.delete(workspaceKey(ref)) as IDBRequest<unknown>, store.put(true, `deleted/${ref}`) as IDBRequest<unknown>]
  })
  deletedRefs.add(ref)
}

export const saveProject = (project: ProjectV2) => saveWorkspace({ version: 1, project, proposals: [], draftChangeSets: [] })
export const loadProject = async (ref?: string): Promise<ProjectV2 | null> => (await loadWorkspace(ref))?.project ?? null

/** Atomically merge a published snapshot into its browser working copy, preserving backups and conflicts. */
const synchronizePublishedProjectImpl = async (published: ProjectV2, legacyBase: ProjectV2): Promise<string[]> => {
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
      const requests = [currentKey, baseKey, workspaceKey(copyRef), versionKey(published.ref), `deleted/${published.ref}`].map((key) => store.get(key))
      let remaining = requests.length
      let conflicts: string[] = []
      tx.oncomplete = () => resolve(conflicts)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error ?? new Error('Published project update was cancelled.'))
      for (const request of requests) request.onsuccess = () => {
        if (--remaining) return
        try {
          if (requests[4].result) return
          const current = requests[0].result === undefined ? null : toWorkspace(requests[0].result)
          const base = requests[1].result ? parseProject(requests[1].result) : legacyBase
          if (requests[1].result && sameProject(base, published)) return
          const incoming: PersistedWorkspace = { version: 1, project: structuredClone(published), proposals: [], draftChangeSets: [] }
          if (!current) {
            store.put(incoming, currentKey)
            store.put(Number(requests[3].result ?? 0) + 1, versionKey(published.ref))
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
            store.put(Number(requests[3].result ?? 0) + 1, versionKey(published.ref))
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

// Every public storage operation shares one queue. Snapshots are captured at call time.
let storageTail: Promise<unknown> = Promise.resolve()
let storageOwner: IDBFactory | undefined
const enqueue = <T>(action: () => Promise<T>): Promise<T> => {
  if (storageOwner !== globalThis.indexedDB) { storageOwner = globalThis.indexedDB; observedVersions.clear(); observedContents.clear(); deletedRefs.clear() }
  const result = storageTail.then(action)
  storageTail = result.catch(() => undefined)
  return result
}
export const flushStorage = async () => { await storageTail }
export const saveWorkspace = (workspace: PersistedWorkspace, options?: SaveOptions) => {
  const snapshot = structuredClone(workspace)
  const capturedOptions = options ? structuredClone(options) : undefined
  return enqueue(() => saveWorkspaceImpl(snapshot, capturedOptions))
}
export const loadWorkspace = (ref?: string) => enqueue(() => loadWorkspaceImpl(ref))
export const listWorkspaces = () => enqueue(listWorkspacesImpl)
export const renameWorkspace = (ref: string, name: string) => enqueue(() => renameWorkspaceImpl(ref, name))
export const deleteWorkspace = (ref: string) => enqueue(() => deleteWorkspaceImpl(ref))
export const synchronizePublishedProject = (published: ProjectV2, base: ProjectV2) => enqueue(() => synchronizePublishedProjectImpl(published, base))
export const readSyncRecord = <T>(ref: string): Promise<T | undefined> => enqueue(async () => await getRecord(`shared-base/${ref}`) as T | undefined)
export const writeSyncRecord = (ref: string, value: unknown) => enqueue(async () => { await putRecords([[`shared-base/${ref}`, value]]) })
export const saveRecovery = (workspace: PersistedWorkspace) => enqueue(async () => { await putRecords([[`recovery/${workspace.project.ref}/${Date.now()}-${Math.random()}`, workspace]]) })
export const listRecoveries = (ref: string) => enqueue(async () => (await allEntries()).filter(([key, value]) => key.startsWith('recovery/') && (value as PersistedWorkspace)?.project?.ref === ref).map(([key, value]) => ({ key, workspace: value as PersistedWorkspace })).reverse())
