import { useEffect, useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import { atticClearanceAt } from '../domain/attic'
import type { BuildingModel, InteriorFinish, Polygon2, StoreyModel } from '../domain/types'
import { floorGeometry } from './floorGeometry'
import { FinishMaterial } from './FinishMaterial'

/** Finishing skin follows the existing roof volume; never changes roof pitch or ridge geometry. */
export function RoomCeiling({ building, storey, footprint, finish, flatHeight }: { building: BuildingModel; storey: StoreyModel; footprint: Polygon2; finish: InteriorFinish; flatHeight: number }) {
  const geometry = useMemo(() => {
    const source = floorGeometry(footprint)
    const flat = source.index ? source.toNonIndexed() : source
    const points = flat.getAttribute('position'), vertices: number[] = [], uv: number[] = []
    type P = [number, number]
    const mid = (a: P,b: P): P => [(a[0]+b[0])/2,(a[1]+b[1])/2]
    const triangle = (a: P,b: P,c: P,depth: number) => {
      if(depth){const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);triangle(a,ab,ca,depth-1);triangle(ab,b,bc,depth-1);triangle(ca,bc,c,depth-1);triangle(ab,bc,ca,depth-1);return}
      for(const [x,z] of [a,b,c]) { vertices.push(x, (storey.kneeWallHeightM === undefined ? flatHeight : atticClearanceAt(building,storey,{x,z}))-.015,z);uv.push(x,z) }
    }
    for(let i=0;i<points.count;i+=3)triangle([points.getX(i),points.getZ(i)],[points.getX(i+1),points.getZ(i+1)],[points.getX(i+2),points.getZ(i+2)],storey.kneeWallHeightM === undefined ? 0 : 5)
    if(flat!==source)flat.dispose();source.dispose()
    const result=new BufferGeometry();result.setAttribute('position',new Float32BufferAttribute(vertices,3));result.setAttribute('uv',new Float32BufferAttribute(uv,2));result.computeVertexNormals();return result
  },[building,storey,footprint,flatHeight])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  return <mesh geometry={geometry} receiveShadow><FinishMaterial finish={finish}/></mesh>
}
