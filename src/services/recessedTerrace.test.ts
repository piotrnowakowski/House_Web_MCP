import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import data from '../../project-data/zielonki-rear-carport/before-ceiling-r117.json'
import before from '../../project-data/zielonki-rear-carport/before-recessed-terrace-r92.json'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { buildingFootprintsWorld, distanceToSegment } from '../domain/geometry'
import { gableGlazingProfile } from '../domain/gableGlazing'
import { gableRoofJunction, gableWallsForBuilding, roofWings } from '../domain/roofWings'
import { mergeProjects } from '../domain/projectMerge'
import { saveWorkspace, loadWorkspace } from './persistence'

it('resizes only the rear study, keeps aligned glazing and a joined compliant roof', () => {
  const p = parseProject(data), h = p.buildings[0], old = before.buildings[0]
  expect(validateProject(p).filter(i => i.severity === 'error')).toEqual([])
  expect(h.position).toEqual(old.position)
  expect(h.rotationDegrees).toEqual(old.rotationDegrees)
  const wall = (ref: string) => h.walls.find(w => w.ref === ref)!
  expect(wall('wall/carport-layout/ground/8').start.x).toBeCloseTo(-4.995)
  expect(wall('wall/carport-layout/ground/10').start.z).toBeCloseTo(3.575)
  expect(wall('wall/carport-layout/ground/16').start.z).toBeCloseTo(5.885)
  expect(wall('wall/reference-ground/2').start.x).toBeCloseTo(4.495)
  for (const wing of roofWings(h).filter(w => w.type === 'gable')) {
    expect(wing.ridgeElevationM).toBeCloseTo(7.7856938754, 8)
    const across = wing.ridgeAxis === 'z' ? 'x' : 'z'
    const span = Math.max(...wing.footprint.map(p => p[across])) - Math.min(...wing.footprint.map(p => p[across]))
    const angle = Math.atan((wing.ridgeElevationM - wing.baseElevationM) / (span / 2)) * 180 / Math.PI
    expect(angle).toBeGreaterThanOrEqual(37); expect(angle).toBeLessThanOrEqual(45)
  }
  const roof = h.roof.segments.find(s => s.ref.endsWith('/rear-barn'))!
  expect(gableRoofJunction(h, roofWings(h).find(w => w.ref === roof.ref)!)?.side).toBe('min')
  expect(gableWallsForBuilding(h).find(w => w.segmentRef === roof.ref)!.value).toBeCloseTo(4.585)
  expect(gableGlazingProfile(roof, 'max', h)!.panels).toHaveLength(2)
  const c = p.buildings[1], boundary = p.site.boundary
  const clearance = Math.min(...buildingFootprintsWorld(c).flat().flatMap(point => boundary.map((a, i) => distanceToSegment(point, a, boundary[(i + 1) % boundary.length]))))
  expect(clearance).toBeGreaterThanOrEqual(3)
  expect(clearance).toBeLessThan(3.02)
})

it('merges independent edits, retains deletions across reload and reports a deleted moved car', async () => {
  const base = parseProject(before), local = structuredClone(base)
  local.name = 'My rear study'
  local.buildings[0].furniture = local.buildings[0].furniture!.filter(i => i.ref !== 'interior/carport-study/desk')
  const merged = mergeProjects(base, local, parseProject(data))
  expect(merged.conflicts).toEqual([])
  await saveWorkspace({ version: 1, project: merged.project, proposals: [], draftChangeSets: [] })
  expect((await loadWorkspace(local.ref))!.project.buildings[0].furniture!.some(i => i.ref === 'interior/carport-study/desk')).toBe(false)
  local.buildings[1].furniture!.pop()
  expect(mergeProjects(base, local, parseProject(data)).conflicts.some(p => p.includes('interior/carport/car-2'))).toBe(true)
})
