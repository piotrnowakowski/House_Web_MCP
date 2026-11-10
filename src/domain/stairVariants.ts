import { uStairOpening } from './stairs'
import type { BuildingModel, InteriorItem, Polygon2, StairModel, StairVariant } from './types'

const knownStairVariants: { id: StairVariant; name: string; description: string }[] = [
  { id: 'open-9-9', name: '7.11 · 9 + 9', description: 'Równe biegi, białe stopnie i szklana balustrada.' },
  { id: 'open-12-6', name: '7.11 · 12 + 6', description: 'Dłuższy dolny bieg i więcej podłogi na piętrze.' },
  { id: 'classic-9-9', name: 'Klasyczne · 9 + 9', description: 'Drewno i metal. Wejście od strony kuchni.' },
]
// Retain recognition of older saved layouts and undo history, but offer only 7.11.
export const stairVariants = knownStairVariants.filter(option => option.id !== 'classic-9-9')
export const stairCabinetRef = 'interior/architekt-711/under-stair-cabinet'
export const stairFillerRef = 'interior/architekt-711/stair-junction-filler'
const owned = (item: InteriorItem) => [stairCabinetRef, stairFillerRef].includes(item.ref)
export const hasStairCabinet = (building: BuildingModel) => !!building.furniture?.some(item => item.ref === stairCabinetRef)

const rectangle: Polygon2 = [{ x: -4.615, z: -.085 }, { x: -4.615, z: -2.085 }, { x: -1.455, z: -2.085 }, { x: -1.455, z: -.085 }]
const splitOpening: Polygon2 = [{ x: -4.615, z: -.085 }, { x: -4.615, z: -2.085 }, { x: -2.295, z: -2.085 }, { x: -2.295, z: -1.135 }, { x: -1.455, z: -1.135 }, { x: -1.455, z: -.085 }]
function preset(layout: StairVariant): StairModel {
  const classic = layout === 'classic-9-9'
  return {
    ref: 'stairs/reference-main', fromStoreyRef: 'storey/reference-ground', toStoreyRef: 'storey/reference-upper',
    start: { x: classic ? -4.615 : -4.585, z: -2.085 }, runM: classic ? 2.2 : layout === 'open-12-6' ? 2.904 : 2.16,
    widthM: .95, steps: 18,
    uTurn: classic ? { landingDepthM: .95, gapM: .1 } : { landingDepthM: .97, gapM: .1, entrySide: 'max-z', ...(layout === 'open-12-6' ? { lowerSteps: 12 } : {}) },
    ...(!classic ? { finish: { treadColor: '#F0EEE9', closedRisers: true, railing: 'glass' as const } } : {}),
  }
}
/** Derive selection from geometry, including projects saved before this selector existed. */
export function currentStairVariant(building: BuildingModel): StairVariant | null {
  const stairs = building.stairs?.find(s => s.ref === 'stairs/reference-main')
  if (!stairs) return null
  return knownStairVariants.find(({ id }) => {
    const p = preset(id)
    return stairs.fromStoreyRef === p.fromStoreyRef && stairs.toStoreyRef === p.toStoreyRef && stairs.steps === p.steps
      && ['x', 'z'].every(key => Math.abs(stairs.start[key as 'x' | 'z'] - p.start[key as 'x' | 'z']) < 1e-6)
      && Math.abs(stairs.runM - p.runM) < 1e-6 && Math.abs(stairs.widthM - p.widthM) < 1e-6
      && stairs.uTurn?.landingDepthM === p.uTurn!.landingDepthM && stairs.uTurn?.gapM === p.uTurn!.gapM
      && (stairs.uTurn?.lowerSteps ?? 9) === (p.uTurn!.lowerSteps ?? 9)
      && (stairs.uTurn?.entrySide ?? 'min-z') === (p.uTurn!.entrySide ?? 'min-z')
  })?.id ?? null
}

function defaultCabinet(layout: StairVariant): InteriorItem[] {
  const cabinet: InteriorItem = { ref: stairCabinetRef, catalogId: 'kitchen-counter', storeyRef: 'storey/reference-ground',
    name: 'Zabudowa pod górnym biegiem schodów', position: { x: -2.595, z: layout === 'classic-9-9' ? -.56 : -1.63 },
    widthM: .95, depthM: .6, heightM: 2.4, rotationDegrees: 90, color: '#202427', cabinetry: 'under-stair', cabinetBackHeightM: 1.995 }
  // The reversed flight has no connection to the kitchen's tall units.
  return layout === 'classic-9-9' ? [cabinet] : [
    { ...cabinet, ref: stairFillerRef, name: 'Łącznik zabudowy przy schodach', position: { x: -2.595, z: -2.23 }, widthM: .25, heightM: 2.92, cabinetry: 'tall', cabinetBackHeightM: undefined }, cabinet,
  ]
}

/** Atomic change: only the selected stair, its opening and the two owned joinery refs.
 * Each layout remembers custom cabinetry across off/on and layout switches. */
export function applyStairVariant(building: BuildingModel, layout: StairVariant, cabinet: boolean) {
  const previous = currentStairVariant(building)
  if (!previous) throw new Error('Ten układ schodów został zmieniony indywidualnie. Nie można zastąpić go gotowym wariantem.')
  const current = building.stairs!.find(s => s.ref === 'stairs/reference-main')!
  const upper = building.storeys.find(s => s.ref === current.toStoreyRef)
  const slab = building.slabs.find(s => s.ref === upper?.baseSlabRef)
  const opening = uStairOpening(building, current)
  if (!slab || !opening) throw new Error('Nie znaleziono otworu nad schodami. Zmiana nie została zapisana.')
  const items = building.furniture?.filter(owned) ?? []
  if (items.some(item => item.locked)) throw new Error('Odblokuj szafkę pod schodami przed zmianą wariantu.')
  if (previous === layout && hasStairCabinet(building) === cabinet) return
  building.stairCabinetVariants ??= {}
  if (items.length) building.stairCabinetVariants[previous] = structuredClone(items)
  if (previous !== layout) {
    const next = preset(layout)
    Object.assign(current, next)
    if (!next.finish) delete current.finish
    slab.holes = slab.holes!.map(hole => hole === opening ? structuredClone(layout === 'open-12-6' ? splitOpening : rectangle) : hole)
  }
  building.furniture = (building.furniture ?? []).filter(item => !owned(item))
  if (cabinet) {
    const restored = structuredClone(building.stairCabinetVariants[layout] ?? defaultCabinet(layout))
    // A manual deletion can leave only the connector. An explicit on action
    // must still create the cabinet instead of restoring an incomplete pair.
    if (!restored.some(item => item.ref === stairCabinetRef)) restored.push(defaultCabinet(layout).find(item => item.ref === stairCabinetRef)!)
    building.furniture.push(...restored)
  }
}
