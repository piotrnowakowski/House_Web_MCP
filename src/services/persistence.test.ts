import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { applyCommand, calculateMetrics, validateProject } from '../domain/commands'
import { sampleProject } from '../domain/sampleProject'
import { createTerrainProject } from '../domain/terrain'
import type { PersistedWorkspace, ProposalRecord } from '../domain/types'
import { LEGACY_WORKSPACE_KEY, deleteWorkspace, listWorkspaces, loadProject, loadWorkspace, saveProject, saveWorkspace } from './persistence'

const workspace = (project: PersistedWorkspace['project'], proposals: PersistedWorkspace['proposals'] = []): PersistedWorkspace => ({ version: 1, project, proposals, draftChangeSets: [] })
const terrain = createTerrainProject({ name: 'Test plot', widthM: 30, depthM: 40, northDegrees: 0, latitude: 52.23, longitude: 21.01, timezone: 'Europe/Warsaw' }, new Date('2026-09-04T09:00:00.000Z'))
const V1_KEY = 'zielonki-survey-active-project-v2'

const putRecord = (key: string, value: unknown) => new Promise<void>((resolve, reject) => {
  const request = indexedDB.open('house-web-mcp', 1)
  request.onupgradeneeded = () => { request.result.createObjectStore('projects') }
  request.onsuccess = () => { const database = request.result; const transaction = database.transaction('projects', 'readwrite'); transaction.objectStore('projects').put(value, key); transaction.oncomplete = () => { database.close(); resolve() }; transaction.onerror = () => reject(transaction.error) }
  request.onerror = () => reject(request.error)
})
const putLegacyRecord = (value: unknown) => putRecord(LEGACY_WORKSPACE_KEY, value)
const readRecord = (key: string) => new Promise<unknown>((resolve, reject) => {
  const request = indexedDB.open('house-web-mcp')
  request.onsuccess = () => { const database = request.result; const get = database.transaction('projects', 'readonly').objectStore('projects').get(key); get.onsuccess = () => { database.close(); resolve(get.result) }; get.onerror = () => reject(get.error) }
  request.onerror = () => reject(request.error)
})
const readKeys = () => new Promise<string[]>((resolve, reject) => {
  const request = indexedDB.open('house-web-mcp')
  request.onsuccess = () => { const database = request.result; const keys = database.transaction('projects', 'readonly').objectStore('projects').getAllKeys(); keys.onsuccess = () => { database.close(); resolve(keys.result.map(String)) }; keys.onerror = () => reject(keys.error) }
  request.onerror = () => reject(request.error)
})

beforeEach(() => { globalThis.indexedDB = new IDBFactory() })

describe('multi-project persistence', () => {
  it('keeps one record per project and lists them newest first with the active one loadable by default', async () => {
    await saveWorkspace(workspace(structuredClone(sampleProject)))
    await saveWorkspace(workspace(terrain, []))
    const listed = await listWorkspaces()
    expect(listed.map((item) => item.ref)).toEqual([terrain.ref, sampleProject.ref])
    expect(listed[0]).toMatchObject({ name: 'Test plot', revision: 1, updatedAt: terrain.updatedAt, proposalCount: 0 })
    expect((await loadWorkspace())?.project.ref).toBe(terrain.ref)
    expect((await loadWorkspace(sampleProject.ref))?.project.name).toBe(sampleProject.name)
    expect(await loadWorkspace('project/missing')).toBeNull()
  })

  it('migrates the single legacy record once and removes the legacy key', async () => {
    await putLegacyRecord(workspace(structuredClone(sampleProject)))
    const listed = await listWorkspaces()
    expect(listed.map((item) => item.ref)).toEqual([sampleProject.ref])
    expect(await readKeys()).not.toContain(LEGACY_WORKSPACE_KEY)
    expect((await loadWorkspace())?.project.ref).toBe(sampleProject.ref)
    expect((await listWorkspaces()).length).toBe(1)
  })

  it('accepts a bare legacy project record without the workspace envelope', async () => {
    await putLegacyRecord(structuredClone(sampleProject))
    expect((await loadWorkspace())?.project.ref).toBe(sampleProject.ref)
    expect((await listWorkspaces())[0]?.ref).toBe(sampleProject.ref)
  })

  it('deletes a project and forgets it as the active one', async () => {
    await saveWorkspace(workspace(structuredClone(sampleProject)))
    await saveWorkspace(workspace(terrain))
    await deleteWorkspace(terrain.ref)
    expect((await listWorkspaces()).map((item) => item.ref)).toEqual([sampleProject.ref])
    expect(await loadWorkspace()).toBeNull()
    expect((await loadWorkspace(sampleProject.ref))?.project.ref).toBe(sampleProject.ref)
  })
})

