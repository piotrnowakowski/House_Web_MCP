import { expect, test } from '@playwright/test'

test('ProjectV2 editor and architectural report work in one real canvas', async ({ page }) => {
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
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' })

  await expect(page.locator('canvas')).toHaveCount(1)
  await expect(page.getByText('Spatial Editor', { exact: true })).toBeVisible()
  await expect(page.getByText('PROJECTV2 / SEMANTIC MODEL')).toBeVisible()
  await expect(page.getByText('L-shaped modern barn')).toBeVisible()
  const modernBarn = page.getByRole('button', { name: /Modern barn/ })
  await expect(modernBarn).toHaveClass(/active/)
  await expect(modernBarn).toContainText('2 levels · 45° gable')
  await expect(page.locator('.model-tree').first()).toContainText('2 storey')
  await expect(page.getByRole('button', { name: 'Open garden fixtures' })).toContainText('6 placed')
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
  await page.getByRole('button', { name: 'Plan', exact: true }).click()
  await refocus.click()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveClass(/active/)
  await expect(page.getByRole('status')).toContainText('Camera refocused on L-shaped modern barn.')

  const explode = page.getByRole('button', { name: 'Explode', exact: true })
  await explode.click()
  await expect(explode).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('Exploded room view')).toContainText('4 rooms · 2 levels · roof separated')
  await expect(page.locator('.exploded-room-label')).toHaveCount(4)
  await expect(page.locator('.exploded-room-label').nth(0)).toContainText('Kitchen and studio')
  await expect(page.locator('.exploded-room-label').nth(1)).toContainText('Dining and family room')
  await expect(page.locator('.exploded-room-label').nth(2)).toContainText('Double-height living room')
  await expect(page.locator('.exploded-room-label[data-storey-ref="house/main/storey-upper"]')).toContainText('Upper gallery')
  await page.waitForTimeout(900)
  await page.locator('.viewport').screenshot({ path: 'test-results/project-v2-exploded-rooms.png' })
  await explode.click()
  await expect(explode).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.exploded-room-label')).toHaveCount(0)

  await page.getByRole('button', { name: 'Realistic' }).click()
  await expect(page.getByRole('button', { name: 'Technical' })).toBeVisible()
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
  for (const mode of ['Section', 'Plan', 'Edit']) await page.getByRole('button', { name: mode, exact: true }).click()
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
  await expect(fixtures.locator('.fixture-row')).toHaveCount(4)
  await expect(fixtures).toContainText('Starter kitchen garden')
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
  await expect(planting.getByText('Tomato', { exact: true })).toBeVisible()
  await expect(planting.getByText('Potato', { exact: true })).toBeVisible()
  await expect(planting.getByText('Cucumber', { exact: true })).toBeVisible()
  await expect(planting.getByText('Apple tree', { exact: true })).toBeVisible()
  await expect(planting.getByText('Sour cherry', { exact: true })).toBeVisible()
  await expect(planting.getByText('pH and fertility')).toBeVisible()
  await planting.screenshot({ path: 'test-results/project-v2-planting-guide.png' })
  await planting.getByRole('button', { name: 'Close planting guide' }).click()
  await expect(planting).toBeHidden()

  await page.getByRole('button', { name: 'MCP Tools' }).click()
  const catalog = page.getByRole('region', { name: 'WebMCP tool catalog' })
  await expect(catalog).toBeVisible()
  await expect(catalog.locator('.tool-browser nav button')).toHaveCount(33)
  await expect(catalog.getByRole('link', { name: 'Open JSON' })).toHaveAttribute('href', /webmcp-tools\.json$/)
  await catalog.getByRole('searchbox', { name: 'Search tools' }).fill('run_seasonal_analysis')
  await expect(catalog.locator('.tool-browser nav button')).toHaveCount(1)
  await expect(catalog.locator('.tool-detail')).toContainText('Run seasonal analysis')
  await expect(catalog.locator('.tool-document')).toContainText('<role>')
  await expect(catalog.locator('.tool-document')).toContainText('<example_output>')
  await catalog.getByRole('button', { name: 'Input schema' }).click()
  await expect(catalog.locator('.tool-document')).toContainText('months')
  await catalog.getByRole('button', { name: 'Example' }).click()
  await expect(catalog.locator('.tool-document')).toContainText('1')
  await catalog.getByRole('button', { name: 'Result shape' }).click()
  await expect(catalog.locator('.tool-document')).toContainText('temperatureByDayPartC')
  const manifestSummary = await page.evaluate(async () => {
    const value = await fetch('/webmcp-tools.json').then((response) => response.json()) as { toolCount: number; source: string; tools: Array<{ name: string }> }
    return {
      toolCount: value.toolCount,
      source: value.source,
      gardenTools: value.tools.map((tool) => tool.name).filter((name) => name.includes('garden_fixture')),
      adjustmentTools: value.tools.map((tool) => tool.name).filter((name) => ['propose_planting_area', 'create_change_set', 'add_change_set_operations', 'propose_change_set', 'discard_change_set', 'measure_height', 'run_sunlight_analysis', 'set_sun_time'].includes(name)),
    }
  })
  expect(manifestSummary).toEqual({
    toolCount: 33,
    source: 'runtime-zod-and-structured-prompts',
    gardenTools: ['list_garden_fixtures', 'propose_garden_fixture_update', 'propose_garden_fixture_set'],
    adjustmentTools: ['propose_planting_area', 'create_change_set', 'add_change_set_operations', 'propose_change_set', 'discard_change_set', 'measure_height', 'run_sunlight_analysis', 'set_sun_time'],
  })
  await page.waitForFunction(() => Boolean((window as unknown as { __projectV2WebMcpTools?: Record<string, unknown> }).__projectV2WebMcpTools?.propose_wall_opening_layout))
  const liveFacadeProof = await page.evaluate(async () => {
    const tools = (window as unknown as { __projectV2WebMcpTools: Record<string, { execute: (input: unknown) => Promise<{ content: Array<{ text: string }> }> }> }).__projectV2WebMcpTools
    const proposal = JSON.parse((await tools.propose_wall_opening_layout.execute({ buildingRef: 'house/main', wallRef: 'wall/courtyard-living', preset: 'solid-wall' })).content[0].text) as { status: string; variantRef: string }
    const state = JSON.parse((await tools.get_project_state.execute({ detail: 'structure' })).content[0].text) as { data: { buildings: Array<{ walls: Array<{ ref: string; openings: unknown[] }> }> } }
    const committedWall = state.data.buildings[0].walls.find((wall) => wall.ref === 'wall/courtyard-living')!
    const discarded = JSON.parse((await tools.discard_variant.execute({ variantRef: proposal.variantRef })).content[0].text) as { status: string }
    return { proposalStatus: proposal.status, committedOpeningCount: committedWall.openings.length, discardStatus: discarded.status }
  })
  expect(liveFacadeProof).toEqual({ proposalStatus: 'variant_created', committedOpeningCount: 2, discardStatus: 'ok' })
  const liveWallFinishProof = await page.evaluate(async () => {
    const tools = (window as unknown as { __projectV2WebMcpTools: Record<string, { execute: (input: unknown) => Promise<{ content: Array<{ text: string }> }> }> }).__projectV2WebMcpTools
    const proposal = JSON.parse((await tools.propose_wall_finish_update.execute({ buildingRef: 'house/main', scope: 'all-exterior', material: 'brick', colorHex: '#8B4E3C' })).content[0].text) as { status: string; variantRef: string }
    const state = JSON.parse((await tools.get_project_state.execute({ detail: 'structure' })).content[0].text) as { data: { buildings: Array<{ walls: Array<{ ref: string; finish?: { material: string } }> }> } }
    const committedWall = state.data.buildings[0].walls.find((wall) => wall.ref === 'wall/courtyard-right')!
    const discarded = JSON.parse((await tools.discard_variant.execute({ variantRef: proposal.variantRef })).content[0].text) as { status: string }
    return { proposalStatus: proposal.status, committedMaterial: committedWall.finish?.material, discardStatus: discarded.status }
  })
  expect(liveWallFinishProof).toEqual({ proposalStatus: 'variant_created', committedMaterial: 'charred-timber', discardStatus: 'ok' })
  await page.waitForFunction(() => Boolean((window as unknown as { __projectV2WebMcpTools?: Record<string, unknown> }).__projectV2WebMcpTools?.list_garden_fixtures))
  const liveGardenFixtureProof = await page.evaluate(async () => {
    const tools = (window as unknown as { __projectV2WebMcpTools: Record<string, { execute: (input: unknown) => Promise<{ content: Array<{ text: string }> }> }> }).__projectV2WebMcpTools
    const catalog = JSON.parse((await tools.list_garden_fixtures.execute({})).content[0].text) as { data: Array<{ id: string }> }
    const proposal = JSON.parse((await tools.propose_garden_fixture_set.execute({ preset: 'tomato-raised-bed', setRef: 'fixture-set/browser-tomato-2', placement: 'next-to-existing', rotationDegrees: 0 })).content[0].text) as { status: string; metrics: { fixtureCount: number } }
    const state = JSON.parse((await tools.get_project_state.execute({ detail: 'landscape' })).content[0].text) as { data: { landscape: { fixtures: unknown[] } } }
    return { catalogIds: catalog.data.map((fixture) => fixture.id), proposalStatus: proposal.status, proposedFixtureCount: proposal.metrics.fixtureCount, committedFixtureCount: state.data.landscape.fixtures.length }
  })
  expect(liveGardenFixtureProof).toEqual({
    catalogIds: ['raised-bed-2x1', 'tomato-row', 'potato-row', 'cucumber-trellis'],
    proposalStatus: 'variant_created',
    proposedFixtureCount: 8,
    committedFixtureCount: 6,
  })
  const liveAdjustmentProof = await page.evaluate(async () => {
    const tools = (window as unknown as { __projectV2WebMcpTools: Record<string, { execute: (input: unknown) => Promise<{ content: Array<{ text: string }> }> }> }).__projectV2WebMcpTools
    const extension = JSON.parse((await tools.propose_storey_update.execute({ action: 'extend-footprint', buildingRef: 'house/main', storeyRef: 'house/main/storey-upper', extensionFootprint: [{ x: -8, z: -5 }, { x: 8, z: -5 }, { x: 8, z: 1 }, { x: -2, z: 1 }, { x: -8, z: 1 }], spaceRef: 'house/main/storey-upper/space-browser-wing' })).content[0].text) as { status: string; variantRef: string; areaAddedM2: number; levelCount: number }
    await tools.discard_variant.execute({ variantRef: extension.variantRef })
    const planting = JSON.parse((await tools.propose_planting_area.execute({ plantingRef: 'planting/browser-hornbeam', mode: 'boundary', sourceRefs: ['site'], inwardOffsetM: 1.2, spacingM: 5, rowCount: 1, rowSpacingM: 0.6, cornerTreatment: 'distribute', plantingPaletteRef: 'plant-guide/hornbeam', clearanceM: 1 })).content[0].text) as { status: string; variantRef: string; plantCount: number; affectedParcelRefs: string[] }
    await tools.discard_variant.execute({ variantRef: planting.variantRef })
    await tools.create_change_set.execute({ changeSetRef: 'change-set/browser-six-moves', label: 'Move complete kitchen garden', baseRevision: 1 })
    const operations = ['bed-tomato', 'crop-tomato', 'bed-potato', 'crop-potato', 'bed-cucumber', 'crop-cucumber'].map((suffix, index) => ({ type: 'garden-fixture.update', action: 'move', fixtureRef: `fixture-set/starter-1/${suffix}`, position: { x: 8.4 + Math.floor(index / 2) * 3.1, z: 25.5 } }))
    const draft = JSON.parse((await tools.add_change_set_operations.execute({ changeSetRef: 'change-set/browser-six-moves', operations })).content[0].text) as { operations: unknown[] }
    const grouped = JSON.parse((await tools.propose_change_set.execute({ changeSetRef: 'change-set/browser-six-moves' })).content[0].text) as { status: string; variantRef: string; operations: unknown[] }
    await tools.discard_variant.execute({ variantRef: grouped.variantRef })
    const height = JSON.parse((await tools.measure_height.execute({ mode: 'semantic', objectRef: 'opening/upper-east-north', measurement: 'opening-height' })).content[0].text) as { status: string; measurement: { heightM: number; bottomPoint: { reference: string }; topPoint: { reference: string } } }
    return { extension: { status: extension.status, area: extension.areaAddedM2, levels: extension.levelCount }, planting: { status: planting.status, count: planting.plantCount, parcels: planting.affectedParcelRefs.length }, changeSet: { draftOps: draft.operations.length, variantOps: grouped.operations.length, status: grouped.status }, height }
  })
  expect(liveAdjustmentProof).toMatchObject({
    extension: { status: 'variant_created', area: 96, levels: 2 },
    planting: { status: 'variant_created', count: expect.any(Number), parcels: 6 },
    changeSet: { draftOps: 6, variantOps: 6, status: 'variant_created' },
    height: { status: 'ok', measurement: { heightM: 1.55, bottomPoint: { reference: 'opening/upper-east-north/sill' }, topPoint: { reference: 'opening/upper-east-north/head' } } },
  })
  expect(liveAdjustmentProof.planting.count).toBeGreaterThan(40)
  const liveSunProof = await page.evaluate(async () => {
    const tools = (window as unknown as { __projectV2WebMcpTools: Record<string, { execute: (input: unknown) => Promise<{ content: Array<{ text: string }> }> }> }).__projectV2WebMcpTools
    const analysis = JSON.parse((await tools.run_sunlight_analysis.execute({ targetRef: 'zone/terrace', month: 9, day: 21 })).content[0].text) as { status: string; analysis: { sunHours: { mean: number }; expectedSunHours: number } }
    const sun = JSON.parse((await tools.set_sun_time.execute({ month: 12, day: 21, hour: 12 })).content[0].text) as { status: string; projectRevision: number; altitudeDeg: number }
    await tools.set_sun_time.execute({ month: 7, day: 15, hour: 14 })
    return { analysisStatus: analysis.status, meanIsNumber: typeof analysis.analysis.sunHours.mean === 'number', expectedBelowMean: analysis.analysis.expectedSunHours <= analysis.analysis.sunHours.mean, sunStatus: sun.status, revision: sun.projectRevision, altitude: Math.round(sun.altitudeDeg) }
  })
  expect(liveSunProof).toEqual({ analysisStatus: 'ok', meanIsNumber: true, expectedBelowMean: true, sunStatus: 'ok', revision: 1, altitude: 16 })
  await page.evaluate(async () => {
    const browserWindow = window as unknown as { __projectV2WebMcpTools: Record<string, { execute: (input: unknown) => Promise<{ content: Array<{ text: string }> }> }>; __pendingAdjustmentApproval?: Promise<unknown> }
    const proposal = JSON.parse((await browserWindow.__projectV2WebMcpTools.propose_storey_update.execute({ action: 'extend-footprint', buildingRef: 'house/main', storeyRef: 'house/main/storey-upper', extensionFootprint: [{ x: -8, z: -5 }, { x: 8, z: -5 }, { x: 8, z: 1 }, { x: -2, z: 1 }, { x: -8, z: 1 }], spaceRef: 'house/main/storey-upper/space-approval-proof' })).content[0].text) as { variantRef: string }
    browserWindow.__pendingAdjustmentApproval = browserWindow.__projectV2WebMcpTools.request_apply_variant.execute({ variantRef: proposal.variantRef })
  })
  const approval = page.locator('.approval')
  await expect(approval).toBeVisible()
  await expect(approval).toContainText('Storey footprint extension')
  await expect(approval).toContainText('300.0 m²')
  await expect(approval.getByLabel('Variant operation audit').locator('li')).toHaveCount(1)
  await approval.screenshot({ path: 'test-results/project-v2-storey-extension-approval.png' })
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

  await report.getByRole('button', { name: 'Close report' }).click()
  await expect(report).toBeHidden()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __projectV2RevokedUrls: string[] }).__projectV2RevokedUrls.length)).toBe(11)
  await page.waitForFunction(() => Boolean((window as unknown as { __projectV2WebMcpTools?: Record<string, unknown> }).__projectV2WebMcpTools?.show_structure_views))
  const variantResult = await page.evaluate(async () => {
    const tools = (window as unknown as { __projectV2WebMcpTools: Record<string, { execute: (input: unknown) => Promise<{ content: Array<{ text: string }> }> }> }).__projectV2WebMcpTools
    const proposal = JSON.parse((await tools.propose_building_update.execute({ action: 'move', buildingRef: 'house/main', position: { x: 2, z: -1 } })).content[0].text)
    const result = JSON.parse((await tools.show_structure_views.execute({ mode: 'custom', variantRef: proposal.variantRef, views: [{ type: 'axonometric' }] })).content[0].text)
    const state = JSON.parse((await tools.get_project_state.execute({ detail: 'summary' })).content[0].text)
    return { result, revisionAfterReport: state.projectRevision }
  })
  expect(JSON.stringify(variantResult.result)).not.toMatch(/blob:|data:image|imageUrl/)
  expect(variantResult.revisionAfterReport).toBe(1)
  await expect(report).toBeVisible({ timeout: 60_000 })
  await expect(report.locator('.thumbs button')).toHaveCount(1)
  await expect(report.locator('.placement tbody')).toContainText('2.00 / -1.00 m')
  await report.getByRole('button', { name: 'Close report' }).click()
  await expect(report).toBeHidden()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __projectV2RevokedUrls: string[] }).__projectV2RevokedUrls.length)).toBe(12)
  await expect(page.locator('canvas')).toHaveCount(1)
  expect(errors).toEqual([])
})

test('house remains visible when zoomed out across the long plot', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await page.setViewportSize({ width: 1059, height: 1270 })
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' })
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
