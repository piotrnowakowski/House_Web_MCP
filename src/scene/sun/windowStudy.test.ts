import { describe, expect, it } from 'vitest'
import architekt from '../../../project-data/architekt-7-11/project.json'
import { parseProject } from '../../domain/schema'
import { pointInPolygon } from '../../domain/geometry'
import { roofWindowLayout } from '../../domain/roofWindows'
import { observerPointIssue } from './observer'
import { allBedroomWindows, studyObserver, windowStudies } from './windowStudy'

const project = parseProject(architekt)
const house = project.buildings.find(b => b.kind === 'house')!
const studies = windowStudies(house, project.site.northDegrees)
describe('temporary Architekt 7.11 window alternatives', () => {
  it('closes exactly the terrace-side opening, retaining both SW windows and the original project', () => {
    const [salon] = studies
    expect(salon.description).toContain('178 × 240 cm · północny zachód')
    const before = house.walls.flatMap(w => w.openings)
    const after = salon.alternative.walls.flatMap(w => w.openings)
    expect(after).toEqual(before.filter(o => o.ref !== 'opening/architekt/terrace-side'))
    expect(before.length - after.length).toBe(1)
    expect(salon.alternative.roof).toBe(house.roof)
  })
  it('places one new trial opening inside each bedroom on the correct slope, and retains the bathroom window', () => {
    expect(studies.slice(1).map(s => s.description)).toEqual([
      'Okno dachowe 78 × 118 cm · połać na północny wschód.',
      'Okno dachowe 78 × 118 cm · połać na południowy zachód.',
      'Okno dachowe 78 × 118 cm · połać na północny wschód.',
    ])
    for (const study of studies.slice(1)) {
      const roof = study.alternative.roof.segments.find(s => s.ref === 'roof/reference/front-barn')!
      const original = house.roof.segments.find(s => s.ref === roof.ref)!
      expect(roof.windows!.slice(0, -1)).toEqual(original.windows)
      expect(roofWindowLayout(roof, roof.windows!.at(-1)!).fits).toBe(true)
      expect(study.window.every(p => pointInPolygon(p, study.room))).toBe(true)
      expect(study.alternative.walls).toBe(house.walls)
    }
  })
  it('can add one opening to all three bedrooms in one reversible preview', () => {
    const combined = allBedroomWindows(house, studies)
    const roof = combined.roof.segments.find(s => s.ref === 'roof/reference/front-barn')!
    expect(new Set(roof.windows!.map(w => w.ref)).size).toBe(4)
    expect(house.roof.segments.find(s => s.ref === roof.ref)!.windows).toHaveLength(1)
    expect(combined.walls).toBe(house.walls)
  })
  it('starts the camera and the measurement point in the selected room', () => {
    for (const study of studies) {
      const point = studyObserver(house, study, 1.6)!
      expect(pointInPolygon(study.probe, study.room)).toBe(true)
      expect(pointInPolygon(point, study.room)).toBe(true)
      expect(observerPointIssue(house, study.storey, point, 1.6)).toBeNull()
    }
  })
})
