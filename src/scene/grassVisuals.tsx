import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, DoubleSide, Float32BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, ShaderMaterial, Uint16BufferAttribute } from 'three'
import { elevationAt, pointInPolygon } from '../domain/geometry'
import type { BuildingModel, Polygon2, ProjectV2, Vec2 } from '../domain/types'
import { useStudioStore } from '../state/store'

const NEAR_FIELD_LIMIT_Z = 38
const CANDIDATE_BLADES = 360_000

type GrassBlade = { x: number; y: number; z: number; angle: number; height: number; shade: number }

const fraction = (value: number) => value - Math.floor(value)
const noise = (x: number, z: number, salt: number) => fraction(Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453)

const buildingFootprint = (building: BuildingModel): Polygon2 => {
  const footprint = building.slabs[0]?.footprint ?? building.roof.footprint ?? []
  const angle = -building.rotationDegrees * Math.PI / 180
  const cosine = Math.cos(angle); const sine = Math.sin(angle)
  return footprint.map((point) => ({
    x: building.position.x + point.x * cosine - point.z * sine,
    z: building.position.z + point.x * sine + point.z * cosine,
  }))
}

const segmentDistance = (point: Vec2, start: Vec2, end: Vec2) => {
  const dx = end.x - start.x; const dz = end.z - start.z
  const lengthSquared = dx * dx + dz * dz
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared))
  return Math.hypot(point.x - (start.x + t * dx), point.z - (start.z + t * dz))
}

export const grassBladePoints = (project: ProjectV2): GrassBlade[] => {
  const areas = [
    ...project.site.parcels.filter((parcel) => parcel.landRole === 'agricultural').map((parcel) => parcel.boundary),
    ...project.landscape.zones.filter((zone) => zone.kind === 'lawn').map((zone) => zone.footprint),
  ]
  const exclusions = [
    ...project.buildings.map(buildingFootprint),
    ...project.landscape.zones.filter((zone) => zone.kind !== 'lawn').map((zone) => zone.footprint),
  ]
  const allPoints = areas.flat()
  const minX = Math.min(...allPoints.map((point) => point.x)); const maxX = Math.max(...allPoints.map((point) => point.x))
  const minZ = Math.min(...allPoints.map((point) => point.z)); const maxZ = Math.min(NEAR_FIELD_LIMIT_Z, Math.max(...allPoints.map((point) => point.z)))
  const blades: GrassBlade[] = []

  for (let index = 0; index < CANDIDATE_BLADES; index += 1) {
      const point = {
        x: minX + noise(index, 1, 1) * (maxX - minX),
        z: minZ + noise(index, 2, 2) * (maxZ - minZ),
      }
      if (!areas.some((area) => pointInPolygon(point, area))) continue
      if (exclusions.some((area) => area.length >= 3 && pointInPolygon(point, area))) continue
      if (project.landscape.fixtures.some((fixture) => Math.hypot(point.x - fixture.position.x, point.z - fixture.position.z) < 1.3)) continue
      if (project.site.entrances.some((entrance) => segmentDistance(point, entrance.start, entrance.end) < 1.05)) continue
      blades.push({
        x: point.x,
        y: elevationAt(project, point.x, point.z) + 0.026,
        z: point.z,
        angle: noise(index, 3, 3) * Math.PI * 2,
        height: 0.7 + noise(index, 4, 4) * 0.65,
        shade: noise(index, 5, 5),
      })
  }
  return blades
}

const makeGeometry = (blades: GrassBlade[]) => {
  const geometry = new InstancedBufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([
    -0.012, 0, 0, 0.012, 0, 0,
    -0.008, 0.045, 0, 0.008, 0.045, 0,
    0, 0.09, 0,
  ], 3))
  geometry.setIndex(new Uint16BufferAttribute([0, 1, 2, 2, 1, 3, 2, 3, 4], 1))
  const offsets = new Float32Array(blades.length * 3); const angles = new Float32Array(blades.length); const heights = new Float32Array(blades.length); const shades = new Float32Array(blades.length)
  blades.forEach((blade, index) => {
    const offset = index * 3
    offsets[offset] = blade.x; offsets[offset + 1] = blade.y; offsets[offset + 2] = blade.z
    angles[index] = blade.angle; heights[index] = blade.height; shades[index] = blade.shade
  })
  geometry.setAttribute('offset', new InstancedBufferAttribute(offsets, 3))
  geometry.setAttribute('bladeAngle', new InstancedBufferAttribute(angles, 1))
  geometry.setAttribute('bladeHeight', new InstancedBufferAttribute(heights, 1))
  geometry.setAttribute('bladeShade', new InstancedBufferAttribute(shades, 1))
  geometry.instanceCount = blades.length
  return geometry
}

const vertexShader = `
  attribute vec3 offset;
  attribute float bladeAngle;
  attribute float bladeHeight;
  attribute float bladeShade;
  uniform float time;
  varying float vHeight;
  varying float vShade;
  varying float vDistance;

  void main() {
    float heightFraction = position.y / 0.09;
    float cosine = cos(bladeAngle);
    float sine = sin(bladeAngle);
    vec3 blade = vec3(position.x * cosine, position.y * bladeHeight, -position.x * sine);
    float wind = sin(time * 0.72 + offset.x * 0.31 + offset.z * 0.23) * 0.009 * heightFraction * heightFraction;
    blade.x += wind * cosine;
    blade.z += wind * sine;
    vec4 viewPosition = modelViewMatrix * vec4(offset + blade, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    vHeight = heightFraction;
    vShade = bladeShade;
    vDistance = -viewPosition.z;
  }
`

const fragmentShader = `
  uniform vec3 bottomColor;
  uniform vec3 tipColor;
  uniform vec3 distantColor;
  varying float vHeight;
  varying float vShade;
  varying float vDistance;

  void main() {
    if (vDistance > 64.0) discard;
    vec3 bladeColor = mix(bottomColor, tipColor, smoothstep(0.0, 1.0, vHeight));
    bladeColor *= mix(0.78, 1.12, vShade);
    float detail = 1.0 - smoothstep(24.0, 58.0, vDistance);
    vec3 color = mix(distantColor, bladeColor, detail);
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function RealisticGrass({ project }: { project: ProjectV2 }) {
  const month = useStudioStore((state) => state.month)
  const mesh = useRef<Mesh<InstancedBufferGeometry, ShaderMaterial>>(null)
  const blades = useMemo(() => grassBladePoints(project), [project])
  const geometry = useMemo(() => makeGeometry(blades), [blades])
  const material = useMemo(() => {
    const growing = month >= 4 && month <= 10
    return new ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        bottomColor: { value: new Color(growing ? '#315229' : '#75653c') },
        tipColor: { value: new Color(growing ? '#779454' : '#b59c62') },
        distantColor: { value: new Color(growing ? '#6f8852' : '#a28f62') },
      },
      vertexShader,
      fragmentShader,
      side: DoubleSide,
      depthWrite: true,
      toneMapped: true,
    })
  }, [month])

  useFrame((state) => { material.uniforms.time.value = state.clock.elapsedTime })
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  return <mesh ref={mesh} geometry={geometry} material={material} frustumCulled={false} raycast={() => null} userData={{ editorOnly: true, realisticGrass: true }} />
}
