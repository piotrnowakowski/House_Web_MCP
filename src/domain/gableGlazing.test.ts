import { describe, expect, it } from 'vitest'
import { validateProject } from './commands'
import { gableGlazingProfile } from './gableGlazing'
import { pointInPolygon, polygonBounds, polygonArea, wallLength } from './geometry'
import { createReferenceHouse } from './referenceHouse'
import { modernBarnProject } from './sampleProject'
import { parseProject } from './schema'
import { fitZielonkiInterior, upgradeZielonkiGlazing } from './zielonkiInterior'
import publishedData from '../../project-data/zielonki/before-triangle-windows-r50.json'

describe('ICON gables and full-height living room', () => {
  it('cuts the whole former mezzanine floor while retaining bedrooms, stairs and the flat garage roof', () => {
    const project = fitZielonkiInterior(modernBarnProject, createReferenceHouse())
    const b = project.buildings[0]
    const upper = b.slabs.find((s) => s.ref === 'slab/reference-upper')!
    expect(upper.holes).toHaveLength(2)
    expect(polygonArea(upper.holes![1])).toBeCloseTo(7.09 * 7.35, 4)
    expect(b.spaces.some((s) => s.ref === 'space/reference-mezzanine')).toBe(false)
    expect(b.spaces.filter((s) => s.usage === 'bedroom')).toHaveLength(3)
    expect(b.walls.flatMap((w) => w.openings).some((o) => o.ref === 'opening/reference-mezzanine-access')).toBe(false)
    expect(b.roof.segments.find((s) => s.ref.endsWith('/garage-cap'))?.type).toBe('flat')
    expect(validateProject(project).filter((i) => i.severity === 'error')).toEqual([])
  })

  it('aligns both gables with the windows below and follows subsequent roof pitches', () => {
    const project = fitZielonkiInterior(modernBarnProject, createReferenceHouse())
    const b = project.buildings[0]
    for (const [suffix, side, openingRef] of [['rear-barn', 'max', 'opening/reference-terrace-east'], ['front-barn', 'min', 'opening/reference-terrace-north']] as const) {
      const segment = b.roof.segments.find((s) => s.ref.endsWith(suffix))!
      for (const pitch of [37, 45]) {
        segment.pitchDegrees = pitch
        const profile = gableGlazingProfile(segment, side)!
        expect(profile).not.toBeNull()
        expect(profile.panels[0].opening.every((p) => pointInPolygon(p, profile.outline))).toBe(true)
        const openingBounds = polygonBounds(profile.panels[0].opening)
        const across = segment.ridgeDirection === 'z' ? 'x' : 'z'
        for (const ref of [openingRef, `${segment.ref}/glazing-upper`]) {
          const wall = b.walls.find((w) => w.openings.some((o) => o.ref === ref))!
          const opening = wall.openings.find((o) => o.ref === ref)!
          const center = wall.start[across] + (wall.end[across] - wall.start[across]) * opening.offsetM / wallLength(wall)
          expect(center - opening.widthM / 2).toBeCloseTo(openingBounds.minX, 5)
          expect(center + opening.widthM / 2).toBeCloseTo(openingBounds.maxX, 5)
        }
      }
    }
    expect(parseProject(project)).toEqual(project)
    expect(upgradeZielonkiGlazing(project)).toBe(project)
  })
})

describe('bedroom glazing above the garage', () => {
  it('extends each balcony door as a separate trapezoid with a continuous central mullion', () => {
    const building = parseProject(publishedData).buildings[0]
    const roof = building.roof.segments.find((segment) => segment.ref.endsWith('/front-barn'))!
    for (const pitch of [37, 40.13423424862029, 45]) {
      roof.pitchDegrees = pitch
      const profile = gableGlazingProfile(roof, 'max', building)!
      expect(profile.panels).toHaveLength(2)
      for (const [index, ref] of roof.gableGlazing!.max!.hostOpeningRefs!.entries()) {
        const wall = building.walls.find((wall) => wall.openings.some((opening) => opening.ref === ref))!
        const door = wall.openings.find((opening) => opening.ref === ref)!
        const midpoint = wall.start.x + (wall.end.x - wall.start.x) * door.offsetM / wallLength(wall)
        const panel = profile.panels[index]
        const bounds = polygonBounds(panel.opening)
        expect(panel.opening).toHaveLength(4)
        expect(panel.opening.every((point) => pointInPolygon(point, profile.outline))).toBe(true)
        expect(bounds.minX).toBeCloseTo(midpoint - door.widthM / 2)
        expect(bounds.maxX).toBeCloseTo(midpoint + door.widthM / 2)
        expect(panel.mullions).toHaveLength(1)
        expect(panel.mullions[0].x).toBeCloseTo(midpoint)
        expect(panel.opening[2].z).not.toBeCloseTo(panel.opening[3].z)
      }
      expect(polygonBounds(profile.panels[0].opening).maxX).toBeLessThan(polygonBounds(profile.panels[1].opening).minX)
    }
  })

  it('follows balcony door edits and removes the hosted upper pane when its door is removed', () => {
    const project = parseProject(publishedData), building = project.buildings[0]
    const roof = building.roof.segments.find((segment) => segment.ref.endsWith('/front-barn'))!
    const ref = roof.gableGlazing!.max!.hostOpeningRefs![0]
    const wall = building.walls.find((wall) => wall.openings.some((opening) => opening.ref === ref))!
    wall.openings[0].widthM = 1.8
    const bounds = polygonBounds(gableGlazingProfile(roof, 'max', building)!.panels[0].opening)
    expect(bounds.maxX - bounds.minX).toBeCloseTo(1.8)
    expect(parseProject(project).buildings[0].roof.segments).toEqual(building.roof.segments)
    wall.openings = wall.openings.filter((opening) => opening.ref !== ref)
    expect(gableGlazingProfile(roof, 'max', building)!.panels).toHaveLength(1)
    expect(project.landscape.plants).toEqual(publishedData.landscape.plants)
  })
})
