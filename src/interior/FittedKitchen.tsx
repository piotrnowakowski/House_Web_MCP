import type { InteriorItem } from '../domain/types'
import { useEffect, useMemo } from 'react'
import { slopedCabinetGeometry } from './cabinetGeometry'

function UnderStairCabinet({ item }: { item: InteriorItem }) {
  const { widthM: w, depthM: d, heightM: h, color } = item
  const back = item.cabinetBackHeightM ?? h
  const geometry = useMemo(() => slopedCabinetGeometry(w - .012, d - .02, h - .006, back - .006, .09), [w, d, h, back])
  useEffect(() => () => geometry.dispose(), [geometry])
  const columns = Math.max(1, Math.round(w / .6)), cw = w / columns
  const division = Math.min(2.18, h - .1)
  return <group name={`under-stair-cabinet/${item.ref}`}>
    <mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial color={color} roughness={.62} /></mesh>
    <mesh position={[0,.045,-.02]}><boxGeometry args={[w-.04,.09,d-.08]} /><meshStandardMaterial color='#101213' /></mesh>
    {Array.from({length:columns}, (_,c) => [[.09,division],[division,h-.002]].map(([bottom,top],r) => <mesh key={`${c}/${r}`} position={[-w/2+(c+.5)*cw,(bottom+top)/2,d/2-.01]} castShadow receiveShadow><boxGeometry args={[cw-.004,top-bottom-.004,.02]} /><meshStandardMaterial color={color} roughness={.62} /></mesh>))}
  </group>
}

/** Dimensioned slab-front joinery; its envelope includes the top and ceiling filler. */
export function FittedKitchen({ item }: { item: InteriorItem }) {
  const { widthM: w, heightM: h, depthM: d, cabinetry: kind } = item
  if (kind === 'under-stair') return <UnderStairCabinet item={item} />
  const box = (key: string, size: [number, number, number], position: [number, number, number], color = item.color) => <mesh key={key} position={position} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={.62} /></mesh>
  if (kind === 'sink-insert') return <group name={`island-sink/${item.ref}`}>
    {box('rim', [w,.014,d], [0,.007,0], '#454E50')}
    {box('basin', [w-.04,.008,d-.04], [0,.018,0], '#111A1D')}
    {box('tap', [.028,h-.02,.028], [0,(h-.02)/2,-d/2+.035], '#161B1D')}
    {box('spout', [.028,.028,.18], [0,h-.034,-d/2+.115], '#161B1D')}
  </group>
  if (kind === 'hob') return <group>
    {box('glass', [w, h, d], [0, h / 2, 0], '#111516')}
    {[-1, 1].flatMap(x => [-1, 1].map(z => <mesh key={`${x}/${z}`} position={[x * w * .25, h + .001, z * d * .25]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.075, .078, 32]} /><meshStandardMaterial color='#667074' /></mesh>))}
  </group>
  const tall = kind === 'tall' || kind === 'oven-tower'
  const plinth = Math.min(.09, h * .08), top = tall ? .02 : .025
  const columns = Math.max(1, Math.round(w / .6)), cw = w / columns
  const rows = tall ? [[plinth, Math.min(2.18, h * .76)], [Math.min(2.18, h * .76), h - top]] : [[plinth, h * .47], [h * .47, h - top]]
  return <group name={`fitted-kitchen/${item.ref}`}>
    {box('plinth', [w - .04, plinth, d - .08], [0, plinth / 2, -.02], '#101213')}
    {box('carcass', [w - .012, h - plinth - top, d - .035], [0, (h + plinth - top) / 2, -.0175])}
    {box('top', [w, top, d], [0, h - top / 2, 0], tall ? item.color : '#171B1D')}
    {Array.from({ length: columns }, (_, c) => rows.map(([bottom, upper], r) => box(`front-${c}-${r}`, [cw - .004, upper - bottom - .004, .02], [-w / 2 + (c + .5) * cw, (bottom + upper) / 2, d / 2 - .01]))) }
    {kind === 'oven-tower' && <>
      {box('oven', [Math.min(.56, w - .06), .59, .024], [0, 1.25, d / 2], '#101416')}
      {box('oven-glass', [Math.min(.47, w - .12), .39, .025], [0, 1.22, d / 2 + .003], '#263033')}
      {box('oven-handle', [Math.min(.44, w - .15), .018, .038], [0, 1.48, d / 2 + .025], '#737A7B')}
    </>}
    {kind === 'sink' && <>
      {box('sink-rim', [w * .7, .012, d * .66], [0, h + .006, 0], '#424B4D')}
      {box('sink-bowl', [w * .6, .014, d * .55], [0, h + .014, 0], '#13191B')}
      {box('tap', [.028, .3, .028], [0, h + .15, -d * .36], '#161B1D')}
      {box('spout', [.028, .028, .19], [0, h + .286, -d * .36 + .08], '#161B1D')}
    </>}
  </group>
}
