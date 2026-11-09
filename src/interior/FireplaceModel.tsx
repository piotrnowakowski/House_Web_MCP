import type { InteriorItem } from '../domain/types'

/** Concept enclosure only; appliance selection and the flue above this storey are separate design work. */
export function FireplaceModel({ item }: { item: InteriorItem }) {
  const width = item.widthM, height = item.heightM, depth = item.depthM
  const bottom = height * .17, top = height * .38, jamb = width * .1
  const box = (name: string, size: [number, number, number], position: [number, number, number], color = item.color) => (
    <mesh key={name} name={name} position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={.8} />
    </mesh>
  )
  return <group name="fireplace-enclosure">
    {box('hearth-base', [width, bottom, depth], [0, bottom / 2, 0])}
    {box('hood', [width, height - top, depth], [0, (height + top) / 2, 0])}
    {[-1, 1].map(side => box(`jamb-${side}`, [jamb, top - bottom, depth], [side * (width - jamb) / 2, (bottom + top) / 2, 0]))}
    {box('firebox-back', [width - 2 * jamb, top - bottom, .025], [0, (bottom + top) / 2, -depth / 2 + .013], '#25282A')}
    {box('firebox-floor', [width - 2 * jamb, .018, depth - .025], [0, bottom + .009, .012], '#25282A')}
    {box('insert-frame', [width - 2 * jamb, top - bottom, .025], [0, (bottom + top) / 2, depth / 2 - .02], '#171C20')}
    {box('insert-glass', [width - 2 * jamb - .04, top - bottom - .05, .009], [0, (bottom + top) / 2, depth / 2 - .003], '#354047')}
    {box('convection-grille', [width * .65, .035, .012], [0, top + (height - top) * .75, depth / 2 + .006], '#282D30')}
  </group>
}
