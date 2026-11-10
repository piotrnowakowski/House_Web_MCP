import { useEffect, useMemo } from 'react'
import type { BuildingModel, InteriorFinish, Polygon2, StoreyModel } from '../domain/types'
import { ceilingGeometry } from './ceilingGeometry'
import { FinishMaterial } from './FinishMaterial'

/** Finishing skin follows the existing roof volume; never changes roof pitch or ridge geometry. */
export function RoomCeiling({ semanticRef, building, storey, footprint, finish, flatHeight, overVoid = false, capHeight }: { semanticRef?: string; building: BuildingModel; storey: StoreyModel; footprint: Polygon2; finish: InteriorFinish; flatHeight: number; overVoid?: boolean; capHeight?: number }) {
  const geometry = useMemo(() => ceilingGeometry(building, storey, footprint, flatHeight, overVoid, capHeight), [building, storey, footprint, flatHeight, overVoid, capHeight])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  return <mesh userData={{ semanticRef, interiorFinish: finish.presetId }} geometry={geometry} receiveShadow><FinishMaterial finish={finish} keepTexture={overVoid}/></mesh>
}
