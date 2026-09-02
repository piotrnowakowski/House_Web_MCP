import { applyCommands } from './commands'
import type { ProjectCommand, ProjectV2 } from './types'

export const isModernBarnPreset = (project: ProjectV2) => {
  const building = project.buildings.find((item) => item.ref === 'house/main') ?? project.buildings.find((item) => item.kind === 'house')
  return Boolean(building && building.architecturalStyle === 'barn' && building.storeys.length >= 2 && building.roof.type === 'gable' && building.roof.pitchDegrees === 45)
}

export const applyModernBarnPreset = (source: ProjectV2): ProjectV2 => {
  if (isModernBarnPreset(source)) return structuredClone(source)
  const building = source.buildings.find((item) => item.ref === 'house/main') ?? source.buildings.find((item) => item.kind === 'house')
  if (!building) return structuredClone(source)
  const commands: ProjectCommand[] = [{
    type: 'building.update',
    action: 'set-style',
    buildingRef: building.ref,
    architecturalStyle: 'barn',
  }]
  if (building.storeys.length < 2) commands.push({
    type: 'storey.update',
    action: 'add',
    buildingRef: building.ref,
    storeyRef: `${building.ref}/storey-upper`,
    name: 'Upper storey',
    clearHeightM: 2.9,
  })
  return applyCommands(source, commands)
}