describe('ProjectV2 persistence boundary', () => {
  it('leaves an old V1 record untouched and restores only the new V2 key', async () => {
    await putRecord(V1_KEY, { schemaVersion: 1, name: 'Legacy project' })
    expect(await loadProject()).toBeNull()
    await saveProject(sampleProject)
    expect(await loadProject()).toEqual(sampleProject)
    expect(await readRecord(V1_KEY)).toEqual({ schemaVersion: 1, name: 'Legacy project' })
  })

  it('migrates saved Zielonki site geometry to the corrected subdivision outline', async () => {
    const stale = structuredClone(sampleProject)
    stale.site.knowledgeBase.datasetVersion = 'zielonki-knowledge-bank-2026-09-03'
    delete (stale.buildings[0].roof as Partial<typeof stale.buildings[0]['roof']>).segments
    delete (stale.buildings[0].roof as Partial<typeof stale.buildings[0]['roof']>).finish
    const parcel55 = stale.site.parcels.find((parcel) => parcel.cadastralNumber === '55/4')!
    parcel55.boundary = [{ x: -9.246, z: 15.882 }, { x: 0.8, z: 15.882 }, { x: 0.8, z: 161.017 }, { x: -9.246, z: 161.017 }]
    await putLegacyRecord(stale)

    const restored = await loadProject()
    const corrected55 = restored!.site.parcels.find((parcel) => parcel.cadastralNumber === '55/4')!
    expect(restored!.site.knowledgeBase.datasetVersion).toBe('zielonki-knowledge-bank-2026-09-03-outline-v4')
    expect(restored!.buildings[0].roof.segments).toHaveLength(1)
    expect(restored!.buildings[0].roof.segments[0].ref).toBe('roof/main/segment-main')
    expect(Math.max(...corrected55.boundary.map((point) => point.z))).toBeCloseTo(186.012, 3)
    expect(corrected55.boundary.some((point) => point.x === -2.152166)).toBe(true)
  })

  it('restores pending proposal audits and drafts alongside the project', async () => {
    const command = { type: 'plant.update', action: 'move', plantRef: 'plant/hydrangea', position: { x: -7.5, z: 9 } } as const
    const preview = applyCommand(sampleProject, command)
    const proposal: ProposalRecord = { ref: 'variant/persisted', label: 'Move hydrangea', baseRevision: 1, createdAt: '2026-09-03T12:00:00.000Z', commands: [command], project: preview, issues: validateProject(preview), metrics: calculateMetrics(preview), status: 'pending' }
    await saveWorkspace({ version: 1, project: sampleProject, proposals: [proposal], draftChangeSets: [{ ref: 'change-set/persisted', label: 'Garden revision', baseRevision: 1, createdAt: '2026-09-03T12:01:00.000Z', commands: [command], status: 'draft' }] })
    const restored = await loadWorkspace()
    expect(restored?.proposals[0]).toMatchObject({ ref: 'variant/persisted', status: 'pending', project: { buildings: [{ roof: { segments: expect.any(Array) } }] } })
    expect(restored?.draftChangeSets).toEqual([expect.objectContaining({ ref: 'change-set/persisted', status: 'draft' })])
  })
})
