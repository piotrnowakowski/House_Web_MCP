import { expect, test, type Page } from '@playwright/test'

const appUrl = process.env.APP_URL ?? 'http://127.0.0.1:5173'
const appBasePath = new URL(appUrl).pathname.replace(/\/$/, '')

test('ProjectV2 editor and architectural report work in one real canvas', async ({ page }) => {
  test.setTimeout(240_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await page.addInitScript(() => {
    const tools: Record<string, { execute: (input: unknown) => Promise<{ content: Array<{ text: string }> }> }> = {}
    const revoked: string[] = []; const revoke = URL.revokeObjectURL.bind(URL)
    URL.revokeObjectURL = (url: string) => { revoked.push(url); revoke(url) }
    Object.assign(window, { __projectV2WebMcpTools: tools, __projectV2RevokedUrls: revoked })
    Object.defineProperty(document, 'modelContext', { configurable: true, value: { registerTool: async (tool: { name: string; execute: (input: unknown) => Promise<{ content: Array<{ text: string }> }> }) => { tools[tool.name] = tool } } })
  })
  const textureLoads: string[] = []
  const modelLoads: Array<{ path: string; status: number }> = []
  page.on('response', (response) => {
    const path = new URL(response.url()).pathname
    if (path.includes('/textures/') && response.ok()) textureLoads.push(path)
    if (path.includes('/models/')) modelLoads.push({ path, status: response.status() })
  })
  await page.goto(appUrl, { waitUntil: 'networkidle' })
  const startScreen = page.getByRole('dialog', { name: 'Where do you want to plan today?' })
  await expect(startScreen).toBeVisible()
  await startScreen.getByRole('button', { name: /Zielonki house study/ }).click()
  await expect(startScreen).toBeHidden()

  await expect(page.locator('canvas')).toHaveCount(1)
  await expect.poll(() => modelLoads.length, { timeout: 20_000 }).toBeGreaterThan(0)
  expect(modelLoads.every(({ path, status }) => path.startsWith(`${appBasePath}/models/`) && status === 200)).toBe(true)
  await expect.poll(() => textureLoads.filter((path) => path.endsWith('/textures/leafy_grass/diff_2k.jpg')).length, { timeout: 20_000 }).toBeGreaterThan(0)
  await expect.poll(() => textureLoads.filter((path) => path.endsWith('/textures/concrete_tiles_02/diff_2k.jpg')).length, { timeout: 20_000 }).toBeGreaterThan(0)
  // The whole library preloads after the scene's own scans, so a later pick is instant: red brick is not drawn by default.
  await expect.poll(() => textureLoads.filter((path) => path.endsWith('/textures/medieval_red_brick/diff_2k.jpg')).length, { timeout: 30_000 }).toBeGreaterThan(0)
  await page.waitForTimeout(1200)
  await page.locator('.viewport').screenshot({ path: 'test-results/project-v2-textured-realistic.png' })
  await expect(page.getByText('Spatial Editor', { exact: true })).toBeVisible()
  await expect(page.getByText('PROJECTV2 / SEMANTIC MODEL')).toBeVisible()
  await expect(page.getByText('L-shaped modern barn')).toBeVisible()
  const modernBarn = page.getByRole('button', { name: /Modern barn/ })
  await expect(modernBarn).toHaveClass(/active/)
  await expect(modernBarn).toContainText('2 levels · 45° gable')
  await expect(page.locator('.model-tree').first()).toContainText('2 storey')
  await expect(page.getByRole('button', { name: 'Open garden fixtures' })).toContainText('6 placed')
  const initialInspector = page.locator('.inspector')
  await initialInspector.getByRole('button', { name: /Old apple tree/ }).click()
  const appleActions = initialInspector.getByRole('region', { name: 'Actions for Old apple tree' })
  await expect(appleActions).toContainText('Retained site feature')
  await appleActions.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByRole('status')).toContainText('Old apple tree unlocked')
  await expect(appleActions.getByRole('button', { name: 'Move' })).toBeEnabled()
  await expect(initialInspector).toContainText('Editable')
  await page.keyboard.press('Control+z')
  await expect(appleActions.getByRole('button', { name: 'Unlock' })).toBeVisible()
  await page.getByRole('button', { name: 'Edit openings on courtyard living' }).click()
  const openingEditor = page.getByRole('region', { name: 'Openings on courtyard living' })
  await expect(openingEditor).toBeVisible()
  await expect(openingEditor.locator('.opening-row')).toHaveCount(2)
  const finishEditor = openingEditor.getByRole('region', { name: 'Wall finish for courtyard living' })
  await finishEditor.getByRole('button', { name: /Natural timber/ }).click()
  await expect(finishEditor.getByRole('textbox', { name: 'Wall color hex' })).toHaveValue('#8A6544')
  await finishEditor.getByRole('button', { name: 'Apply to this wall' }).click()
  await expect(page.getByRole('status')).toContainText('Natural timber applied to selected wall.')
  await page.locator('.viewport').screenshot({ path: 'test-results/project-v2-natural-timber-wall.png' })
  await page.keyboard.press('Control+z')
  await expect(page.getByRole('status')).toContainText('Last change undone.')
  const wallScans = finishEditor.getByRole('group', { name: 'Wall scan' })
  await expect(wallScans.getByRole('button')).toHaveCount(6)
  await finishEditor.getByRole('button', { name: /^Brick/ }).click()
  await expect(wallScans.getByRole('button', { name: /Red brick/ })).toHaveAttribute('aria-pressed', 'true')
  await wallScans.getByRole('button', { name: /Dark brick pavers/ }).click()
  await expect(wallScans.getByRole('button', { name: /Dark brick pavers/ })).toHaveAttribute('aria-pressed', 'true')
  await finishEditor.getByRole('button', { name: 'Apply to this wall' }).click()
  await expect(page.getByRole('status')).toContainText('Brick applied to selected wall.')
  await page.locator('.viewport').screenshot({ path: 'test-results/project-v2-brick-pavers-wall.png' })
  await page.keyboard.press('Control+z')
  await expect(page.getByRole('status')).toContainText('Last change undone.')
  await page.evaluate(async () => { await (window as unknown as { __projectV2WebMcpTools: Record<string, { execute: (input: unknown) => Promise<unknown> }> }).__projectV2WebMcpTools.set_viewer_state.execute({ focusRef: 'zone/lawn' }) })
  const groundScans = page.getByRole('group', { name: 'Ground scan for Open courtyard lawn' })
  await expect(groundScans.getByRole('button', { name: /Leafy grass/ })).toHaveAttribute('aria-pressed', 'true')
  await groundScans.getByRole('button', { name: /River pebbles/ }).click()
  await expect(page.getByRole('status')).toContainText('Open courtyard lawn now wears River pebbles.')
  await expect.poll(() => textureLoads.filter((path) => path.endsWith('/textures/dry_river_pebbles/diff_1k.jpg')).length, { timeout: 20_000 }).toBeGreaterThan(0)
  await page.locator('.viewport').screenshot({ path: 'test-results/project-v2-pebble-lawn.png' })
  await page.keyboard.press('Control+z')
  await expect(page.getByRole('status')).toContainText('Last change undone.')
  await page.getByRole('button', { name: 'Edit openings on courtyard living' }).click()
  await openingEditor.getByRole('button', { name: /Center window/ }).click()
  await expect(openingEditor.locator('.opening-row')).toHaveCount(1)
  await expect(openingEditor.getByRole('button', { name: /Center window/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('status')).toContainText('Center window applied.')
  await page.locator('.inspector').screenshot({ path: 'test-results/project-v2-facade-layouts.png' })
  await page.keyboard.press('Control+z')
  await expect(openingEditor.locator('.opening-row')).toHaveCount(2)
  await openingEditor.getByRole('button', { name: 'Remove opening opening/living-balcony-door' }).click()
  await expect(openingEditor.locator('.opening-row')).toHaveCount(1)
  await expect(page.getByRole('status')).toContainText('Opening removed and wall closed.')
  await page.keyboard.press('Control+z')
  await expect(openingEditor.locator('.opening-row')).toHaveCount(2)
  await expect(page.getByRole('status')).toContainText('Last change undone.')
  const refocus = page.getByRole('button', { name: 'Refocus on Main house' })
  await expect(refocus).toBeVisible()
  await expect(page.getByRole('button', { name: 'Plan', exact: true })).toHaveCount(0)
  await refocus.click()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveClass(/active/)
  await expect(page.getByRole('status')).toContainText('Camera refocused on L-shaped modern barn.')

  const explode = page.getByRole('button', { name: 'Explode', exact: true })
  await explode.click()
  await expect(explode).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('Exploded room view')).toContainText('5 rooms · 2 levels · roof separated')
  await expect(page.locator('.exploded-room-label')).toHaveCount(5)
  await expect(page.locator('.exploded-room-label').nth(0)).toContainText('Kitchen and studio')
  await expect(page.locator('.exploded-room-label').nth(1)).toContainText('Dining and family room')
  await expect(page.locator('.exploded-room-label').nth(2)).toContainText('Double-height living room')
  const upperRoomLabels = page.locator('.exploded-room-label[data-storey-ref="house/main/storey-upper"]')
  await expect(upperRoomLabels).toHaveCount(2)
  await expect(upperRoomLabels.nth(0)).toContainText('Upper gallery')
  await expect(upperRoomLabels.nth(1)).toContainText('Upper wing')
  await page.waitForTimeout(900)
  await page.locator('.viewport').screenshot({ path: 'test-results/project-v2-exploded-rooms.png' })
  await explode.click()
  await expect(explode).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.exploded-room-label')).toHaveCount(0)

  await expect(page.getByRole('button', { name: 'Realistic' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Technical' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Angle', exact: true })).toHaveCount(0)
  const canvas = page.getByRole('application', { name: 'Interactive ProjectV2 spatial editor' })
  const canvasBounds = await canvas.boundingBox(); if (!canvasBounds) throw new Error('Canvas bounds unavailable.')
  await page.getByRole('button', { name: 'Length', exact: true }).click()
  await expect(page.getByLabel('Length measurement instructions')).toContainText('Click point 1, then point 2')
  await canvas.click({ position: { x: canvasBounds.width * 0.28, y: canvasBounds.height * 0.48 } })
  await expect(page.getByRole('status')).toContainText('First point placed. Click the second point.')
  await canvas.click({ position: { x: canvasBounds.width * 0.48, y: canvasBounds.height * 0.62 } })
  await expect(page.locator('.spatial-measurement-label.length')).toBeVisible()
  await expect(page.locator('.spatial-measurement-label.length')).toContainText(/\d+\.\d{2} m/)
  await page.getByRole('button', { name: 'Area', exact: true }).click()
  await expect(page.getByLabel('Area measurement instructions')).toContainText('Hold and drag a rectangle on the ground')
  await page.mouse.move(canvasBounds.x + canvasBounds.width * 0.2, canvasBounds.y + canvasBounds.height * 0.42)
  await page.mouse.down()
  await page.mouse.move(canvasBounds.x + canvasBounds.width * 0.46, canvasBounds.y + canvasBounds.height * 0.64, { steps: 8 })
  await page.mouse.up()
  await expect(page.locator('.spatial-measurement-label.area')).toBeVisible()
  await expect(page.locator('.spatial-measurement-label.area')).toContainText(/\d+\.\d{2} m²/)
  await page.locator('.viewport').screenshot({ path: 'test-results/project-v2-area-measurement.png' })
  await page.getByLabel('Area measurement instructions').getByRole('button', { name: 'Clear' }).click()
  await expect(page.locator('.spatial-measurement-label.area')).toBeHidden()
  await page.getByRole('button', { name: 'Height', exact: true }).click()
  await expect(page.getByLabel('Height measurement instructions')).toContainText('Select an object')
  await expect(page.getByRole('combobox', { name: 'Height reference' })).toHaveValue('auto')
  await expect(page.locator('.spatial-measurement-label.height')).toBeVisible()
  await page.getByRole('combobox', { name: 'Height reference' }).selectOption('ground-to-ridge')
  await expect(page.locator('.spatial-measurement-label.height')).toContainText('Ground to ridge')
  await expect(page.locator('.spatial-measurement-label.height')).toContainText('abs.')
  await page.locator('.viewport').screenshot({ path: 'test-results/project-v2-height-measurement.png' })
  await expect(page.getByRole('button', { name: 'Section', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.locator('.viewport').screenshot({ path: 'test-results/project-v2-editor.png' })

  const sunWidget = page.getByRole('region', { name: 'Sun controls' })
  await expect(sunWidget).toBeVisible()
  await expect(sunWidget).toContainText('Altitude')
  await expect(sunWidget).toContainText('Azimuth')
  const beforeSun = await page.locator('.viewport').screenshot()
  await sunWidget.getByRole('slider', { name: 'Local time' }).fill('7')
  await page.waitForTimeout(500)
  const afterSun = await page.locator('.viewport').screenshot()
  expect(Buffer.compare(beforeSun, afterSun)).not.toBe(0)
  await sunWidget.getByRole('button', { name: 'Sun hours' }).click()
  await expect(page.getByLabel('Sun hours legend')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(600)
  await page.locator('.viewport').screenshot({ path: 'test-results/project-v2-sun-hours.png' })
  await sunWidget.getByRole('button', { name: 'Sun hours' }).click()
  await expect(page.getByLabel('Sun hours legend')).toBeHidden()
  await sunWidget.getByRole('slider', { name: 'Local time' }).fill('14')

  await page.getByRole('button', { name: 'Open garden fixtures' }).click()
  const fixtures = page.getByRole('region', { name: 'Garden fixture library' })
  await expect(fixtures).toBeVisible()
  await expect(fixtures.locator('.fixture-row')).toHaveCount(9)
  await expect(fixtures).toContainText('Starter kitchen garden')
  await expect(fixtures).toContainText('Teak dining set')
  await expect(fixtures).toContainText('Garden lounge set')
  await expect(fixtures).toContainText('Cantilever parasol')
  await expect(fixtures).toContainText('Tomato row')
  await expect(fixtures).toContainText('Potato row')
  await expect(fixtures).toContainText('Cucumber trellis')
  await expect(page.getByRole('status')).toContainText('Camera focused on the placed garden fixtures.')
  await page.waitForTimeout(700)
  await fixtures.screenshot({ path: 'test-results/project-v2-garden-fixtures.png' })
  await fixtures.getByRole('button', { name: 'View placed' }).click()
  await expect(fixtures).toBeHidden()
  await page.waitForTimeout(700)
  await page.locator('.viewport').screenshot({ path: 'test-results/project-v2-garden-scene.png' })
  await page.getByRole('button', { name: 'Open garden fixtures' }).click()
  const diningRow = fixtures.locator('.fixture-row').filter({ hasText: 'Teak dining set' })
  await diningRow.getByRole('button', { name: 'Add' }).click()
  await expect(diningRow).toContainText('1 placed')
  await fixtures.getByRole('button', { name: 'Close garden fixtures' }).click()
  await page.waitForTimeout(700)
  await page.locator('.viewport').screenshot({ path: 'test-results/project-v2-outdoor-dining-set.png' })
  await page.keyboard.press('Control+z')
  await expect(page.getByRole('button', { name: 'Open garden fixtures' })).toContainText('6 placed')

  await page.getByRole('button', { name: 'Climate' }).click()
  const climate = page.getByRole('region', { name: 'Monthly temperature by part of day' })
  await expect(climate).toBeVisible()
  await expect(climate.getByText('Temperature through the day')).toBeVisible()
  await expect(climate.locator('.climate-table tbody tr')).toHaveCount(12)
  await expect(climate.locator('.daypart-readout')).toContainText('Night')
  await expect(climate.locator('.daypart-readout')).toContainText('Morning')
  await expect(climate.locator('.daypart-readout')).toContainText('Day')
  await expect(climate.locator('.daypart-readout')).toContainText('Evening')
  await climate.getByRole('button', { name: 'Show Jan climate in the scene' }).click()
  await expect(climate.locator('.climate-detail')).toContainText('JAN / MONTH 1')
  await climate.screenshot({ path: 'test-results/project-v2-climate-dayparts.png' })
  await climate.getByRole('button', { name: 'Close climate panel' }).click()
  await expect(climate).toBeHidden()

  await page.getByRole('button', { name: 'Planting' }).click()
  const planting = page.getByRole('region', { name: 'Planting guide and soil analysis' })
  await expect(planting).toBeVisible()
  await expect(planting.getByText('Known ground conditions')).toBeVisible()
  await expect(planting.getByText("Blackcurrant 'Ben Alder'", { exact: true })).toBeVisible()
  await expect(planting.getByText('Black chokeberry', { exact: true })).toBeVisible()
  await expect(planting.getByText('Common elder', { exact: true })).toBeVisible()
  await expect(planting.locator('.fit.best-fit')).toHaveCount(3)
  await expect(planting.getByText('Tomato', { exact: true })).toBeVisible()
  await expect(planting.getByText('Potato', { exact: true })).toBeVisible()
  await expect(planting.getByText('Cucumber', { exact: true })).toBeVisible()
  await expect(planting.getByText('Apple tree', { exact: true })).toBeVisible()
  await expect(planting.getByText('Sour cherry', { exact: true })).toBeVisible()
  await expect(planting.getByText('pH and fertility')).toBeVisible()
  const plantingFontSizes = await planting.evaluate((panel) => [
    panel.querySelector('.soil-summary'),
    panel.querySelector('.soil-findings p'),
    panel.querySelector('.plant-list article > p'),
  ].map((element) => element ? Number.parseFloat(getComputedStyle(element).fontSize) : 0))
  expect(Math.min(...plantingFontSizes)).toBeGreaterThanOrEqual(11)
  const panelZIndex = await planting.evaluate((panel) => Number.parseInt(getComputedStyle(panel).zIndex, 10))
  const sceneLabelZIndexes = await page.locator('.sun-tick-label, .compass-label, .site-entrance-label').evaluateAll((labels) => labels.map((label) => {
    let element: Element | null = label
    let highestZIndex = 0
    while (element && element !== document.body) {
      const zIndex = Number.parseInt(getComputedStyle(element).zIndex, 10)
      if (Number.isFinite(zIndex)) highestZIndex = Math.max(highestZIndex, zIndex)
      element = element.parentElement
    }
    return highestZIndex
  }))
  expect(Math.max(...sceneLabelZIndexes)).toBeLessThan(panelZIndex)
  await planting.screenshot({ path: 'test-results/project-v2-planting-guide.png' })
  await planting.getByRole('button', { name: 'Close planting guide' }).click()
  await expect(planting).toBeHidden()

  await page.getByRole('button', { name: 'MCP Tools' }).click()
  const catalog = page.getByRole('region', { name: 'WebMCP tool catalog' })
  await expect(catalog).toBeVisible()
  await expect(catalog.locator('.tool-browser nav button')).toHaveCount(11)
  await expect(catalog.getByRole('link', { name: 'Open JSON' })).toHaveAttribute('href', /webmcp-tools\.json$/)
  await catalog.getByRole('searchbox', { name: 'Search tools' }).fill('run_analysis')
  await expect(catalog.locator('.tool-browser nav button')).toHaveCount(1)
  await expect(catalog.locator('.tool-detail')).toContainText('Run seasonal or sunlight analysis')
  await expect(catalog.locator('.tool-document')).toContainText('<role>')
  await expect(catalog.locator('.tool-document')).toContainText('<example_output>')
  await catalog.getByRole('button', { name: 'Input schema' }).click()
  await expect(catalog.locator('.tool-document')).toContainText('months')
  await catalog.getByRole('button', { name: 'Example' }).click()
  await expect(catalog.locator('.tool-document')).toContainText('1')
  await catalog.getByRole('button', { name: 'Result shape' }).click()
  await expect(catalog.locator('.tool-document')).toContainText('temperatureByDayPartC')
  const manifestSummary = await page.evaluate(async () => {
    const value = await fetch(new URL('webmcp-tools.json', document.baseURI)).then((response) => response.json()) as { toolCount: number; source: string; tools: Array<{ name: string }> }
    return {
      toolCount: value.toolCount,
      source: value.source,
      operationTypes: (value as unknown as { operations: Array<{ type: string }> }).operations.length,
      budgetTokens: (value as unknown as { budget: { estimatedTokens: number } }).budget.estimatedTokens < 5000,
      names: value.tools.map((tool) => tool.name),
    }
  })
  expect(manifestSummary).toEqual({
    toolCount: 11,
    source: 'runtime-zod-and-structured-prompts',
    operationTypes: 18,
    budgetTokens: true,
    names: ['get_project_state', 'get_site_knowledge', 'get_proposals', 'list_catalog', 'measure_height', 'run_analysis', 'show_structure_views', 'set_viewer_state', 'propose_change', 'manage_change_set', 'manage_variant'],
  })
  await page.waitForFunction(() => Boolean((window as unknown as { __projectV2WebMcpTools?: Record<string, unknown> }).__projectV2WebMcpTools?.propose_change))
  const liveFacadeProof = await page.evaluate(async () => {
    const tools = (window as unknown as { __projectV2WebMcpTools: Record<string, { execute: (input: unknown) => Promise<{ content: Array<{ text: string }> }> }> }).__projectV2WebMcpTools
    const proposal = JSON.parse((await tools.propose_change.execute({ operations: [{ type: 'wall.opening-layout', buildingRef: 'house/main', wallRef: 'wall/courtyard-living', preset: 'solid-wall' }] })).content[0].text) as { status: string; variantRef: string }
    const state = JSON.parse((await tools.get_project_state.execute({ detail: 'structure' })).content[0].text) as { data: { buildings: Array<{ walls: Array<{ ref: string; openings: unknown[] }> }> } }
    const committedWall = state.data.buildings[0].walls.find((wall) => wall.ref === 'wall/courtyard-living')!
    const discarded = JSON.parse((await tools.manage_variant.execute({ action: 'discard', variantRef: proposal.variantRef })).content[0].text) as { status: string }
    return { proposalStatus: proposal.status, committedOpeningCount: committedWall.openings.length, discardStatus: discarded.status }
  })
  expect(liveFacadeProof).toEqual({ proposalStatus: 'variant_created', committedOpeningCount: 2, discardStatus: 'rejected' })
  const liveWallFinishProof = await page.evaluate(async () => {
    const tools = (window as unknown as { __projectV2WebMcpTools: Record<string, { execute: (input: unknown) => Promise<{ content: Array<{ text: string }> }> }> }).__projectV2WebMcpTools
    const proposal = JSON.parse((await tools.propose_change.execute({ operations: [{ type: 'wall.finish', buildingRef: 'house/main', scope: 'all-exterior', material: 'brick', colorHex: '#8B4E3C' }] })).content[0].text) as { status: string; variantRef: string }
    const state = JSON.parse((await tools.get_project_state.execute({ detail: 'structure' })).content[0].text) as { data: { buildings: Array<{ walls: Array<{ ref: string; finish?: { material: string } }> }> } }
    const committedWall = state.data.buildings[0].walls.find((wall) => wall.ref === 'wall/courtyard-right')!
    const discarded = JSON.parse((await tools.manage_variant.execute({ action: 'discard', variantRef: proposal.variantRef })).content[0].text) as { status: string }
    return { proposalStatus: proposal.status, committedMaterial: committedWall.finish?.material, discardStatus: discarded.status }
  })
  expect(liveWallFinishProof).toEqual({ proposalStatus: 'variant_created', committedMaterial: 'charred-timber', discardStatus: 'rejected' })
  await page.waitForFunction(() => Boolean((window as unknown as { __projectV2WebMcpTools?: Record<string, unknown> }).__projectV2WebMcpTools?.list_catalog))
  const liveGardenFixtureProof = await page.evaluate(async () => {
    const tools = (window as unknown as { __projectV2WebMcpTools: Record<string, { execute: (input: unknown) => Promise<{ content: Array<{ text: string }> }> }> }).__projectV2WebMcpTools
    const catalog = JSON.parse((await tools.list_catalog.execute({ catalog: 'garden-fixtures' })).content[0].text) as { data: Array<{ id: string }> }
    const proposal = JSON.parse((await tools.propose_change.execute({ operations: [{ type: 'garden-fixture.preset', preset: 'tomato-raised-bed', setRef: 'fixture-set/browser-tomato-2', placement: 'next-to-existing', rotationDegrees: 0 }] })).content[0].text) as { status: string; metrics: { fixtureCount: number } }
    const state = JSON.parse((await tools.get_project_state.execute({ detail: 'landscape' })).content[0].text) as { data: { landscape: { fixtures: unknown[] } } }
    return { catalogIds: catalog.data.map((fixture) => fixture.id), proposalStatus: proposal.status, proposedFixtureCount: proposal.metrics.fixtureCount, committedFixtureCount: state.data.landscape.fixtures.length }
  })
  expect(liveGardenFixtureProof).toEqual({
    catalogIds: ['outdoor-dining-set', 'garden-lounge-set', 'slatted-bench', 'sun-lounger', 'cantilever-parasol', 'raised-bed-2x1', 'tomato-row', 'potato-row', 'cucumber-trellis'],
    proposalStatus: 'variant_created',
    proposedFixtureCount: 8,
    committedFixtureCount: 6,
  })
  const liveAdjustmentProof = await page.evaluate(async () => {
    const tools = (window as unknown as { __projectV2WebMcpTools: Record<string, { execute: (input: unknown) => Promise<{ content: Array<{ text: string }> }> }> }).__projectV2WebMcpTools
    const storeyUpdate = JSON.parse((await tools.propose_change.execute({ operations: [{ type: 'storey.update', action: 'set-height', buildingRef: 'house/main', storeyRef: 'house/main/storey-upper', clearHeightM: 3.2 }] })).content[0].text) as { status: string; variantRef: string; areaAddedM2: number; levelCount: number }
    await tools.manage_variant.execute({ action: 'discard', variantRef: storeyUpdate.variantRef })
    const planting = JSON.parse((await tools.propose_change.execute({ operations: [{ type: 'planting.area', plantingRef: 'planting/browser-hornbeam', mode: 'boundary', sourceRefs: ['site'], inwardOffsetM: 1.2, spacingM: 5, rowCount: 1, rowSpacingM: 0.6, cornerTreatment: 'distribute', plantingPaletteRef: 'plant-guide/hornbeam', clearanceM: 1 }] })).content[0].text) as { status: string; variantRef: string; plantCount: number; affectedParcelRefs: string[] }
    await tools.manage_variant.execute({ action: 'discard', variantRef: planting.variantRef })
    await tools.manage_change_set.execute({ action: 'create', changeSetRef: 'change-set/browser-six-moves', label: 'Move complete kitchen garden', baseRevision: 1 })
    const operations = ['bed-tomato', 'crop-tomato', 'bed-potato', 'crop-potato', 'bed-cucumber', 'crop-cucumber'].map((suffix, index) => ({ type: 'garden-fixture.update', action: 'move', fixtureRef: `fixture-set/starter-1/${suffix}`, position: { x: 8.4 + Math.floor(index / 2) * 3.1, z: 25.5 } }))
    const draft = JSON.parse((await tools.manage_change_set.execute({ action: 'add-operations', changeSetRef: 'change-set/browser-six-moves', operations })).content[0].text) as { operations: unknown[] }
    const grouped = JSON.parse((await tools.manage_change_set.execute({ action: 'finalize', changeSetRef: 'change-set/browser-six-moves' })).content[0].text) as { status: string; variantRef: string; operations: unknown[] }
    await tools.manage_variant.execute({ action: 'discard', variantRef: grouped.variantRef })
    const height = JSON.parse((await tools.measure_height.execute({ mode: 'semantic', objectRef: 'opening/upper-east-north', measurement: 'opening-height' })).content[0].text) as { status: string; measurement: { heightM: number; bottomPoint: { reference: string }; topPoint: { reference: string } } }
    const roof = JSON.parse((await tools.propose_change.execute({ operations: [{ type: 'roof.update', buildingRef: 'house/main', segmentRef: 'roof/main/segment-rear-wing', material: 'standing-seam-metal', colorHex: '#364044', synchronization: 'roof-only' }] })).content[0].text) as { status: string; variantRef: string; targetScope: string; roofChanges: Array<{ after: { eavesElevationM: number; finish: { colorHex: string } } }> }
    await tools.manage_variant.execute({ action: 'discard', variantRef: roof.variantRef })
    return { storeyUpdate: { status: storeyUpdate.status, area: storeyUpdate.areaAddedM2, levels: storeyUpdate.levelCount }, planting: { status: planting.status, count: planting.plantCount, parcels: planting.affectedParcelRefs.length }, changeSet: { draftOps: draft.operations.length, variantOps: grouped.operations.length, status: grouped.status }, height, roof }
  })
  expect(liveAdjustmentProof).toMatchObject({
    storeyUpdate: { status: 'variant_created', area: 0, levels: 2 },
    planting: { status: 'variant_created', count: expect.any(Number), parcels: 6 },
    changeSet: { draftOps: 6, variantOps: 6, status: 'variant_created' },
    height: { status: 'ok', measurement: { heightM: 1.55, bottomPoint: { reference: 'opening/upper-east-north/sill' }, topPoint: { reference: 'opening/upper-east-north/head' } } },
    roof: { status: 'variant_created', targetScope: 'segment', roofChanges: [{ after: { eavesElevationM: 6.55, finish: { colorHex: '#364044' } } }] },
  })
  expect(liveAdjustmentProof.planting.count).toBeGreaterThan(40)
  const liveSunProof = await page.evaluate(async () => {
    const tools = (window as unknown as { __projectV2WebMcpTools: Record<string, { execute: (input: unknown) => Promise<{ content: Array<{ text: string }> }> }> }).__projectV2WebMcpTools
    const analysis = JSON.parse((await tools.run_analysis.execute({ kind: 'sunlight', targetRef: 'zone/terrace', month: 9, day: 21 })).content[0].text) as { status: string; analysis: { sunHours: { mean: number }; expectedSunHours: number } }
    const sun = JSON.parse((await tools.set_viewer_state.execute({ sunTime: { month: 12, day: 21, hour: 12 } })).content[0].text) as { status: string; projectRevision: number; altitudeDeg: number }
    await tools.set_viewer_state.execute({ sunTime: { month: 7, day: 15, hour: 14 } })
    return { analysisStatus: analysis.status, meanIsNumber: typeof analysis.analysis.sunHours.mean === 'number', expectedBelowMean: analysis.analysis.expectedSunHours <= analysis.analysis.sunHours.mean, sunStatus: sun.status, revision: sun.projectRevision, altitude: Math.round(sun.altitudeDeg) }
  })
  expect(liveSunProof).toEqual({ analysisStatus: 'ok', meanIsNumber: true, expectedBelowMean: true, sunStatus: 'ok', revision: 1, altitude: 16 })
  await page.evaluate(async () => {
    const browserWindow = window as unknown as { __projectV2WebMcpTools: Record<string, { execute: (input: unknown) => Promise<{ content: Array<{ text: string }> }> }>; __pendingAdjustmentApproval?: Promise<unknown> }
    const proposal = JSON.parse((await browserWindow.__projectV2WebMcpTools.propose_change.execute({ operations: [{ type: 'storey.update', action: 'set-height', buildingRef: 'house/main', storeyRef: 'house/main/storey-upper', clearHeightM: 3.2 }] })).content[0].text) as { variantRef: string }
    browserWindow.__pendingAdjustmentApproval = browserWindow.__projectV2WebMcpTools.manage_variant.execute({ action: 'request-apply', variantRef: proposal.variantRef })
  })
  const approval = page.locator('.approval')
  await expect(approval).toBeVisible()
  await expect(approval).toContainText('Storey update')
  await expect(approval).toContainText('300.0 m²')
  await expect(approval.getByLabel('Variant operation audit').locator('li')).toHaveCount(1)
  await approval.screenshot({ path: 'test-results/project-v2-storey-update-approval.png' })
  await approval.getByRole('button', { name: 'Reject all' }).click()
  await expect(approval).toBeHidden()
  await catalog.screenshot({ path: 'test-results/project-v2-mcp-tools.png' })
  await catalog.getByRole('button', { name: 'Close MCP tools' }).click()
  await expect(catalog).toBeHidden()

  const sunStudy = await page.evaluate(async () => {
    const tools = (window as unknown as { __projectV2WebMcpTools: Record<string, { execute: (input: unknown) => Promise<{ content: Array<{ text: string }> }> }> }).__projectV2WebMcpTools
    return JSON.parse((await tools.show_structure_views.execute({ mode: 'custom', views: [{ type: 'sun-study', month: 6, day: 21, hour: 15 }] })).content[0].text) as { status: string; views: Array<{ type: string; title: string }> }
  })
  expect(sunStudy.status).toBe('ok')
  expect(sunStudy.views).toEqual([expect.objectContaining({ type: 'sun-study', title: 'Sun study, 21 Jun 15:00' })])
  const sunReport = page.getByRole('region', { name: 'Architectural structure report' })
  await expect(sunReport).toBeVisible({ timeout: 60_000 })
  await expect(sunReport.locator('.thumbs button span')).toHaveText(['Sun study, 21 Jun 15:00'])
  await sunReport.screenshot({ path: 'test-results/project-v2-sun-study.png' })
  await sunReport.getByRole('button', { name: 'Close report' }).click()
  await expect(sunReport).toBeHidden()
  const inspector = page.locator('.inspector')
  await inspector.getByRole('button', { name: /Hydrangea group/ }).click()
  const objectActions = inspector.getByRole('region', { name: 'Actions for Hydrangea group' })
  await expect(objectActions.getByRole('button', { name: 'Move' })).toBeVisible()
  await objectActions.getByRole('button', { name: 'Delete' }).click()
  await expect(objectActions).toContainText('Nothing changes until approval.')
  await objectActions.getByRole('button', { name: 'Create delete proposal' }).click()
  await expect(approval).toBeVisible()
  await expect(approval).toContainText('Delete Hydrangea group')
  await approval.getByRole('button', { name: 'Reject all' }).click()
  await page.getByRole('button', { name: /Proposals/ }).click()
  let proposalsPanel = page.getByRole('region', { name: 'Proposal review and history' })
  await proposalsPanel.getByRole('button', { name: /Rejected/ }).click()
  await expect(proposalsPanel).toContainText('Delete Hydrangea group')
  await page.waitForTimeout(500)
  await page.reload()
  await page.getByRole('dialog', { name: 'Where do you want to plan today?' }).getByRole('button', { name: /Continue · / }).click()
  await expect(page.locator('.connection')).toContainText('WebMCP ready')
  await page.getByRole('button', { name: /Proposals/ }).click()
  proposalsPanel = page.getByRole('region', { name: 'Proposal review and history' })
  await proposalsPanel.getByRole('button', { name: /Rejected/ }).click()
  await expect(proposalsPanel).toContainText('Delete Hydrangea group')
  await proposalsPanel.screenshot({ path: 'test-results/project-v2-proposal-history.png' })
  await proposalsPanel.getByRole('button', { name: /Pending/ }).click()
  await proposalsPanel.getByRole('button', { name: 'Review in scene' }).click()
  await expect(approval).toBeVisible()
  await expect(approval).toContainText('tomato raised bed addition')
  await approval.getByRole('button', { name: 'Reject all' }).click()

  await page.getByRole('button', { name: 'Architectural set' }).click()
  const report = page.getByRole('region', { name: 'Architectural structure report' })
  await expect(report).toBeVisible({ timeout: 60_000 })
  await expect(report.locator('.thumbs button')).toHaveCount(10)
  await expect(report.locator('.thumbs button span')).toHaveText(['Site plan', 'North elevation', 'South elevation', 'East elevation', 'West elevation', 'Axonometric overview', 'Ground storey plan', 'Upper storey plan', 'Longitudinal section', 'Transverse section'])
  await expect(report.locator('.placement tbody tr')).toHaveCount(1)
  await expect(report.locator('.placement tbody')).toContainText('L-shaped modern barn')
  await expect(report.locator('.placement tbody')).toContainText('0.00 / -1.00 m')
  await expect(report.locator('.drawing img')).toHaveAttribute('src', /^blob:/)
  await report.screenshot({ path: 'test-results/project-v2-architectural-report.png' })

  const revokedBeforeArchitecturalClose = await page.evaluate(() => (window as unknown as { __projectV2RevokedUrls: string[] }).__projectV2RevokedUrls.length)
  await report.getByRole('button', { name: 'Close report' }).click()
  await expect(report).toBeHidden()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __projectV2RevokedUrls: string[] }).__projectV2RevokedUrls.length)).toBe(revokedBeforeArchitecturalClose + 10)
  await page.waitForFunction(() => Boolean((window as unknown as { __projectV2WebMcpTools?: Record<string, unknown> }).__projectV2WebMcpTools?.show_structure_views))
  const variantResult = await page.evaluate(async () => {
    const tools = (window as unknown as { __projectV2WebMcpTools: Record<string, { execute: (input: unknown) => Promise<{ content: Array<{ text: string }> }> }> }).__projectV2WebMcpTools
    const proposal = JSON.parse((await tools.propose_change.execute({ operations: [{ type: 'building.update', action: 'move', buildingRef: 'house/main', position: { x: 2, z: -1 } }] })).content[0].text)
    const result = JSON.parse((await tools.show_structure_views.execute({ mode: 'custom', variantRef: proposal.variantRef, views: [{ type: 'axonometric' }] })).content[0].text)
    const state = JSON.parse((await tools.get_project_state.execute({ detail: 'summary' })).content[0].text)
    return { result, revisionAfterReport: state.projectRevision }
  })
  expect(JSON.stringify(variantResult.result)).not.toMatch(/blob:|data:image|imageUrl/)
  expect(variantResult.revisionAfterReport).toBe(1)
  await expect(report).toBeVisible({ timeout: 60_000 })
  await expect(report.locator('.thumbs button')).toHaveCount(1)
  await expect(report.locator('.placement tbody')).toContainText('2.00 / -1.00 m')
  const revokedBeforeVariantClose = await page.evaluate(() => (window as unknown as { __projectV2RevokedUrls: string[] }).__projectV2RevokedUrls.length)
  await report.getByRole('button', { name: 'Close report' }).click()
  await expect(report).toBeHidden()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __projectV2RevokedUrls: string[] }).__projectV2RevokedUrls.length)).toBe(revokedBeforeVariantClose + 1)
  await expect(page.locator('canvas')).toHaveCount(1)
  expect(errors).toEqual([])
})

