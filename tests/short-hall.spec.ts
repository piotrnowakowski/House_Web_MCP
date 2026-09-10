import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import type { ProjectV2 } from '../src/domain/types'

const baseline: ProjectV2 = JSON.parse(readFileSync('project-data/zielonki-v2/before-short-hall-r55.json', 'utf8'))

for (const existing of [false, true]) test(`shorter hall survives reload in ${existing ? 'existing' : 'fresh'} project`, async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage(), errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const url = process.env.APP_URL ?? 'http://127.0.0.1:5173/'
  try {
    if (existing) {
      const bootstrap = new URL('short-hall-fixture', url).href
      await page.route(bootstrap, route => route.fulfill({ contentType: 'text/html', body: '<title>Migration fixture</title>' }))
      await page.goto(bootstrap)
      await page.evaluate(async data => {
        const { parseProject } = await import('/src/domain/schema.ts')
        const { saveWorkspace, synchronizePublishedProject } = await import('/src/services/persistence.ts')
        const base = parseProject(data)
        await synchronizePublishedProject(base, base)
        const local = structuredClone(base)
        local.buildings[0].spaces[0].name = 'Retained room name'
        local.buildings[1].furniture!.pop()
        await saveWorkspace({ version: 1, project: local, proposals: [], draftChangeSets: [] })
      }, baseline)
    }
    await page.goto(url)
    for (let visit = 0; visit < 2; visit++) {
      await page.getByRole('button', { name: /^(Continue|Open) · Garaz przód$/ }).click()
      await expect(page.getByRole('dialog', { name: 'Where do you want to plan today?' })).not.toBeVisible()
      const saved = await page.evaluate(async () => {
        const { loadWorkspace } = await import('/src/services/persistence.ts')
        return (await loadWorkspace('project/zielonki-v2'))!.project
      })
      const house = saved.buildings[0]
      expect(house.walls.find(w => w.ref === 'wall/carport-layout/ground/5')!.start.z).toBeCloseTo(1.915)
      expect(house.walls.find(w => w.ref === 'wall/carport-layout/ground/7')!.start.z).toBeCloseTo(1.915)
      expect(house.walls.some(w => w.ref === 'wall/carport-layout/ground/6')).toBe(false)
      expect(Math.max(...house.slabs[0].footprint.map(p => p.z))).toBeCloseTo(6.985)
      expect(Math.min(...house.slabs[0].footprint.map(p => p.x))).toBeCloseTo(-4.095)
      expect(house.walls.find(w => w.ref === 'wall/carport-layout/ground/9')!.start.x).toBeCloseTo(-1.13)
      expect(house.walls.find(w => w.ref === 'wall/carport-layout/ground/5')!.openings[0].offsetM).toBeCloseTo(.6)
      expect(house.walls.flatMap(w => w.openings).some(o => o.ref === 'opening/reference-pantry')).toBe(false)
      if (existing) {
        expect(house.spaces[0].name).toBe('Retained room name')
        expect(saved.buildings[1].furniture).toHaveLength(baseline.buildings[1].furniture!.length - 1)
      }
      if (visit === 0) await page.reload()
    }
    await page.getByRole('button', { name: 'House interior', exact: true }).click()
    await page.getByRole('button', { name: '2D Plan', exact: true }).click()
    await expect(page.locator('canvas')).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('shorter-hall.png') })
    expect(errors).toEqual([])
  } finally { await context.close() }
})
