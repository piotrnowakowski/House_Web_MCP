type Props = { selected: boolean; ghost: boolean }

/** Shared metre-sized garden models; selection and proposal transparency follow the fixture layer. */
export function SpaFixture({ kind, selected, ghost }: Props & { kind: 'jacuzzi' | 'outdoor-kitchen' }) {
  const box = (key: string, size: [number, number, number], at: [number, number, number], color: string) => (
    <mesh key={key} position={at} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.65} emissive={selected ? '#466413' : '#000000'} emissiveIntensity={0.3} transparent={ghost} opacity={ghost ? 0.4 : 1} />
    </mesh>
  )
  if (kind === 'outdoor-kitchen') return <group>
    {box('base', [3.6, 0.85, 0.76], [0, 0.475, 0], '#a78258')}
    {box('top', [3.6, 0.08, 0.8], [0, 0.94, 0], '#343b3c')}
    {[-1.4, -0.7, 0, 0.7, 1.4].map(x => box(`join-${x}`, [0.016, 0.72, 0.02], [x, 0.49, 0.39], '#4b4237'))}
    {box('grill', [1.05, 0.35, 0.57], [-1.05, 1.155, 0], '#444d4f')}
    {box('grill-handle', [0.65, 0.045, 0.07], [-1.05, 1.24, 0.32], '#b8c3c4')}
    {box('sink-rim', [0.62, 0.025, 0.52], [1.07, 0.991, 0], '#b8c3c4')}
    {box('sink-basin', [0.5, 0.025, 0.4], [1.07, 1.008, 0], '#4e6568')}
    {box('tap', [0.045, 0.33, 0.045], [1.07, 1.15, -0.28], '#b8c3c4')}
    {box('spout', [0.045, 0.045, 0.23], [1.07, 1.3, -0.18], '#b8c3c4')}
  </group>
  return <group>
    {box('base', [2.6, 0.14, 2.6], [0, 0.09, -0.25], '#30383a')}
    {[-1, 1].map(side => box(`wall-x-${side}`, [0.2, 0.86, 2.6], [side * 1.2, 0.58, -0.25], '#9a744d'))}
    {[-1, 1].map(side => box(`wall-z-${side}`, [2.2, 0.86, 0.2], [0, 0.58, -0.25 + side * 1.2], '#9a744d'))}
    {[-1, 1].map(side => box(`rim-x-${side}`, [0.25, 0.08, 2.6], [side * 1.175, 1.01, -0.25], '#e1dfd4'))}
    {[-1, 1].map(side => box(`rim-z-${side}`, [2.1, 0.08, 0.25], [0, 1.01, -0.25 + side * 1.175], '#e1dfd4'))}
    {box('water', [2.1, 0.025, 2.1], [0, 0.88, -0.25], '#6eacb2')}
    {[-1, 1].flatMap(x => [-1, 1].map(z => box(`headrest-${x}-${z}`, [0.36, 0.12, 0.2], [x * 0.72, 0.99, -0.25 + z * 0.94], '#3b4649')))}
    {box('step-low', [1.1, 0.2, 0.5], [0, 0.12, 1.3], '#9a744d')}
    {box('step-high', [1.1, 0.2, 0.25], [0, 0.32, 1.175], '#9a744d')}
  </group>
}
