import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const url = process.env.APP_URL ?? 'http://127.0.0.1:5173'
const chairRef = 'interior/office-c5/chair'
const open = async (page: Page) => {
  await page.goto(url)
  await page.getByRole('button', { name: 'Otwórz projekt: Główny', exact: true }).tap()
  await expect(page.getByRole('application', { name: 'Interactive ProjectV2 spatial editor', exact: true })).toBeVisible({ timeout: 30000 })
  await saved(page)
}
const saved = async (page: Page) => {
  await expect(page.locator('[data-save-phase]').first()).toHaveAttribute('data-save-phase', 'saved')
}
const state = (page: Page) => page.evaluate(async () => {
  const harness = await import('/tests/browser-harness.ts')
  return harness.state()
})
const close = async (page: Page) => {
  const button = page.getByRole('button', { name: 'Zamknij panel', exact: true })
  if (await button.isVisible()) await button.tap()
}
const expand = async (page: Page) => {
  const button = page.getByRole('button', { name: 'Rozwiń panel', exact: true })
  if (await button.isVisible()) await button.tap()
}
const edit = async (page: Page, ref?: string) => {
  await close(page)
  await page.getByRole('navigation', { name: 'Plot actions' }).getByRole('button', { name: /Edytuj|Edit selection/ }).tap()
  await expand(page)
  if (ref) await page.getByLabel('Choose element to edit').selectOption(ref)
}
const add = async (page: Page) => {
  await close(page)
  await page.getByRole('navigation', { name: 'Plot actions' }).getByRole('button', { name: 'Dodaj', exact: true }).tap()
  await page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Slatted garden bench', exact: true }) }).getByRole('button', { name: 'Dodaj', exact: true }).tap()
  await saved(page)
  return (await state(page)).project.landscape.fixtures.filter(f => f.catalogId === 'slatted-bench')
}
const proposeDelete = async (page: Page, ref: string) => {
  await edit(page, ref)
  await page.getByRole('button', { name: 'Delete', exact: true }).tap()
  await page.getByRole('button', { name: 'Create delete proposal', exact: true }).tap()
  await expect(page.getByRole('button', { name: 'Apply complete variant' })).toBeVisible()
}
const name = (page: Page) => page.getByLabel('Nazwa obiektu', { exact: true })
const apply = async (page: Page) => { await page.getByRole('button', { name: 'Zastosuj zmiany', exact: true }).tap() }

test('garden IDs remain unique after deletion; stale review returns to an editable inspector', async ({ page }) => {
  await open(page)
  const first = (await add(page)).at(-1)!.ref
  await add(page)
  await proposeDelete(page, first)
  await page.getByRole('button', { name: 'Apply complete variant' }).tap()
  await saved(page)
  const fixtures = await add(page)
  expect(fixtures).toHaveLength(2)
  expect(new Set(fixtures.map(f => f.ref)).size).toBe(2)
  expect(fixtures.some(f => f.ref === first)).toBe(false)
  await proposeDelete(page, fixtures[0].ref)
  await add(page)
  await edit(page)
  await expect(page.getByLabel('Choose element to edit')).toBeVisible()
  expect((await state(page)).confirmation).toBeNull()
  expect((await state(page)).proposals.at(-1)?.status).toBe('stale')
})

