import { RoundedBox } from '@react-three/drei'
import type { InteriorItem } from '../domain/types'
import { FinishMaterial } from './FinishMaterial'

const oak = { presetId: 'natural-oak', color: '#FFFFFF', rotationDegrees: 0, tileM: 1.2 }
/** Normalized bounds keep each piece editable in metres in both scene renderers. */
export function OakBedroomFurniture({ item }: { item: InteriorItem }) {
  const box = (key: string, size: [number, number, number], position: [number, number, number], color?: string, radius = .015) =>
    <RoundedBox key={key} args={size} position={position} radius={radius} smoothness={4} castShadow receiveShadow>
      {color ? <meshStandardMaterial color={color} roughness={.95} /> : <FinishMaterial finish={oak} />}
    </RoundedBox>
  let model
  switch (item.catalogId) {
    case 'oak-platform-bed':
      model = <>
        {box('plinth', [.83, .13, .85], [0, .065, .03])}
        {box('platform', [1, .14, 1], [0, .2, 0])}
        {box('headboard', [1, .95, .04], [0, .475, -.48])}
        {box('mattress', [.9, .21, .89], [0, .375, .015], '#F0E7D8', .045)}
        {box('duvet', [.91, .07, .66], [0, .515, .13], '#E8DECB', .035)}
        {[-1, 1].map(x => box(`pillow-${x}`, [.38, .13, .22], [x * .23, .55, -.3], '#F7F0E3', .045))}
        {[-1, 1].map(x => box(`accent-${x}`, [.25, .14, .13], [x * .19, .6, -.19], item.color, .04))}
        {box('throw', [.92, .025, .3], [0, .565, .28], item.color, .01)}
      </>; break
    case 'oak-nightstand':
      model = <>{box('case', [1, 1, 1], [0, .5, 0])}{box('drawer', [.94, .77, .025], [0, .47, .499])}{box('pull', [.22, .035, .02], [0, .8, .52], '#654B32', .005)}</>; break
    case 'wool-rug':
      model = <RoundedBox args={[1, 1, 1]} position={[0,.5,0]} radius={.008} smoothness={3} receiveShadow><FinishMaterial finish={{presetId:'linen',color:item.color,rotationDegrees:0,tileM:.16}} /></RoundedBox>; break
    case 'brass-sconce':
      model = <>
        <mesh position={[0,.53,-.45]}><cylinderGeometry args={[.16,.16,.07,24]} /><meshStandardMaterial color={item.color} metalness={.8} roughness={.3}/></mesh>
        <mesh position={[0,.55,-.13]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.025,.025,.65,16]}/><meshStandardMaterial color={item.color} metalness={.8} roughness={.3}/></mesh>
        <mesh position={[0,.5,.15]} scale={[1,.8,.7]}><sphereGeometry args={[.45,32,16,0,Math.PI*2,0,Math.PI/2]}/><meshStandardMaterial color={item.color} metalness={.8} roughness={.3}/></mesh>
        <mesh position={[0,.495,.15]} rotation={[-Math.PI/2,0,0]} scale={[1,.7,1]}><circleGeometry args={[.41,32]}/><meshStandardMaterial color='#FFF0CC' emissive='#FFD796' emissiveIntensity={1.5}/></mesh>
        <pointLight position={[0,.35,.2]} color='#FFE2AF' intensity={.12} distance={2}/>
      </>; break
    case 'oak-side-table':
      model = <><mesh position={[0,.47,0]} castShadow><cylinderGeometry args={[.3,.4,.9,48]}/><FinishMaterial finish={oak}/></mesh><mesh position={[0,.95,0]} castShadow><cylinderGeometry args={[.5,.5,.1,48]}/><FinishMaterial finish={oak}/></mesh></>; break
    case 'boucle-chair':
      model = <>{box('base',[.86,.3,.82],[0,.15,0],item.color,.1)}{box('seat',[.79,.24,.74],[0,.4,.04],item.color,.1)}{box('back',[.95,.64,.25],[0,.68,-.34],item.color,.12)}{[-1,1].map(x=>box(`arm${x}`,[.23,.43,.8],[x*.38,.48,.05],item.color,.1))}</>; break
    default: return null
  }
  return <group scale={[item.widthM,item.heightM,item.depthM]}>{model}</group>
}

export const isOakBedroomFurniture = (item: InteriorItem) => ['oak-platform-bed','oak-nightstand','wool-rug','brass-sconce','oak-side-table','boucle-chair'].includes(item.catalogId)
