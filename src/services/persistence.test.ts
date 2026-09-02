import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { sampleProject } from '../domain/sampleProject'
import { loadProject, saveProject } from './persistence'

const deleteDatabase = () => new Promise<void>((resolve, reject) => {
  const request = indexedDB.deleteDatabase('house-web-mcp'); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error)
})

const putOldRecord = () => new Promise<void>((resolve, reject) => {
  const request = indexedDB.open('house-web-mcp', 1)
  request.onupgradeneeded = () => request.result.createObjectStore('projects')
  request.onsuccess = () => {
    const database = request.result; const transaction = database.transaction('projects', 'readwrite')
    transaction.objectStore('projects').put({ schemaVersion: 1, name: 'Legacy project' }, 'zielonki-survey-active-project-v2')
    transaction.oncomplete = () => { database.close(); resolve() }; transaction.onerror = () => reject(transaction.error)
  }
  request.onerror = () => reject(request.error)
})

const getOldRecord = () => new Promise<unknown>((resolve, reject) => {
  const request = indexedDB.open('house-web-mcp', 1)
  request.onsuccess = () => {
    const database = request.result; const transaction = database.transaction('projects', 'readonly'); const get = transaction.objectStore('projects').get('zielonki-survey-active-project-v2')
    get.onsuccess = () => { database.close(); resolve(get.result) }; get.onerror = () => reject(get.error)
  }
  request.onerror = () => reject(request.error)
})

describe('ProjectV2 persistence boundary', () => {
  beforeEach(deleteDatabase)

  it('leaves an old V1 record untouched and restores only the new V2 key', async () => {
    await putOldRecord()
    expect(await loadProject()).toBeNull()
    await saveProject(sampleProject)
    expect(await loadProject()).toEqual(sampleProject)
    expect(await getOldRecord()).toEqual({ schemaVersion: 1, name: 'Legacy project' })
  })
})
