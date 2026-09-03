import { parseProject } from '../domain/schema'
import type { PersistedWorkspace, ProjectV2, ProposalRecord } from '../domain/types'
import { zielonkiKnowledgeBase, zielonkiPlot } from '../../knowledge-bank/zielonki/data'

const DB_NAME = 'house-web-mcp'
const STORE_NAME = 'projects'
const ACTIVE_KEY = 'zielonki-spatial-editor-balanced-facades-v2'

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1)
  request.onupgradeneeded = () => {
    const database = request.result
    if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME)
  }
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

const saveRecord = async (value: unknown) => {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(value, ACTIVE_KEY)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  database.close()
}

const loadRecord = async (): Promise<unknown> => {
  const database = await openDatabase()
  const value = await new Promise<unknown>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).get(ACTIVE_KEY)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  database.close()
  return value
}

const refreshZielonkiKnowledge = (project: ProjectV2) => {
  if (project.ref === 'project/zielonki-spatial-v2' && project.site.knowledgeBase.datasetVersion !== zielonkiKnowledgeBase.datasetVersion) {
    project.site.boundary = structuredClone(zielonkiPlot.boundary)
    project.site.terrain.boundary = structuredClone(zielonkiPlot.boundary)
    project.site.parcels = structuredClone(zielonkiPlot.parcels)
    project.site.entrances = structuredClone(zielonkiPlot.entrances)
    project.site.knowledgeBase = structuredClone(zielonkiKnowledgeBase)
  }
  return project
}

export const saveWorkspace = (workspace: PersistedWorkspace) => saveRecord(workspace)

export const loadWorkspace = async (): Promise<PersistedWorkspace | null> => {
  const value = await loadRecord()
  if (!value) return null
  const candidate = value as Partial<PersistedWorkspace>
  if (candidate.version === 1 && candidate.project) {
    const project = refreshZielonkiKnowledge(parseProject(candidate.project))
    const proposals = Array.isArray(candidate.proposals) ? candidate.proposals.map((proposal) => ({ ...proposal, project: parseProject((proposal as ProposalRecord).project) })) as ProposalRecord[] : []
    return { version: 1, project, proposals, draftChangeSets: Array.isArray(candidate.draftChangeSets) ? candidate.draftChangeSets : [] }
  }
  return { version: 1, project: refreshZielonkiKnowledge(parseProject(value)), proposals: [], draftChangeSets: [] }
}

export const saveProject = (project: ProjectV2) => saveWorkspace({ version: 1, project, proposals: [], draftChangeSets: [] })
export const loadProject = async (): Promise<ProjectV2 | null> => (await loadWorkspace())?.project ?? null