test('house remains visible when zoomed out across the long plot', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await page.setViewportSize({ width: 1059, height: 1270 })
  await page.goto(appUrl, { waitUntil: 'networkidle' })
  await page.getByRole('dialog', { name: 'Where do you want to plan today?' }).getByRole('button', { name: /Zielonki house study/ }).click()
  const viewport = page.locator('.viewport'); await expect(viewport).toBeVisible()
  await expect(viewport.locator('canvas')).toHaveCount(1)
  const box = await viewport.boundingBox(); if (!box) throw new Error('Viewport bounds unavailable.')
  const canvas = viewport.locator('canvas')
  await canvas.hover()
  const beforeKeyboardPan = await viewport.screenshot()
  await page.keyboard.press('ArrowUp')
  await page.waitForTimeout(500)
  const afterKeyboardPan = await viewport.screenshot()
  expect(Buffer.compare(beforeKeyboardPan, afterKeyboardPan)).not.toBe(0)
  const middleDragStart = await viewport.screenshot()
  await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.72)
  await page.mouse.down({ button: 'middle' })
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.58, { steps: 8 })
  await page.mouse.up({ button: 'middle' })
  await page.waitForTimeout(500)
  const middleDragEnd = await viewport.screenshot()
  expect(Buffer.compare(middleDragStart, middleDragEnd)).not.toBe(0)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, 1000)
  await page.waitForTimeout(700)
  await viewport.screenshot({ path: 'test-results/project-v2-zoomed-out.png' })
  await expect(page.getByLabel('Garden navigation controls')).toContainText('hold wheel + drag')
  await expect(page.getByLabel('Land-use legend')).toContainText('Garden / agricultural land')
  await expect(page.getByLabel('Land-use legend')).toContainText('Road entrance')
  await expect(page.locator('.site-entrance-label')).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Refocus on Main house' })).toBeVisible()
  expect(errors).toEqual([])
})

