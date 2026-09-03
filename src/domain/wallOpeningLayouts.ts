import { wallLength } from './geometry'
import type { OpeningUpdateCommand, ProjectV2, WallModel } from './types'

export type WallOpeningLayoutPreset = 'full-glass' | 'two-windows' | 'center-window' | 'balcony-door' | 'solid-wall'

export const wallOpeningLayoutPresets: Array<{ id: WallOpeningLayoutPreset; label: string; description: string }> = [
  { id: 'full-glass', label: 'Full glass', description: 'Nearly the complete wall' },
  { id: 'two-windows', label: 'Two windows', description: 'Balanced pair' },
  { id: 'center-window', label: 'Center window', description: 'One normal window' },
  { id: 'balcony-door', label: 'Balcony door', description: 'One tall glazed opening' },
  { id: 'solid-wall', label: 'Solid wall', description: 'No opening' },
]

const round = (value: number) => Math.round(value * 100) / 100
const wallSlug = (wallRef: string) => wallRef.replace(/^wall\//, '').replaceAll('/', '-')

const replacementOpenings = (wall: WallModel, preset: WallOpeningLayoutPreset) => {
  const length = wallLength(wall)
  if (length < 0.9 && preset !== 'solid-wall') throw new Error('This wall is too short for that façade layout.')
  const edge = Math.min(0.35, length * 0.1)
  const clearWidth = length - edge * 2
  const maxHeight = Math.max(0.5, wall.heightM - 0.16)
  const ref = (index: number) => `opening/${wallSlug(wall.ref)}-${preset}-${index}`

  if (preset === 'solid-wall') return []
  if (preset === 'full-glass') return [{ ref: ref(1), kind: 'window' as const, offsetM: round(length / 2), widthM: round(clearWidth), heightM: round(maxHeight), sillM: 0.08 }]
  if (preset === 'balcony-door') return [{ ref: ref(1), kind: 'door' as const, offsetM: round(length / 2), widthM: round(Math.min(1.8, clearWidth)), heightM: round(Math.min(2.35, maxHeight)), sillM: 0.04 }]
  if (preset === 'center-window') {
    const sillM = Math.min(0.85, Math.max(0.2, wall.heightM * 0.24))
    return [{ ref: ref(1), kind: 'window' as const, offsetM: round(length / 2), widthM: round(Math.min(2.2, clearWidth)), heightM: round(Math.min(1.5, wall.heightM - sillM - 0.12)), sillM: round(sillM) }]
  }

  const gap = Math.min(0.55, length * 0.14)
  const widthM = Math.min(1.8, (clearWidth - gap) / 2)
  if (widthM < 0.45) throw new Error('This wall is too short for two windows.')
  const sillM = Math.min(0.85, Math.max(0.2, wall.heightM * 0.24))
  const heightM = Math.min(1.5, wall.heightM - sillM - 0.12)
  const spread = (widthM + gap) / 2
  return [
    { ref: ref(1), kind: 'window' as const, offsetM: round(length / 2 - spread), widthM: round(widthM), heightM: round(heightM), sillM: round(sillM) },
    { ref: ref(2), kind: 'window' as const, offsetM: round(length / 2 + spread), widthM: round(widthM), heightM: round(heightM), sillM: round(sillM) },
  ]
}

export const wallOpeningLayoutCommands = (project: ProjectV2, buildingRef: string, wallRef: string, preset: WallOpeningLayoutPreset): OpeningUpdateCommand[] => {
  const building = project.buildings.find((item) => item.ref === buildingRef)
  if (!building) throw new Error(`Building not found: ${buildingRef}`)
  const wall = building.walls.find((item) => item.ref === wallRef)
  if (!wall) throw new Error(`Wall not found: ${wallRef}`)
  if (wall.locked) throw new Error(`Wall is locked: ${wallRef}`)

  const removeCommands: OpeningUpdateCommand[] = wall.openings.map((opening) => ({ type: 'opening.update', action: 'remove', buildingRef, wallRef, openingRef: opening.ref }))
  const addCommands: OpeningUpdateCommand[] = replacementOpenings(wall, preset).map((opening) => ({ type: 'opening.update', action: 'add', buildingRef, wallRef, openingRef: opening.ref, kind: opening.kind, offsetM: opening.offsetM, widthM: opening.widthM, heightM: opening.heightM, sillM: opening.sillM }))
  return [...removeCommands, ...addCommands]
}

export const inferWallOpeningLayout = (wall: WallModel): WallOpeningLayoutPreset | 'custom' => {
  if (!wall.openings.length) return 'solid-wall'
  if (wall.openings.length === 2 && wall.openings.every((opening) => opening.kind === 'window')) return 'two-windows'
  if (wall.openings.length !== 1) return 'custom'
  const opening = wall.openings[0]
  if (opening.widthM / wallLength(wall) > 0.68 && opening.sillM <= 0.15) return 'full-glass'
  if (opening.kind === 'door' && opening.sillM <= 0.1) return 'balcony-door'
  if (opening.kind === 'window') return 'center-window'
  return 'custom'
}
