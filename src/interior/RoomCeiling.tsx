import { useEffect, useMemo } from 'react'
import type { BuildingModel, InteriorFinish, Polygon2, StoreyModel } from '../domain/types'
import { ceilingGeometry } from './ceilingGeometry'
import { FinishMaterial } from './FinishMaterial'

/** Finishing skin follows the existing roof volume; never changes roof pitch or ridge geometry. */
export function RoomCeiling({ building, storey, footprint, finish, flatHeight, overVoid = false }: { building: BuildingModel; storey: StoreyModel; footprint: Polygon2; finish: InteriorFinish; flatHeight: number; overVoid?: boolean }) {
  const geometry = useMemo(() => ceilingGeometry(building, storey, footprint, flatHeight, overVoid), [building, storey, footprint, flatHeight, overVoid])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  return <mesh geometry={geometry} receiveShadow><FinishMaterial finish={finish}/></mesh>
}
