import beforeBrowserCapture from '../../project-data/zielonki/before-browser-capture-r46.json'
import { describe, expect, it } from 'vitest'
import publishedData from '../../project-data/zielonki/before-site-restoration-r49.json'
import previousData from '../../project-data/zielonki/published-base-r44.json'
import neighborBaseline from '../../project-data/zielonki/published-base-r45.json'
import distanceEvidence from '../../knowledge-bank/zielonki/neighbor-distance-evidence.json'
import { surveyOrigin, surveyToModel, zielonkiOrientation } from '../../knowledge-bank/zielonki/orientation'
import { neighborSurface, neighborViewpoint, rayHitsNeighbor } from './neighbors'
import { collectOccluders, isLitAt } from './sunlight'
import { sunDirectionModel } from './solar'
import { calculateMetrics } from './commands'
import { parseProject } from './schema'
import { mergeProjects } from './projectMerge'
import { polygonArea, pointInPolygon } from './geometry'
import type { NeighborBuilding } from './types'

const publishedProject = parseProject(publishedData)

const cube: NeighborBuilding = { ref: 'neighbor/test', name: 'Test', footprint: [{ x: -2, z: -2 }, { x: 2, z: -2 }, { x: 2, z: 2 }, { x: -2, z: 2 }], groundElevationM: 0, eavesHeightM: 3, ridgeHeightM: 5, ridgeDirectionDegrees: 0, roofType: 'gable', footprintSource: 'test', footprintConfidence: 'map-derived', heightConfidence: 'estimated', sourceDate: '2026-09-10' }

