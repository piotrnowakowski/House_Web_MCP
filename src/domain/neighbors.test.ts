import { describe, expect, it } from 'vitest'
import { publishedProject } from '../services/publishedProject'
import previousData from '../../project-data/zielonki/published-base-r44.json'
import { surveyOrigin, surveyToModel, zielonkiOrientation } from '../../knowledge-bank/zielonki/orientation'
import { neighborSurface, neighborViewpoint, rayHitsNeighbor } from './neighbors'
import { collectOccluders, isLitAt } from './sunlight'
import { sunDirectionModel } from './solar'
import { calculateMetrics } from './commands'
import { parseProject } from './schema'
import { mergeProjects } from './projectMerge'
import { polygonArea, pointInPolygon } from './geometry'
import type { NeighborBuilding } from './types'

const cube: NeighborBuilding = { ref: 'neighbor/test', name: 'Test', footprint: [{ x: -2, z: -2 }, { x: 2, z: -2 }, { x: 2, z: 2 }, { x: -2, z: 2 }], groundElevationM: 0, eavesHeightM: 3, ridgeHeightM: 5, ridgeDirectionDegrees: 0, roofType: 'gable', footprintSource: 'test', footprintConfidence: 'map-derived', heightConfidence: 'estimated', sourceDate: '2026-09-10' }

describe('survey orientation and neighbor context', () => {
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
    expect(publishedProject.landscape).toEqual(before.landscape)
    expect(publishedProject.site.boundary).toEqual(before.site.boundary)
    expect(calculateMetrics(publishedProject)).toEqual(calculateMetrics(before))
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
