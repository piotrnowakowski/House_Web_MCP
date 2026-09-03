import { parseProject } from '../domain/schema'
import type { ProjectV2 } from '../domain/types'
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

export const saveProject = async (project: ProjectV2) => {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(project, ACTIVE_KEY)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  database.close()
}

export const loadProject = async (): Promise<ProjectV2 | null> => {
  const database = await openDatabase()
  const value = await new Promise<unknown>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).get(ACTIVE_KEY)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  database.close()
  if (!value) return null
  const project = parseProject(value)
  if (project.ref === 'project/zielonki-spatial-v2' && project.site.knowledgeBase.datasetVersion !== zielonkiKnowledgeBase.datasetVersion) {
    project.site.boundary = structuredClone(zielonkiPlot.boundary)
    project.site.terrain.boundary = structuredClone(zielonkiPlot.boundary)
    project.site.parcels = structuredClone(zielonkiPlot.parcels)
    project.site.entrances = structuredClone(zielonkiPlot.entrances)
    project.site.knowledgeBase = structuredClone(zielonkiKnowledgeBase)
  }
  return project
}
