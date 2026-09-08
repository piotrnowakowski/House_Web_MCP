import type { Page } from '@playwright/test'
import { modernBarnProject } from '../../src/domain/sampleProject'

/** Exercise editing and upgrading an existing project, independently of the fresh furnished starter. */
export async function saveLegacyZielonki(page: Page) {
  await page.evaluate((project) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('house-web-mcp', 2)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('projects')) request.result.createObjectStore('projects')
    }
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const database = request.result
      const transaction = database.transaction('projects', 'readwrite')
      transaction.objectStore('projects').put({ version: 1, project, proposals: [], draftChangeSets: [] }, `workspace/${project.ref}`)
      transaction.oncomplete = () => { database.close(); resolve() }
      transaction.onerror = () => { database.close(); reject(transaction.error) }
    }
  }), modernBarnProject)
}
