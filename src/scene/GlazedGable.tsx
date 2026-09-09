import { useEffect, useMemo } from 'react'
import { DoubleSide, Path, Shape, ShapeGeometry, Vector2 } from 'three'
import { gableGlazingProfile } from '../domain/gableGlazing'
import type { BuildingModel, RoofSegmentModel, Vec2, WallFinish } from '../domain/types'
import { resolveWallTexture, tintForTexturedFinish } from './materialCatalog'
import { TexturedMaterial } from './materials'

/** Cut the glass out of the gable cladding and frame its sloping outline. */
export function GlazedGable({ building, segment, side, value, finish, selected, ghost }: {
  building: BuildingModel; segment: RoofSegmentModel; side: 'min' | 'max'; value: number; finish: WallFinish; selected: boolean; ghost?: boolean
}) {
  const profile = useMemo(() => gableGlazingProfile(segment, side, building), [segment, side, building])
  const geometry = useMemo(() => {
    if (!profile) return null
    const points = (polygon: Vec2[]) => polygon.map((p) => new Vector2(p.x, p.z))
    const wall = new Shape(points(profile.outline))
    for (const panel of profile.panels) wall.holes.push(new Path(points([...panel.opening].reverse())))
    return { wall: new ShapeGeometry(wall), glass: profile.panels.map((panel) => new ShapeGeometry(new Shape(points(panel.opening)))) }
  }, [profile])
  useEffect(() => () => { geometry?.wall.dispose(); geometry?.glass.forEach((glass) => glass.dispose()) }, [geometry])
  if (!profile || !geometry) return null
  const alongZ = segment.ridgeDirection === 'z'
  const texture = resolveWallTexture(finish)
  const color = selected ? '#b9e84d' : finish.colorHex
  const edges = profile.panels.flatMap(({ opening, mullions }) => [
    ...opening.map((a, i) => [a, opening[(i + 1) % opening.length]]),
    ...mullions.map((m) => [{ x: m.x, z: m.bottom }, { x: m.x, z: m.top }]),
  ])
  return <group position={alongZ ? [0, 0, value] : [value, 0, 0]} rotation={[0, alongZ ? 0 : -Math.PI / 2, 0]}>
    <mesh geometry={geometry.wall} castShadow receiveShadow>
      {texture ? <TexturedMaterial asset={texture.id} rotation={texture.rotation} color={tintForTexturedFinish(color)} fallbackColor={color} side={DoubleSide} roughness={0.94} transparent={Boolean(ghost)} opacity={ghost ? 0.35 : 1} />
        : <meshStandardMaterial color={color} roughness={0.94} side={DoubleSide} transparent={Boolean(ghost)} opacity={ghost ? 0.35 : 1} />}
    </mesh>
    {geometry.glass.map((glass, index) => <mesh key={index} geometry={glass}>
      <meshPhysicalMaterial color="#78959a" transparent opacity={ghost ? 0.2 : 0.42} transmission={0.55} roughness={0.08} metalness={0.08} side={DoubleSide} depthWrite={false} />
    </mesh>)}
    {edges.map(([a, b], index) => <mesh key={index} position={[(a.x + b.x) / 2, (a.z + b.z) / 2, 0]} rotation={[0, 0, Math.atan2(b.z - a.z, b.x - a.x)]} castShadow>
      <boxGeometry args={[Math.hypot(b.x - a.x, b.z - a.z), 0.075, 0.12]} />
      <meshStandardMaterial color={selected ? '#b9e84d' : '#121817'} roughness={0.5} />
    </mesh>)}
  </group>
}
