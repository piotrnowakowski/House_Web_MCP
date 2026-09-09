import { describe, expect, it } from 'vitest'
import { validateProject } from './commands'
import { gableGlazingProfile } from './gableGlazing'
import { pointInPolygon, polygonBounds, polygonArea, wallLength } from './geometry'
import { createReferenceHouse } from './referenceHouse'
import { modernBarnProject } from './sampleProject'
import { parseProject } from './schema'
import { fitZielonkiInterior, upgradeZielonkiGlazing } from './zielonkiInterior'

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
        expect(profile.opening.every((p) => pointInPolygon(p, profile.outline))).toBe(true)
        const openingBounds = polygonBounds(profile.opening)
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
