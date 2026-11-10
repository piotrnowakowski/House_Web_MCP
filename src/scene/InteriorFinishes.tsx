import { atticWallProfile } from '../domain/attic'
import type { BuildingModel } from '../domain/types'
import { RoomCeiling } from '../interior/RoomCeiling'
import { WallFinishFaces } from '../interior/WallFinishFaces'
import { wallFinishProfiles, wallSurfacePieces } from '../interior/wallFinishPieces'
import { voidCeilingFinish } from '../interior/voidCeilingFinish'
import { useStudioStore } from '../state/store'
import { roofLiningInsetM } from './roofPanels'

/** The exterior camera sees the same interior lining through the real glazing. */
export function InteriorFinishes({ building, explodeOffset, roofOffset }: { building: BuildingModel; explodeOffset: number; roofOffset: number }) {
  const select = useStudioStore(s => s.setSelectedRef)
  return <>
    {building.walls.filter(wall => wall.faceFinishes).map(wall => {
      const storey = building.storeys.find(s => s.wallRefs.includes(wall.ref))
      return <group key={wall.ref} name={`interior-lining/${wall.ref}`} userData={{ semanticRef: wall.ref, buildingRef: building.ref }}
        position={[wall.start.x, wall.baseElevationM + .025 + (storey?.level ?? 0) * explodeOffset, wall.start.z]}
        rotation-y={-Math.atan2(wall.end.z - wall.start.z, wall.end.x - wall.start.x)}
        onPointerDown={event => { event.stopPropagation(); select(wall.ref) }}>
        <WallFinishFaces wall={wall} height={wall.heightM} pieces={wallSurfacePieces(wall, wall.heightM, true)}
          profile={atticWallProfile(building, wall)} finishProfiles={wallFinishProfiles(building, wall)} fullHeight />
      </group>
    })}
    {building.storeys.filter(storey => storey.kneeWallHeightM !== undefined).map(storey => {
      const slab = building.slabs.find(s => s.ref === storey.baseSlabRef)
      // Interior mode omits the solid roof. The exterior lining must sit below that sheet.
      const inset = Math.max(0, ...building.roof.segments.filter(s => s.type === 'gable' && s.storeyRef === storey.ref).map(s => roofLiningInsetM(s.pitchDegrees)))
      return <group key={storey.ref} position-y={storey.elevationM + roofOffset - inset}>
        {slab?.holes?.map((hole, index) => <RoomCeiling key={index} semanticRef={`ceiling/${slab.ref}/void/${index}`}
          building={building} storey={storey} footprint={hole} finish={voidCeilingFinish(building, storey, hole)}
          flatHeight={storey.clearHeightM} overVoid />)}
      </group>
    })}
  </>
}
