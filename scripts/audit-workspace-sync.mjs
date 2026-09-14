import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
const url = process.env.APP_URL ?? 'http://127.0.0.1:5193'
const key = 'test-only-connection-key-12345678901234567890'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const results = []
const errors = []
const screenshotDir = 'tmp/workspace-sync-audit'
await mkdir(screenshotDir, { recursive: true })
const contexts = []
async function session() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  contexts.push(context)
  await context.route('https://natan203-20203.mikrus.cloud/api/sync/**', async route => {
    const original = new URL(route.request().url())
    const response = await route.fetch({ url: `http://127.0.0.1:5194${original.pathname}${original.search}` })
    await route.fulfill({ response })
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await openProject(page)
  return { context, page }
}
async function openProject(page) {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /^(Continue|Open) · Garaz przód$/ }).click()
  await expect(page.locator('.start-screen-scrim')).not.toBeVisible({ timeout: 30000 })
  await saved(page)
}
const saved = async page => {
  try { await expect(page.getByRole('status').filter({ hasText: /^Saved locally$/ })).toBeVisible({ timeout: 15000 }) }
  catch(error) { await panel(page); console.log('Save failure:', await page.getByRole('dialog', { name: 'Save and synchronize workspace' }).innerText()); throw error }
}
async function move(page, axis, delta) {
  const editor = page.getByRole('region', { name: 'Precision editor' })
  await editor.getByLabel('Choose element to edit').selectOption('house/main')
  await editor.getByLabel('Move carport, terrace and entrance path together').uncheck()
  const input = editor.getByLabel(`Position ${axis} (m)`, { exact: true })
  const target = Number(await input.inputValue()) + delta
  await input.fill(String(target))
  await editor.getByRole('button', { name: 'Apply position', exact: true }).click()
  return target
}
async function panel(page) { if (!await page.getByRole('dialog', { name: 'Save and synchronize workspace' }).isVisible()) await page.getByRole('button', { name: 'Save & sync', exact: true }).click() }
async function closePanel(page) { await page.getByRole('button', { name: 'Close save and sync' }).click() }
async function connect(page) {
  await panel(page)
  await page.getByLabel('Private connection key', { exact: true }).fill(key)
  await page.getByRole('button', { name: 'Remember on this browser' }).click()
}
async function sync(page) { await panel(page); await page.getByRole('button', { name: 'Sync with Mikrus', exact: true }).click() }
const synced = async page => {
  try { await expect(page.getByRole('status').filter({ hasText: /^Synchronized with Mikrus/ })).toBeVisible({ timeout: 30000 }) }
  catch (error) { console.log('Sync panel:', await page.getByRole('dialog', { name: 'Save and synchronize workspace' }).innerText()); throw error }
}
async function stored(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve,reject) => { const r=indexedDB.open('house-web-mcp');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error) })
    try { return await new Promise((resolve,reject)=>{const r=db.transaction('projects').objectStore('projects').get('workspace/project/zielonki-v2');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)}) } finally {db.close()}
  })
}
try {
  const a = await session()
  const x = await move(a.page, 'X', 0.1)
  // No delay or arbitrary sleep between apply and reload.
  a.page.on('dialog', dialog => dialog.accept())
  await a.page.reload({ waitUntil: 'domcontentloaded' }); await openProject(a.page)
  expect((await stored(a.page)).project.buildings[0].position.x).toBeCloseTo(x, 6)
  results.push('Cold move + immediate reload persists')
  await connect(a.page); await sync(a.page); await synced(a.page)
  const b = await session(); await connect(b.page); await sync(b.page)
  await expect(b.page.getByRole('heading', { name: 'Both versions are preserved' })).toBeVisible()
  await b.page.getByRole('button', { name: 'Use Mikrus version', exact: true }).click(); await synced(b.page)
  expect((await stored(b.page)).project.buildings[0].position.x).toBeCloseTo(x, 6)
  results.push('First sync preserves both versions and requires a choice')
  await closePanel(b.page)
  const nextX = await move(b.page, 'X', 0.1); await saved(b.page); await sync(b.page); await synced(b.page)
  await sync(a.page); await synced(a.page)
  expect((await stored(a.page)).project.buildings[0].position.x).toBeCloseTo(nextX, 6)
  results.push('Two-way manual sync uses the PostgreSQL API')
  await closePanel(a.page); await closePanel(b.page)
  const mergedX = await move(a.page, 'X', 0.1); await saved(a.page)
  const mergedZ = await move(b.page, 'Z', -0.1); await saved(b.page)
  await sync(a.page); await synced(a.page); await sync(b.page); await synced(b.page)
  expect((await stored(b.page)).project.buildings[0].position).toEqual({ x: mergedX, z: mergedZ })
  results.push('Independent fields merge without losing either edit')
  await sync(a.page); await synced(a.page)
  await closePanel(a.page); await closePanel(b.page)
  await move(a.page, 'X', 0.1); await saved(a.page); await move(b.page, 'X', -0.1); await saved(b.page)
  await sync(a.page); await synced(a.page); await sync(b.page)
  await expect(b.page.getByRole('heading', { name: 'Both versions are preserved' })).toBeVisible()
  await b.page.getByRole('button', { name: 'Cancel sync', exact: true }).click()
  results.push('Same-field edits conflict; cancellation preserves local work')
  await closePanel(a.page)
  await a.context.setOffline(true)
  await move(a.page, 'Z', -0.1); await saved(a.page)
  await a.context.setOffline(false)
  results.push('Offline edits remain locally durable')
  const retries = []
  let dropResponse = true
  await a.context.route('https://natan203-20203.mikrus.cloud/api/sync/workspace', async route => {
    if (route.request().method() !== 'PUT') return route.fallback()
    retries.push(route.request().postDataJSON().mutationId)
    const response = await route.fetch({ url: 'http://127.0.0.1:5194/api/sync/workspace' })
    if (dropResponse) { dropResponse = false; await route.abort('connectionfailed') }
    else await route.fulfill({ response })
  })
  await sync(a.page)
  await expect(a.page.getByRole('status').filter({ hasText: /Mikrus is unreachable/ })).toBeVisible()
  const remoteUrl = 'http://127.0.0.1:5194/api/sync/workspace?ref=project%2Fzielonki-v2'
  const versionBeforeRetry = (await (await fetch(remoteUrl, { headers: { Authorization: `Bearer ${key}` } })).json()).serverVersion
  await sync(a.page); await synced(a.page)
  expect(retries).toHaveLength(2); expect(retries[0]).toBe(retries[1])
  expect((await (await fetch(remoteUrl, { headers: { Authorization: `Bearer ${key}` } })).json()).serverVersion).toBe(versionBeforeRetry)
  results.push('Lost response retries the original mutation without creating another version')
  const downloadPromise = a.page.waitForEvent('download')
  await a.page.getByRole('button', { name: 'Export recovery copy', exact: true }).click()
  const download = await downloadPromise
  const c = await session(); c.page.on('dialog', dialog => dialog.accept())
  await panel(c.page)
  await c.page.getByRole('dialog', { name: 'Save and synchronize workspace' }).locator('input[type=file]').setInputFiles(await download.path())
  await expect.poll(async () => (await stored(c.page)).project.buildings[0].position.z).toBe((await stored(a.page)).project.buildings[0].position.z)
  expect((await stored(c.page)).project.ref).toBe('project/zielonki-v2')
  results.push('Recovery transfer preserves identity and saved geometry')
  await closePanel(a.page)
  // New tab shares IndexedDB but retains its previously loaded write version.
  const tab = await a.context.newPage(); await openProject(tab)
  await move(a.page, 'Z', -0.1); await saved(a.page)
  await move(tab, 'Z', -0.2)
  await expect(tab.getByRole('status').filter({ hasText: /^Save failed$/ })).toBeVisible()
  await panel(tab)
  await expect(tab.getByRole('alert')).toContainText('another tab')
  results.push('Competing tab cannot overwrite a newer local snapshot')
  await a.page.screenshot({ path: `${screenshotDir}/sync-desktop.png` })
  await tab.screenshot({ path: `${screenshotDir}/conflict-recovery.png` })
  expect(errors).toEqual([])
} finally {
  await writeFile(`${screenshotDir}/report.json`, JSON.stringify({ results, errors }, null, 2))
  for (const context of contexts) await context.close()
  await browser.close()
  console.log(JSON.stringify({ results, errors }, null, 2))
}