test('editor remains usable when optional garden models cannot be loaded', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  let blockedModelRequests = 0
  await page.route('**/models/garden/*.glb', (route) => {
    blockedModelRequests += 1
    return route.abort('failed')
  })
  await page.goto(appUrl, { waitUntil: 'networkidle' })
  const startScreen = page.getByRole('dialog', { name: 'Where do you want to plan today?' })
  await startScreen.getByRole('button', { name: /Zielonki house study/ }).click()
  await expect(startScreen).toBeHidden()
  await expect(page.locator('canvas')).toHaveCount(1)
  await expect(page.getByText('Spatial Editor', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Open garden fixtures' }).click()
  await expect(page.getByRole('region', { name: 'Garden fixture library' })).toBeVisible()
  await expect.poll(() => blockedModelRequests, { timeout: 20_000 }).toBeGreaterThan(0)
  expect(pageErrors.every((message) => /^Could not load \/.*\/models\/garden\/.*\.glb: Failed to fetch$/.test(message))).toBe(true)
})

const savedBuildingCount = (page: Page, name: string) => page.evaluate((projectName) => new Promise<number>((resolve) => {
  const request = indexedDB.open('house-web-mcp')
  request.onsuccess = () => {
    const database = request.result; const all = database.transaction('projects').objectStore('projects').getAll()
    all.onsuccess = () => { database.close(); const record = (all.result as Array<{ project?: { name: string; buildings: unknown[] } }>).find((item) => item?.project?.name === projectName); resolve(record?.project?.buildings.length ?? -1) }
  }
}), name)

test('creates a blank terrain from the start screen and returns to it after a reload', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(appUrl, { waitUntil: 'networkidle' })
  const startScreen = page.getByRole('dialog', { name: 'Where do you want to plan today?' })
  await expect(startScreen).toBeVisible()
  await expect(startScreen.getByRole('button', { name: /Continue/ })).toHaveCount(0)
  await startScreen.getByRole('button', { name: /New terrain/ }).click()
  const form = startScreen.getByRole('form', { name: 'New terrain' })
  await form.getByLabel('Plot name').fill('Test plot')
  await form.getByLabel('Width (m)').fill('30')
  await form.getByLabel('Depth (m)').fill('40')
  await form.getByLabel('North (°)').fill('15')
  await form.getByLabel('Latitude').fill('52.23')
  await form.getByLabel('Longitude').fill('21.01')
  await form.getByLabel('Timezone').selectOption('Europe/Warsaw')
  await form.getByRole('button', { name: 'Create terrain' }).click()
  await expect(startScreen).toBeHidden()
  await expect(page.locator('.brand')).toContainText('Test plot')
  await expect(page.getByRole('status')).toContainText('Test plot created')
  await expect(page.locator('.inspector')).toContainText('No buildings yet')
  await expect(page.getByRole('region', { name: 'Sun controls' })).toContainText('sunrise')
  await page.getByRole('button', { name: 'Add a house' }).click()
  await expect(page.getByRole('status')).toContainText('House added')
  await expect(page.locator('.wall-tree button')).toHaveCount(6)
  await expect(page.getByRole('button', { name: /Modern barn/ })).toBeVisible()
  // the autosave must hold the house before the page goes away
  await expect.poll(() => savedBuildingCount(page, 'Test plot'), { timeout: 10_000 }).toBe(1)
  await page.reload({ waitUntil: 'networkidle' })
  const again = page.getByRole('dialog', { name: 'Where do you want to plan today?' })
  await expect(again).toBeVisible()
  await again.getByRole('button', { name: /Continue · Test plot/ }).click()
  await expect(again).toBeHidden()
  await expect(page.locator('.brand')).toContainText('Test plot')
  await expect(page.locator('.wall-tree button')).toHaveCount(6)
  await page.getByRole('button', { name: 'Projects' }).click()
  await expect(again).toBeVisible()
  await expect(again).toContainText('Test plot')
  await again.getByRole('button', { name: /Zielonki house study/ }).click()
  await expect(again).toBeHidden()
  await expect(page.getByText('L-shaped modern barn')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open garden fixtures' })).toContainText('6 placed')
  expect(errors).toEqual([])
})