describe('survey orientation and neighbor context', () => {
  it('places the formerly estimated house at the independent cadastral coordinates', () => {
    const before = parseProject(neighborBaseline)
    const corrected = publishedProject.site.neighbors!.find((n) => n.ref === distanceEvidence.neighborRef)!
    const expected = distanceEvidence.cadastralExterior.slice(0, -1).map((p) => surveyToModel(p.easting, p.northing))
    expect(corrected.footprint).toHaveLength(expected.length)
    corrected.footprint.forEach((point, i) => {
      expect(point.x).toBeCloseTo(expected[i].x, 3)
      expect(point.z).toBeCloseTo(expected[i].z, 3)
    })
    expect(publishedProject.site.neighbors!.slice(0, 7)).toEqual(before.site.neighbors!.slice(0, 7))
    expect(publishedProject.buildings).toEqual(before.buildings)
    expect(beforeBrowserCapture.landscape).toEqual(before.landscape)
    expect(publishedProject.site.northDegrees).toBe(before.site.northDegrees)
  })

  it('merges the footprint correction with independent edits and keeps conflicting moves local', () => {
    const before = parseProject(neighborBaseline), local = structuredClone(before)
    const neighbor = local.site.neighbors!.find((n) => n.ref === distanceEvidence.neighborRef)!
    neighbor.ridgeHeightM = 8
    local.landscape.plants.pop()
    const merged = mergeProjects(before, local, publishedProject)
    expect(merged.conflicts).toEqual([])
    expect(merged.project.site.neighbors!.at(-1)!.ridgeHeightM).toBe(8)
    expect(merged.project.site.neighbors!.at(-1)!.footprint).toEqual(publishedProject.site.neighbors!.at(-1)!.footprint)
    expect(merged.project.landscape.plants).toHaveLength(5)
    neighbor.footprint[0].x += 1
    const conflict = mergeProjects(before, local, publishedProject)
    expect(conflict.conflicts).toContain(`/site/neighbors/${neighbor.ref}/footprint`)
    expect(conflict.project.site.neighbors!.at(-1)!.footprint).toEqual(neighbor.footprint)
  })

  it('matches the signed CAD basis and true north, including meridian convergence', () => {
    expect(surveyToModel(surveyOrigin.easting, surveyOrigin.northing)).toEqual({ x: 0, z: -0 })
    const gridNorth = surveyToModel(surveyOrigin.easting, surveyOrigin.northing + 1)
    expect(gridNorth.x).toBeCloseTo(-0.8353, 3)
    expect(gridNorth.z).toBeCloseTo(-0.5497, 3)
    const trueNorth = sunDirectionModel(0, 0, zielonkiOrientation.northDegrees)
    // PROJ constant-longitude step: EN unit vector approximately (+0.014706, +0.999892).
    const surveyedTrueNorth = surveyToModel(surveyOrigin.easting + 0.014706, surveyOrigin.northing + 0.999892)
    expect(trueNorth.x).toBeCloseTo(surveyedTrueNorth.x, 5)
    expect(trueNorth.z).toBeCloseTo(surveyedTrueNorth.z, 5)
    const east = sunDirectionModel(90, 0, zielonkiOrientation.northDegrees)
    expect(east.x).toBeGreaterThan(0)
    expect(east.z).toBeLessThan(0)
  })

  it('keeps the surveyed footprints, owner geometry and metrics separate', () => {
    const before = parseProject(previousData)
    expect(publishedProject.site.neighbors).toHaveLength(8)
    expect(polygonArea(publishedProject.site.neighbors![0].footprint)).toBeCloseTo(117.72, 0)
    expect(publishedProject.buildings).toEqual(before.buildings)
    expect(beforeBrowserCapture.landscape).toEqual(before.landscape)
    expect(publishedProject.site.boundary).toEqual(before.site.boundary)
    expect(calculateMetrics(parseProject(beforeBrowserCapture))).toEqual(calculateMetrics(before))
    expect(parseProject(publishedProject).site.neighbors).toEqual(publishedProject.site.neighbors)
    expect(parseProject(previousData).site.neighbors).toBeUndefined()
  })

  it('uses roof triangles, including the ridge and eave, for shading', () => {
    const s = neighborSurface(cube), triangles = [...s.walls, ...s.roof]
    expect(rayHitsNeighbor({ x: -5, y: 4, z: 0 }, { x: 1, y: 0, z: 0 }, triangles)).toBe(true)
    expect(rayHitsNeighbor({ x: -5, y: 4, z: 1.8 }, { x: 1, y: 0, z: 0 }, triangles)).toBe(false)
    expect(rayHitsNeighbor({ x: 0, y: 10, z: 0 }, { x: 0, y: -1, z: 0 }, triangles)).toBe(true)
    for (const building of publishedProject.site.neighbors!) {
      const surface = neighborSurface(building)
      expect([...surface.walls, ...surface.roof].every(Number.isFinite)).toBe(true)
      expect(surface.roof.length).toBeGreaterThan(8)
      for (let i = 0; i < surface.roof.length; i += 9) {
        const r = surface.roof
        const normalY = (r[i + 5] - r[i + 2]) * (r[i + 6] - r[i]) - (r[i + 3] - r[i]) * (r[i + 8] - r[i + 2])
        expect(normalY).toBeGreaterThan(0)
      }
      const eye = neighborViewpoint(building, publishedProject.buildings[0].position, 1.6)
      expect(pointInPolygon(eye, building.footprint)).toBe(false)
      expect(eye.y).toBeCloseTo(building.groundElevationM + 1.6)
    }
  })

  it('can compare sun with neighbors enabled and disabled without editing project data', () => {
    const project = structuredClone(publishedProject)
    project.buildings = []; project.landscape.plants = []; project.landscape.fixtures = []
    project.site.northDegrees = 0
    project.site.neighbors = [{ ...cube, eavesHeightM: 30, ridgeHeightM: 30, roofType: 'flat', footprint: [{ x: -50, z: -10 }, { x: 50, z: -10 }, { x: 50, z: -3 }, { x: -50, z: -3 }] }]
    const point = { x: 0, y: 1, z: 0 }, time = { month: 12, day: 21, hour: 12 }
    expect(isLitAt(project, collectOccluders(project, false), point, time)).toBe(true)
    expect(isLitAt(project, collectOccluders(project, true), point, time)).toBe(false)
  })

  it('merges the new layer while preserving local deletions and reporting north conflicts', () => {
    const before = parseProject(previousData), local = structuredClone(before)
    local.landscape.plants.pop()
    const merged = mergeProjects(before, local, publishedProject)
    expect(merged.conflicts).toEqual([])
    expect(merged.project.site.neighbors).toEqual(publishedProject.site.neighbors)
    expect(merged.project.site.northDegrees).toBe(zielonkiOrientation.northDegrees)
    expect(merged.project.landscape.plants).toHaveLength(5)
    local.site.northDegrees = -100
    expect(mergeProjects(before, local, publishedProject).conflicts).toContain('/site/northDegrees')
  })
})
