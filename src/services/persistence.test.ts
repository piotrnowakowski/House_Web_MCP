import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { sampleProject } from '../domain/sampleProject'
import { createTerrainProject } from '../domain/terrain'
import type { PersistedWorkspace } from '../domain/types'
import { LEGACY_WORKSPACE_KEY, deleteWorkspace, listWorkspaces, loadWorkspace, saveWorkspace } from './persistence'

const workspace = (project: PersistedWorkspace['project'], proposals: PersistedWorkspace['proposals'] = []): PersistedWorkspace => ({ version: 1, project, proposals, draftChangeSets: [] })
const terrain = createTerrainProject({ name: 'Test plot', widthM: 30, depthM: 40, northDegrees: 0, latitude: 52.23, longitude: 21.01, timezone: 'Europe/Warsaw' }, new Date('2026-09-04T09:00:00.000Z'))

const putLegacyRecord = (value: unknown) => new Promise<void>((resolve, reject) => {
  const request = indexedDB.open('house-web-mcp', 1)
  request.onupgradeneeded = () => { request.result.createObjectStore('projects') }
  request.onsuccess = () => { const database = request.result; const transaction = database.transaction('projects', 'readwrite'); transaction.objectStore('projects').put(value, LEGACY_WORKSPACE_KEY); transaction.oncomplete = () => { database.close(); resolve() }; transaction.onerror = () => reject(transaction.error) }
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
