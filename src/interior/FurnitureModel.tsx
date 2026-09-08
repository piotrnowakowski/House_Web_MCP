import { RoundedBox } from '@react-three/drei'
import type { InteriorItem } from '../domain/types'

/** Metre-sized, editable furnishings with separate upholstery, joinery, glass and metal. */
export function FurnitureModel({ item }: { item: InteriorItem }) {
  const color = item.color
  const box = (key: string, size: [number, number, number], pos: [number, number, number], shade = color, radius = 0.025) => <RoundedBox key={key} args={size} position={pos} radius={radius} smoothness={3} castShadow receiveShadow><meshStandardMaterial color={shade} roughness={item.catalogId === 'car' ? 0.3 : 0.72} metalness={item.catalogId === 'car' && shade === color ? 0.45 : 0} /></RoundedBox>
  const legs = (height = 0.65) => [-1, 1].flatMap((x) => [-1, 1].map((z) => box(`leg${x}${z}`, [0.055, height, 0.055], [x * 0.4, height / 2, z * 0.4], '#5e4937', 0.008)))
  const cylinder = (key: string, pos: [number, number, number], radius: number, height: number, shade: string, rotate = false) => <mesh key={key} position={pos} rotation={rotate ? [0, 0, Math.PI / 2] : [0, 0, 0]} scale={rotate && item.catalogId === 'car' ? [1, 1, item.heightM / item.depthM] : [1, 1, 1]} castShadow receiveShadow><cylinderGeometry args={[radius, radius, height, 32]} /><meshStandardMaterial color={shade} roughness={0.4} metalness={shade === '#333b3d' ? 0.25 : 0} /></mesh>
  const basin = (y: number, width = 0.7, depth = 0.65) => <group>{box('basin', [width, 0.08, depth], [0, y, 0], '#f4f2eb', 0.035)}{box('water', [width * 0.72, 0.018, depth * 0.7], [0, y + 0.047, 0], '#a2b9bb', 0.025)}{box('tap', [0.035, 0.18, 0.04], [0, y + 0.1, -depth / 2 + 0.07], '#9ea9a9', 0.008)}{box('spout', [0.035, 0.03, 0.14], [0, y + 0.19, -depth / 2 + 0.12], '#9ea9a9', 0.008)}</group>
  let model
  switch (item.catalogId) {
    case 'corner-sofa':
      model = <>{box('left-base', [0.32, 0.27, 0.98], [-0.33, 0.28, 0])}{box('front-base', [0.66, 0.27, 0.34], [0.16, 0.28, 0.32])}{box('left-back', [0.09, 0.47, 0.96], [-0.445, 0.67, 0])}{box('front-back', [0.87, 0.45, 0.09], [0.04, 0.65, 0.445])}{[-0.32, 0, 0.32].map((z) => box(`left-cushion${z}`, [0.22, 0.18, 0.3], [-0.28, 0.49, z], color, 0.04))}{[0.02, 0.29].map((x) => box(`front-cushion${x}`, [0.25, 0.18, 0.24], [x, 0.49, 0.28], color, 0.04))}{box('pillow', [0.15, 0.18, 0.17], [-0.31, 0.64, -0.05], '#ddd5c8', 0.04)}</>; break
    case 'bar-stool':
      model = <>{cylinder('seat', [0, 0.95, 0], 0.48, 0.09, '#666b66')}{legs(0.9)}{box('rail', [0.85, 0.04, 0.04], [0, 0.35, 0.39], '#675c47')}</>; break
    case 'tv-unit':
      model = <>{box('console', [1, 0.3, 1], [0, 0.19, 0], color)}{box('screen-frame', [0.82, 0.6, 0.09], [0, 0.69, -0.25], '#222b30')}{box('screen', [0.79, 0.55, 0.015], [0, 0.7, -0.195], '#405965')}{box('stand', [0.18, 0.1, 0.24], [0, 0.4, -0.22], '#273136')}</>; break
    case 'sofa': case 'armchair':
      model = <>{box('base', [0.98, 0.23, 0.94], [0, 0.28, 0])}{box('back', [0.98, 0.5, 0.18], [0, 0.68, -0.37])}{[-1, 1].map((x) => box(`arm${x}`, [0.1, 0.42, 0.85], [x * 0.44, 0.48, 0.02]))}{[0, 1, 2].map((x) => box(`cushion${x}`, [0.25, 0.18, 0.64], [(x - 1) * 0.265, 0.48, 0.06], color, 0.045))}{legs(0.16)}{box('pillow', [0.2, 0.24, 0.16], [-0.27, 0.7, -0.21], '#e3d8c6', 0.055)}</>; break
    case 'bed':
      model = <>{box('frame', [1, 0.22, 1], [0, 0.22, 0], '#92775e')}{box('head', [1, 0.85, 0.07], [0, 0.54, -0.46])}{box('mattress', [0.95, 0.22, 0.94], [0, 0.43, 0], '#eee9df', 0.055)}{box('duvet', [0.96, 0.12, 0.62], [0, 0.57, 0.15], color, 0.055)}{[-1, 1].map((x) => box(`pillow${x}`, [0.39, 0.13, 0.23], [x * 0.24, 0.6, -0.29], '#f8f4ea', 0.05))}{box('throw', [0.97, 0.045, 0.21], [0, 0.65, 0.33], '#71857c')}{legs(0.14)}</>; break
    case 'coffee-table': case 'desk':
      model = <>{box('top', [1, 0.09, 1], [0, 0.92, 0])}{legs(0.89)}</>; break
    case 'dining-table':
      model = <>{box('top', [0.92, 0.08, 0.5], [0, 0.88, 0])}{[-1, 1].flatMap((x) => [-1, 1].map((z) => box(`tableleg${x}${z}`, [0.045, 0.82, 0.045], [x * 0.37, 0.44, z * 0.18], '#755b42')))}{[-1, 1].flatMap((z) => [-0.3, 0, 0.3].map((x) => <group key={`${z}${x}`} position={[x, 0, z * 0.37]}>{box('seat', [0.23, 0.07, 0.22], [0, 0.52, 0], '#b7a087')}{box('back', [0.23, 0.36, 0.035], [0, 0.75, z * 0.09], '#ac8b66')}{[-1, 1].flatMap((a) => [-1, 1].map((b) => box(`${a}${b}`, [0.02, 0.49, 0.02], [a * 0.09, 0.25, b * 0.085], '#755b42', 0.005)))}</group>))}</>; break
    case 'car':
      model = <>{box('body', [0.94, 0.36, 0.93], [0, 0.39, 0], color, 0.13)}{box('cabin', [0.77, 0.35, 0.45], [0, 0.7, -0.025], '#35434a', 0.12)}{box('roof', [0.7, 0.075, 0.3], [0, 0.895, -0.03], color, 0.035)}{[-1, 1].flatMap((x) => [-1, 1].map((z) => cylinder(`wheel${x}${z}`, [x * 0.44, 0.25, z * 0.3], 0.17, 0.11, '#252b2c', true)))}{[-1, 1].map((x) => box(`light${x}`, [0.2, 0.075, 0.02], [x * 0.29, 0.45, 0.459], '#f6edcf', 0.009))}{box('grille', [0.45, 0.12, 0.025], [0, 0.29, 0.46], '#333b3d')}{[-1, 1].map((x) => box(`tail${x}`, [0.23, 0.07, 0.025], [x * 0.29, 0.43, -0.46], '#9b3934'))}</>; break
    case 'bathtub':
      model = <>{box('tub', [0.98, 0.7, 0.98], [0, 0.42, 0], color, 0.16)}{box('inner', [0.75, 0.045, 0.8], [0, 0.79, 0], '#b6c8c7', 0.1)}{box('rim', [0.08, 0.12, 0.79], [-0.42, 0.78, 0], '#fcfaf3')}{box('tap', [0.04, 0.3, 0.04], [0.38, 0.75, -0.3], '#9ea9a9')}</>; break
    case 'toilet':
      model = <>{box('tank', [0.85, 0.65, 0.28], [0, 0.58, -0.33], color, 0.06)}{box('pedestal', [0.5, 0.42, 0.54], [0, 0.26, 0.06], color, 0.08)}{box('bowl', [0.9, 0.18, 0.7], [0, 0.52, 0.12], color, 0.08)}{box('seat', [0.68, 0.025, 0.47], [0, 0.625, 0.15], '#c5d3d0', 0.06)}</>; break
    case 'shower':
      model = <>{box('tray', [1, 0.055, 1], [0, 0.03, 0], '#e9e5de')}{[0, 1].map((i) => <mesh key={i} position={i ? [-0.48, 0.5, 0] : [0, 0.5, -0.48]}><boxGeometry args={i ? [0.015, 0.97, 1] : [1, 0.97, 0.015]} /><meshPhysicalMaterial color='#b6d5d4' transparent opacity={0.22} roughness={0.1} metalness={0.1} depthWrite={false} /></mesh>)}{box('pipe', [0.025, 0.75, 0.025], [0, 0.53, -0.44], '#859698', 0.005)}{box('head', [0.24, 0.02, 0.22], [0, 0.94, -0.32], '#b7c2c2', 0.008)}</>; break
    default:
      model = <>{box('cabinet', [0.97, 0.89, 0.97], [0, 0.46, 0])}{box('top', [1, 0.06, 1], [0, 0.93, 0], item.catalogId === 'fridge' ? '#bfc8c8' : '#eeebe2')}{box('join', [0.008, 0.75, 0.006], [0, 0.5, 0.489], '#766b5c', 0.001)}{[-1, 1].map((x) => box(`handle${x}`, [0.1, 0.025, 0.04], [x * 0.14, 0.75, 0.505], '#66716d', 0.005))}{(item.catalogId === 'sink' || item.catalogId === 'vanity') && basin(0.97)}{item.catalogId === 'cooker' && <>{box('hob', [0.88, 0.02, 0.86], [0, 0.972, 0], '#303b3c')}{[-1, 1].flatMap((x) => [-1, 1].map((z) => cylinder(`${x}${z}`, [x * 0.22, 0.99, z * 0.22], 0.15, 0.012, '#697374')))}{box('oven', [0.76, 0.52, 0.018], [0, 0.4, 0.495], '#263437')}</>}{item.catalogId === 'washer' && <mesh position={[0, 0.44, 0.49]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.29, 0.29, 0.03, 32]} /><meshStandardMaterial color='#344d56' metalness={0.5} roughness={0.2} /></mesh>}</>
  }
  return <group scale={[item.widthM, item.heightM, item.depthM]}>{model}{item.catalogId === 'kitchen-island' && <group>{box('inset-hob', [0.46, 0.018, 0.24], [0, 0.974, -0.02], '#303b3c', 0.012)}{[-1, 1].flatMap((x) => [-1, 1].map((z) => cylinder(`hob-ring${x}${z}`, [x * 0.13, 0.988, -0.02 + z * 0.065], 0.047, 0.007, '#697374')))}</group>}</group>
}
