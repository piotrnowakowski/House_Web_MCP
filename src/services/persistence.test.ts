import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { applyCommand, calculateMetrics, validateProject } from '../domain/commands'
import { sampleProject } from '../domain/sampleProject'
import type { ProposalRecord } from '../domain/types'
import { loadProject, loadWorkspace, saveProject, saveWorkspace } from './persistence'

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

const putCurrentRecord = (value: unknown) => new Promise<void>((resolve, reject) => {
  const request = indexedDB.open('house-web-mcp', 1)
  request.onupgradeneeded = () => request.result.createObjectStore('projects')
  request.onsuccess = () => {
    const database = request.result; const transaction = database.transaction('projects', 'readwrite')
    transaction.objectStore('projects').put(value, 'zielonki-spatial-editor-balanced-facades-v2')
    transaction.oncomplete = () => { database.close(); resolve() }; transaction.onerror = () => reject(transaction.error)
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

  it('migrates saved Zielonki site geometry to the corrected subdivision outline', async () => {
    const stale = structuredClone(sampleProject)
    stale.site.knowledgeBase.datasetVersion = 'zielonki-knowledge-bank-2026-09-03'
    delete (stale.buildings[0].roof as Partial<typeof stale.buildings[0]['roof']>).segments
    delete (stale.buildings[0].roof as Partial<typeof stale.buildings[0]['roof']>).finish
    const parcel55 = stale.site.parcels.find((parcel) => parcel.cadastralNumber === '55/4')!
    parcel55.boundary = [{ x: -9.246, z: 15.882 }, { x: 0.8, z: 15.882 }, { x: 0.8, z: 161.017 }, { x: -9.246, z: 161.017 }]
    await putCurrentRecord(stale)

    const restored = await loadProject()
    const corrected55 = restored!.site.parcels.find((parcel) => parcel.cadastralNumber === '55/4')!
    expect(restored!.site.knowledgeBase.datasetVersion).toBe('zielonki-knowledge-bank-2026-09-03-outline-v3')
    expect(restored!.buildings[0].roof.segments).toHaveLength(1)
    expect(restored!.buildings[0].roof.segments[0].ref).toBe('roof/main/segment-main')
    expect(Math.max(...corrected55.boundary.map((point) => point.z))).toBeCloseTo(186.012, 3)
    expect(corrected55.boundary.some((point) => point.x === -2.152166)).toBe(true)
  })

  it('restores pending proposal audits and drafts alongside the project', async () => {
    const command = { type: 'plant.update', action: 'move', plantRef: 'plant/hydrangea', position: { x: -7.5, z: 9 } } as const
    const preview = applyCommand(sampleProject, command)
    const proposal: ProposalRecord = { ref: 'variant/persisted', label: 'Move hydrangea', baseRevision: 1, createdAt: '2026-09-03T12:00:00.000Z', commands: [command], project: preview, issues: validateProject(preview), metrics: calculateMetrics(preview), status: 'pending' }
    await saveWorkspace({ version: 1, project: sampleProject, proposals: [proposal], draftChangeSets: [{ ref: 'change-set/persisted', label: 'Garden revision', baseRevision: 1, createdAt: '2026-09-03T12:01:00.000Z', commands: [], status: 'draft' }] })
    const restored = await loadWorkspace()
    expect(restored?.proposals[0]).toMatchObject({ ref: 'variant/persisted', status: 'pending', project: { buildings: [{ roof: { segments: expect.any(Array) } }] } })
    expect(restored?.draftChangeSets).toEqual([expect.objectContaining({ ref: 'change-set/persisted', status: 'draft' })])
  })
})
