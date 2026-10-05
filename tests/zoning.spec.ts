import { expect, test } from '@playwright/test'
import type { ProjectV2 } from '../src/domain/types'

test('Zielonki zoning stays visible across house versions and a saved reload', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5173', { waitUntil: 'networkidle' })
  await page.getByRole('dialog').getByRole('button', { name: /Zielonki house study/ }).click()
  const legend = page.getByLabel('Land-use legend')
  await expect(legend).toContainText('06.MNU.8')
  await expect(legend).toContainText('699 m²')
  await expect(legend).toContainText('06.R.21')
  await expect(legend).toContainText('House overlaps agricultural zoning')
  await expect(page.locator('.zoning-map-label')).toHaveCount(0)
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'output/zielonki-zoning/app-3d.png' })
  // A pre-zoning saved copy of the original house exercises the real storage migration.
  await page.evaluate(async () => {
    const sampleUrl = '/src/domain/sampleProject.ts'; const persistenceUrl = '/src/services/persistence.ts'
    const { sampleProject } = await import(sampleUrl)
    const { saveWorkspace } = await import(persistenceUrl)
    const old: ProjectV2 = structuredClone(sampleProject)
    old.ref = 'project/zoning-browser-copy'; old.name = 'Original house zoning check'
    old.site.knowledgeBase.datasetVersion = 'zielonki-knowledge-bank-2026-09-03-outline-v4'
    old.site.parcels.forEach((parcel) => { delete parcel.landUseZones; if (parcel.landRole === 'mixed') parcel.landRole = 'construction' })
    await saveWorkspace({ version: 1, project: old, proposals: [], draftChangeSets: [] })
  })
  await page.getByRole('button', { name: 'Projects', exact: true }).click()
  await page.locator('.project-card').filter({ hasText: 'Original house zoning check' }).getByRole('button', { name: /^(Continue|Open)/ }).click()
  await expect(legend).toContainText('699 m²')
  await expect(page.locator('.zoning-map-label')).toHaveCount(0)
  await page.waitForTimeout(800)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('dialog').getByRole('button', { name: /Zielonki house study/ }).click()
  await expect(legend).toContainText('699 m²')
  await expect(legend).toContainText('House overlaps agricultural zoning')
  await expect(page.locator('canvas')).toHaveCount(1)
  expect(errors).toEqual([])
})
