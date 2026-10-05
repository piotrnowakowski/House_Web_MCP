/**
 * Brief: Record the real furnished-house interior, catalogue and mobile controls.
 * Input: local app at http://127.0.0.1:5187; invoked by the browser-demo-recorder skill.
 * Output: screenshots and timestamped findings in output/interior-editor; recorder writes video.
 * No environment variables. Does not change another browser profile or saved workspace.
 * Usage: node <skill>/scripts/record_demo.cjs --script demo-recording/interior.cjs --output-dir output/browser-demo-recording --name interior-walkthrough
 */
const { writeFile, mkdir } = require('node:fs/promises')

module.exports = async ({ page, step, wait }) => {
  const output = 'output/interior-editor'
  await mkdir(output, { recursive: true })
  const started = Date.now()
  const events = []
  const at = () => new Date(Date.now() - started).toISOString().slice(14, 19)
  page.on('pageerror', (error) => events.push({ at: at(), kind: 'exception', message: error.message }))
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type()))
      events.push({ at: at(), kind: message.type(), message: message.text() })
  })
  page.on('response', (response) => {
    if (response.status() >= 400)
      events.push({ at: at(), kind: 'response', status: response.status(), url: response.url() })
  })
  const caption = async (text) => {
    events.push({ at: at(), kind: 'step', message: text })
    await step(text)
    await page.evaluate(() => {
      const label = document.getElementById('__codex-demo-step')
      if (label) Object.assign(label.style, { top: 'auto', bottom: '80px', fontSize: '13px', maxWidth: '310px' })
    })
  }
  try {
    await page.goto('http://127.0.0.1:5187')
    await page.getByRole('button', { name: /Zielonki house study/ }).click()
    await page.getByRole('button', { name: 'House interior', exact: true }).click()
    await wait(3500)
    await page.screenshot({ path: `${output}/desktop-house.png` })
    await caption('A furnished house, with the canvas at the centre')
    await wait(1700)
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await wait(700)
    await page.screenshot({ path: `${output}/desktop-library.png` })
    await caption('24 dimensioned IKEA configurations; original reusable models')
    await wait(1800)
    await page.getByRole('searchbox', { name: 'Search furniture' }).fill('POÄNG')
    await wait(700)
    await page.getByRole('button', { name: 'Place POÄNG Bentwood armchair', exact: true }).click()
    await page.getByRole('button', { name: '2D Plan', exact: true }).click()
    await wait(400)
    // Inspect geometry to choose an empty legal location; placement itself uses the visible UI.
    const target = await page.evaluate(async () => {
      const { state, point } = await import('/tests/browser-harness.ts')
      const { createIkeaItem } = await import('/src/domain/ikeaCatalog.ts')
      const { itemFitsFloor } = await import('/src/domain/interior.ts')
      const { placementWarnings } = await import('/src/domain/interiorPlacement.ts')
      const building = state().project.buildings[0],
        storey = building.storeys[0]
      const slab = building.slabs.find((slab) => slab.ref === storey.baseSlabRef)
      const item = createIkeaItem('poang', storey.ref, { x: 0, z: 0 })
      const xs = slab.footprint.map((p) => p.x),
        zs = slab.footprint.map((p) => p.z)
      for (let x = Math.min(...xs) + 1; x < Math.max(...xs) - 1; x += 0.5)
        for (let z = Math.min(...zs) + 1; z < Math.max(...zs) - 1; z += 0.5) {
          item.position = { x, z }
          if (itemFitsFloor(item, slab.footprint, slab.holes) && !placementWarnings(item, building, storey).length)
            return point(x, z)
        }
      throw new Error('No free demonstration placement found')
    })
    await page.mouse.move(target.x, target.y, { steps: 12 })
    await wait(700)
    await page.mouse.click(target.x, target.y)
    await caption('Place directly, then rotate or enter exact values')
    await page.getByRole('button', { name: 'Rotate', exact: true }).click()
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await page.getByRole('button', { name: 'Adjust Rotation (°)', exact: true }).click()
    await page.getByRole('spinbutton', { name: 'Rotation (°)', exact: true }).fill('30')
    await wait(1600)
    await page.getByRole('button', { name: 'Apply changes', exact: true }).click()
    await page.getByRole('button', { name: 'Close panel', exact: true }).click()
    await page.getByRole('button', { name: '3D Interior', exact: true }).click()
    await wait(600)
    await page.setViewportSize({ width: 390, height: 844 })
    await wait(1000)
    await page.getByRole('button', { name: 'Fit floor in view', exact: true }).click()
    await wait(400)
    await page.evaluate(() => document.getElementById('__codex-demo-step')?.remove())
    await page.screenshot({ path: `${output}/mobile-house.png` })
    await caption('Mobile: one compact action bar and a full-height canvas')
    await wait(1800)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await page.getByRole('button', { name: 'Expand panel', exact: true }).click()
    await wait(500)
    await page.evaluate(() => document.getElementById('__codex-demo-step')?.remove())
    await page.screenshot({ path: `${output}/mobile-library.png` })
    await caption('One sheet for browsing; close it to restore the house')
    await wait(1700)
    await page.getByRole('button', { name: 'Close panel', exact: true }).click()
    await page.getByRole('button', { name: 'More', exact: true }).click()
    await page.getByRole('button', { name: 'Hide controls', exact: true }).click()
    await wait(1700)
    await page.getByRole('button', { name: 'Show controls', exact: true }).click()
    await page.getByRole('button', { name: 'Back to plot', exact: true }).click()
    await wait(2500)
    await page.getByRole('button', { name: 'Fit plot view', exact: true }).click()
    await wait(1400)
    await page.evaluate(() => document.getElementById('__codex-demo-step')?.remove())
    await page.screenshot({ path: `${output}/mobile-plot-house.png` })
    await caption('The plot uses the same mobile controls')
    await wait(1700)
  } finally {
    await writeFile(`${output}/walkthrough-findings.json`, JSON.stringify(events, null, 2))
  }
}
