import type { OpeningModel } from '../domain/types'

/** Closed, handleless pantry leaf and matching transom in the cabinetry face plane. */
export function ConcealedDoor({ opening, wallHeight, plan = false }: { opening: OpeningModel; wallHeight: number; plan?: boolean }) {
  const offset = opening.concealed!.faceOffsetM
  const color = opening.finish?.color ?? '#202427'
  return <group name={`concealed-door/${opening.ref}`} position={[opening.offsetM, 0, offset]}>
    {([-1,1] as const).map(side => {
      const width = (side < 0 ? opening.concealed!.startFillerM : opening.concealed!.endFillerM) ?? 0
      return width > 0 ? <mesh key={side} position={[side*(opening.widthM+width)/2,plan?.06:wallHeight/2,0]} castShadow receiveShadow><boxGeometry args={[width,plan?.025:wallHeight,.02]} /><meshStandardMaterial color={color} roughness={.62} /></mesh> : null
    })}
    <mesh position={[0, plan ? .06 : opening.heightM / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[opening.widthM - .004, plan ? .025 : opening.heightM - .004, .02]} />
      <meshStandardMaterial color={color} roughness={.62} />
    </mesh>
    {!plan && wallHeight > opening.heightM && <mesh position={[0, (wallHeight + opening.heightM) / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[opening.widthM - .004, wallHeight - opening.heightM - .004, .02]} />
      <meshStandardMaterial color={color} roughness={.62} />
    </mesh>}
  </group>
}