test('undo and redo survive page reload and project reopening', async ({ page }) => {
  await open(page)
  const before = (await state(page)).project.landscape.fixtures.length
  await add(page)
  await page.reload()
  await page.getByRole('button', { name: 'Otwórz projekt: Główny', exact: true }).tap()
  await edit(page)
  await expect(page.getByRole('button', { name: 'Undo edit', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Undo edit', exact: true }).tap()
  await saved(page)
  expect((await state(page)).project.landscape.fixtures).toHaveLength(before)
  await page.reload()
  await page.getByRole('button', { name: 'Otwórz projekt: Główny', exact: true }).tap()
  await edit(page)
  await expect(page.getByRole('button', { name: 'Redo edit', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Redo edit', exact: true }).tap()
  await saved(page)
  expect((await state(page)).project.landscape.fixtures).toHaveLength(before + 1)
})

test('existing warnings collapse and review actions remain reachable while scrolling', async ({ page }) => {
  await open(page)
  const ref = (await add(page)).at(-1)!.ref
  await proposeDelete(page, ref)
  const details = page.locator('.approval-existing-warnings')
  await expect(details).not.toHaveAttribute('open', '')
  await expect(details.locator('li')).not.toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Apply complete variant' })).toBeInViewport()
  await details.locator('summary').tap()
  await page.locator('.sheet-body').evaluate(e => { e.scrollTop = e.scrollHeight })
  await expect(page.getByRole('button', { name: 'Apply complete variant' })).toBeInViewport()
  await expect(page.getByRole('button', { name: 'Reject all' })).toBeInViewport()
  await page.getByRole('button', { name: 'Reject all' }).tap()
  expect((await state(page)).project.landscape.fixtures.some(f => f.ref === ref)).toBe(true)
  expect((await state(page)).proposals.at(-1)?.status).toBe('rejected')
})

test('furniture drafts survive dismissal, discard explicitly, and clear after apply', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Wnętrze domu', exact: true }).tap()
  await page.getByRole('navigation', { name: 'Narzędzia wnętrza' }).getByRole('button', { name: 'Edytuj', exact: true }).tap()
  await page.getByRole('button', { name: 'IKEA JÄRVFJÄLLET', exact: true }).tap()
  await expand(page)
  const original = await name(page).inputValue()
  await name(page).fill('Unapplied mobile draft')
  await close(page)
  await page.getByRole('navigation', { name: 'Narzędzia wnętrza' }).getByRole('button', { name: 'Edytuj', exact: true }).tap()
  await expect(name(page)).toHaveValue('Unapplied mobile draft')
  expect((await state(page)).project.buildings[0].furniture?.find(f => f.ref === chairRef)?.name).toBe(original)
  await page.getByRole('button', { name: 'Odrzuć szkic', exact: true }).tap()
  await expect(name(page)).toHaveValue(original)
  await name(page).fill('Applied mobile draft')
  await apply(page)
  await saved(page)
  await expect(page.getByRole('button', { name: 'Odrzuć szkic', exact: true })).toHaveCount(0)
  expect((await state(page)).project.buildings[0].furniture?.find(f => f.ref === chairRef)?.name).toBe('Applied mobile draft')
})

test('a stale save can be exported, retried safely and explicitly imported after reload', async ({ page, context }) => {
  await open(page)
  await edit(page, chairRef)
  const other = await context.newPage()
  await open(other)
  await edit(other, chairRef)
  await name(other).fill('Chair in newer tab')
  await apply(other)
  await saved(other)
  await name(page).fill('Chair needing recovery')
  await apply(page)
  await expect(page.locator('.sheet-save-status')).toHaveAttribute('data-save-phase', 'error')
  await page.locator('.sheet-save-status').getByRole('button', { name: 'Zapis i synchronizacja', exact: true }).tap()
  const panel = page.locator('.workspace-sync-panel')
  await panel.getByRole('button', { name: 'Ponów zapis lokalny', exact: true }).tap()
  await expect(panel.getByRole('alert').first()).toContainText('another tab')
  const downloading = page.waitForEvent('download')
  await panel.getByRole('button', { name: 'Eksportuj kopię odzyskiwania', exact: true }).tap()
  const download = await downloading
  const file = (await download.path())!
  const exported = JSON.parse(await readFile(file, 'utf8'))
  expect(exported.workspace.project.buildings[0].furniture.find((f: { ref: string }) => f.ref === chairRef).name).toBe('Chair needing recovery')
  expect(exported.format).toBe('house-workspace-transfer-v1')
  expect((await state(other)).project.buildings[0].furniture?.find(f => f.ref === chairRef)?.name).toBe('Chair in newer tab')
  page.on('dialog', dialog => dialog.accept())
  await page.reload()
  await page.getByRole('button', { name: 'Otwórz projekt: Główny', exact: true }).tap()
  await saved(page)
  expect((await state(page)).project.buildings[0].furniture?.find(f => f.ref === chairRef)?.name).toBe('Chair in newer tab')
  await page.getByRole('button', { name: 'Zapis i synchronizacja', exact: true }).tap()
  await page.getByLabel('Plik kopii odzyskiwania').setInputFiles(file)
  await expect(page.getByRole('button', { name: 'Pobierz kopię projektu i propozycji', exact: true })).toBeEnabled({ timeout: 15000 })
  await expect(page.locator('.workspace-sync-panel [role="alert"]')).toHaveCount(0)
  await expect.poll(async () => (await state(page)).project.buildings[0].furniture?.find(f => f.ref === chairRef)?.name).toBe('Chair needing recovery')
  await saved(page)
  await other.close()
})

test('save status and proposal filters fit narrow and landscape mobile panels', async ({ page }) => {
  await open(page)
  for (const viewport of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport)
    await edit(page)
    await expect(page.locator('.sheet-save-status')).toBeInViewport()
    await page.locator('.sheet-body').evaluate(e => { e.scrollTop = e.scrollHeight })
    await expect(page.locator('.sheet-save-status')).toBeInViewport()
    await close(page)
    await page.getByRole('navigation', { name: 'Plot actions' }).getByRole('button', { name: 'Więcej', exact: true }).tap()
    await page.getByRole('button', { name: 'Propozycje', exact: true }).tap()
    await expand(page)
    const layout = await page.locator('.proposal-filters button').evaluateAll(buttons => buttons.map(button => {
      const label = button.querySelector('span')!.getBoundingClientRect(), count = button.querySelector('b')!.getBoundingClientRect(), bounds = button.getBoundingClientRect()
      return { width: bounds.width, overlap: label.right > count.left, overflow: button.scrollWidth > button.clientWidth, left: bounds.left, right: bounds.right }
    }))
    expect(layout).toHaveLength(5)
    for (const b of layout) { expect(b.overlap).toBe(false); expect(b.overflow).toBe(false); expect(b.left).toBeGreaterThanOrEqual(0); expect(b.right).toBeLessThanOrEqual(viewport.width) }
    await close(page)
  }
})
