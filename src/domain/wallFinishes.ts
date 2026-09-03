import type { BuildingModel, ProjectV2, WallFinish, WallFinishUpdateCommand, WallMaterial, WallModel } from './types'

export type WallFinishScope = 'wall' | 'all-exterior'

export const wallFinishCatalog: Array<{ id: WallMaterial; label: string; description: string; defaultColor: string }> = [
  { id: 'charred-timber', label: 'Charred timber', description: 'Vertical dark boards', defaultColor: '#242927' },
  { id: 'natural-timber', label: 'Natural timber', description: 'Warm vertical boards', defaultColor: '#8A6544' },
  { id: 'light-render', label: 'Light render', description: 'Smooth mineral finish', defaultColor: '#DED9CC' },
  { id: 'brick', label: 'Brick', description: 'Textured masonry', defaultColor: '#8B4E3C' },
  { id: 'metal-panel', label: 'Metal panel', description: 'Standing-seam cladding', defaultColor: '#465052' },
]

export const defaultWallFinish = (style: BuildingModel['architecturalStyle']): WallFinish => style === 'barn'
  ? { material: 'charred-timber', colorHex: '#242927' }
  : { material: 'light-render', colorHex: '#E8E1D2' }

export const resolveWallFinish = (wall: WallModel | undefined, style: BuildingModel['architecturalStyle']): WallFinish => wall?.finish ?? defaultWallFinish(style)

export const exteriorWallsForBuilding = (building: BuildingModel) => building.walls.filter((wall) => building.spaces.filter((space) => space.boundary.some((boundary) => boundary.wallRef === wall.ref)).length <= 1)

export const wallFinishCommands = (project: ProjectV2, input: { buildingRef: string; scope: WallFinishScope; wallRef?: string; material: WallMaterial; colorHex: string }): WallFinishUpdateCommand[] => {
  const building = project.buildings.find((item) => item.ref === input.buildingRef)
  if (!building) throw new Error(`Building not found: ${input.buildingRef}`)
  if (!/^#[0-9a-fA-F]{6}$/.test(input.colorHex)) throw new Error('Wall color must be a six-digit hex value such as #242927.')
  const walls = input.scope === 'all-exterior'
    ? exteriorWallsForBuilding(building)
    : [building.walls.find((wall) => wall.ref === input.wallRef) ?? (() => { throw new Error(`Wall not found: ${input.wallRef ?? 'missing wallRef'}`) })()]
  return walls.map((wall) => ({ type: 'wall.finish', buildingRef: building.ref, wallRef: wall.ref, material: input.material, colorHex: input.colorHex.toUpperCase() }))
}
