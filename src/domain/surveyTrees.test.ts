import { describe, expect, it } from 'vitest'
import { legacySurveyTreePosition, registerTreeMapPoint, surveyTreeRef, treeMapRegistration, zielonkiSurveyTrees } from '../../knowledge-bank/zielonki/trees'
import { ensureStarterOrchard } from './orchard'
import { modernBarnProject } from './sampleProject'
import { parseProject } from './schema'
import { validateProject } from './commands'
import { collectOccluders } from './sunlight'
import { buildingFootprintsWorld, pointInPolygon } from './geometry'

const mapped = (project: typeof modernBarnProject) => project.landscape.plants.filter((plant) => plant.surveyHandle)

describe('survey tree inventory', () => {
  it('registers the PDF corners and puts the tree row at the garden edge, clear of the house', () => {
    treeMapRegistration.pdf.forEach((point, index) => {
      const transformed = registerTreeMapPoint(point)
      expect(transformed.x).toBeCloseTo(treeMapRegistration.model[index].x, 5)
      expect(transformed.z).toBeCloseTo(treeMapRegistration.model[index].z, 5)
    })
    const trees = mapped(modernBarnProject)
    const footprints = modernBarnProject.buildings.flatMap(buildingFootprintsWorld)
    expect(trees.every((tree) => footprints.every((footprint) => !pointInPolygon(tree.position, footprint)))).toBe(true)
    expect(trees.filter((tree) => tree.crownShape === 'conical').every((tree) => tree.position.z > 8 && tree.position.z < 16)).toBe(true)
    expect(trees.filter((tree) => tree.species === 'Unidentified fruit').every((tree) => tree.position.x > 10)).toBe(true)
    expect(zielonkiSurveyTrees).toHaveLength(17)
    expect(new Set(zielonkiSurveyTrees.map((tree) => tree.handle)).size).toBe(17)
    expect(zielonkiSurveyTrees.filter((tree) => tree.category === 'conifer')).toHaveLength(11)
    expect(zielonkiSurveyTrees.filter((tree) => tree.category === 'deciduous')).toHaveLength(3)
    expect(zielonkiSurveyTrees.filter((tree) => tree.category === 'fruit')).toHaveLength(3)
  })

  it('repairs a version-four save and removes the four duplicate placeholder trees once', () => {
    const old = structuredClone(modernBarnProject)
    old.landscape.orchardCatalogVersion = 4
    for (const source of zielonkiSurveyTrees) {
      const tree = old.landscape.plants.find((plant) => plant.ref === surveyTreeRef(source.handle))!
      const bad = { ...structuredClone(tree), ref: `plant/survey-${source.handle.toLowerCase()}`, position: legacySurveyTreePosition(source.easting, source.northing) }
      old.landscape.plants = old.landscape.plants.filter((plant) => plant.ref !== bad.ref)
      old.landscape.plants.push(bad)
    }
    expect(old.landscape.plants.filter((plant) => plant.kind === 'tree')).toHaveLength(21)
    const upgraded = ensureStarterOrchard(old)
    expect(mapped(upgraded)).toHaveLength(17)
    expect(new Set(mapped(upgraded).map((tree) => tree.surveyHandle)).size).toBe(17)
    expect(upgraded.landscape.plants.filter((plant) => plant.kind !== 'tree')).toEqual(old.landscape.plants.filter((plant) => plant.kind !== 'tree'))
    expect(upgraded.revision).toBe(old.revision + 1)
    upgraded.landscape.plants = upgraded.landscape.plants.filter((plant) => plant.ref !== 'plant/survey-5012')
    mapped(upgraded)[0].position.x += 2
    expect(ensureStarterOrchard(upgraded)).toEqual(upgraded)
    expect(old.landscape.plants.filter((plant) => plant.kind === 'tree')).toHaveLength(21)
  })

  it('persists neighbouring trees and crown shapes without relaxing the boundary rule for ordinary planting', () => {
    const restored = parseProject(modernBarnProject)
    expect(mapped(restored)).toEqual(mapped(modernBarnProject))
    expect(mapped(restored).filter((plant) => plant.placementRole === 'context')).toHaveLength(2)
    expect(validateProject(restored).filter((issue) => issue.code === 'plant.site')).toEqual([])
    const context = mapped(restored).find((plant) => plant.placementRole === 'context')!
    context.placementRole = 'site'
    expect(validateProject(restored).some((issue) => issue.code === 'plant.site' && issue.subjectRef === context.ref)).toBe(true)
    const occluders = collectOccluders(modernBarnProject)
    expect(mapped(restored).every((plant) => occluders.some((occluder) => occluder.ref === plant.ref))).toBe(true)
    expect(occluders.filter((occluder) => occluder.ref.startsWith('plant/survey-') && occluder.kind === 'convex')).toHaveLength(11)
  })
})
