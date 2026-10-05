import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import data from '../../project-data/zielonki-rear-bath-room/project.json'
import beforeData from '../../project-data/zielonki-rear-bath-room/before-attic-bathroom-r24.json'
import { atticClearanceAt } from '../domain/attic'
import { validateProject } from '../domain/commands'
import { pointInPolygon, pointOnPolygonBoundary } from '../domain/geometry'
import { interiorCorners } from '../domain/interior'
import { placementWarnings } from '../domain/interiorPlacement'
import { roomDimensions } from '../domain/roomDimensions'
import { parseProject } from '../domain/schema'
import { loadWorkspace, saveWorkspace } from './persistence'

const project = parseProject(data)
const before = parseProject(beforeData)
const house = project.buildings.find((building) => building.ref === 'house/main')!
const upper = house.storeys.find((storey) => storey.ref === 'storey/reference-upper')!
const bathroom = house.spaces.find((space) => space.ref === 'space/reference-bathroom')!
const bounds = roomDimensions(house, bathroom)
const bathroomItems = house.furniture!.filter((item) => item.ref.startsWith('interior/shared-upper-bath/'))

describe('attic bathroom with a compact freestanding bath', () => {
  it('fits every bathroom item inside 2.14 x 2.70 m without door or overlap warnings', () => {
    expect(validateProject(project).filter((issue) => issue.severity === 'error')).toEqual([])
    expect(bounds.width).toBeCloseTo(2.14)
    expect(bounds.depth).toBeCloseTo(2.7)
    expect(bounds.area).toBeCloseTo(5.778)

    const bath = bathroomItems.find((item) => item.ref.endsWith('/bathtub'))!
    expect([bath.widthM, bath.depthM, bath.rotationDegrees]).toEqual([0.72, 1.5, 90])
    expect(bath.catalogId).toBe('compact-freestanding-bathtub')

    for (const item of bathroomItems) {
      expect(
        interiorCorners(item).every((corner) => pointInPolygon(corner, bounds.footprint) || pointOnPolygonBoundary(corner, bounds.footprint)),
        item.ref,
      ).toBe(true)
      expect(placementWarnings(item, house, upper).filter((warning) => warning.kind !== 'circulation'), item.ref).toEqual([])
    }
  })

  it('keeps WC and stepped wall storage below the measured attic slope', () => {
    const wc = bathroomItems.find((item) => item.ref.endsWith('/wc'))!
    expect(atticClearanceAt(house, upper, wc.position)).toBeGreaterThanOrEqual(1.95)

    const cabinets = bathroomItems.filter((item) => item.catalogId === 'bathroom-step-cabinet')
    expect(cabinets).toHaveLength(3)
    for (const cabinet of cabinets) {
      const top = (cabinet.elevationM ?? 0) + cabinet.heightM
      const minimumClearance = Math.min(...interiorCorners(cabinet).map((corner) => atticClearanceAt(house, upper, corner)))
      expect(top, cabinet.ref).toBeLessThanOrEqual(minimumClearance)
    }
  })

  it('changes no roof geometry and survives a save/reload cycle with finishes', async () => {
    expect(house.roof).toEqual(before.buildings.find((building) => building.ref === 'house/main')!.roof)
    expect(bathroom.floorFinish?.presetId).toBe('sand-tile')
    expect(bathroom.ceilingFinish?.presetId).toBe('warm-white')
    for (const wallRef of bathroom.boundary.map((edge) => edge.wallRef)) {
      expect(house.walls.find((wall) => wall.ref === wallRef)?.faceFinishes?.left?.presetId, wallRef).toBe('sand-tile')
    }

    globalThis.indexedDB = new IDBFactory()
    await saveWorkspace({ version: 1, project, proposals: [], draftChangeSets: [] })
    expect((await loadWorkspace(project.ref))?.project).toEqual(project)
  })
})
