import { describe, expect, it } from 'vitest'
import data from '../../project-data/zielonki-rear-bath-room/project.json'
import { calculateMetrics } from './commands'
import { parseProject } from './schema'

describe('floor area metrics', () => {
  it('reports the Zielonki house floor inside room walls without the living void or stair opening', () => {
    const project = parseProject(data)

    expect(calculateMetrics(project).homeAreaM2).toBeCloseTo(163.6251, 4)
  })
})
