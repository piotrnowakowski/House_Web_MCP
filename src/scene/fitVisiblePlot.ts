import CameraControls from 'camera-controls'
import { Box3, MathUtils, PerspectiveCamera, Sphere, Vector3 } from 'three'
import { buildingFootprintsWorld, buildingGroundOffset, buildingLocalBounds } from '../domain/geometry'
import type { ProjectV2 } from '../domain/types'

/** Frame the house in the currently visible canvas; opening a sheet never moves the camera. */
export function fitVisiblePlot(
  project: ProjectV2,
  controls: CameraControls,
  camera: PerspectiveCamera,
  canvas: HTMLCanvasElement,
) {
  const building = project.buildings[0]
  const points = building ? buildingFootprintsWorld(building).flat() : project.site.boundary
  const base = building ? buildingGroundOffset(building) : 0
  const local = building && buildingLocalBounds(building)
  const roofRise =
    building && local && building.roof.type !== 'flat'
      ? (Math.tan(MathUtils.degToRad(building.roof.pitchDegrees)) * (local.maxX - local.minX)) / 2
      : 0
  const height = building ? building.roof.baseElevationM + roofRise : 0.1
  const box = new Box3().setFromPoints(
    points.flatMap((p) => [base, base + height].map((y) => new Vector3(p.x, y, p.z))),
  )
  const sphere = box.getBoundingSphere(new Sphere())
  const rect = canvas.getBoundingClientRect()
  const sheet = document.querySelector('.adaptive-sheet')?.getBoundingClientRect()
  const compact = window.matchMedia('(max-width: 900px)').matches
  const landscape = window.matchMedia('(orientation: landscape)').matches
  const top = compact ? 64 : 72
  const bottom = sheet && compact && !landscape ? rect.bottom - sheet.top + 12 : compact ? 72 : 30
  const right = sheet && (!compact || landscape) ? rect.right - sheet.left + 12 : 20
  const width = Math.max(100, rect.width - right - 20)
  const heightPx = Math.max(100, rect.height - bottom - top)
  const vertical = MathUtils.degToRad(camera.fov / 2)
  const horizontal = Math.atan((Math.tan(vertical) * rect.width) / rect.height)
  const angle = Math.min(
    Math.atan((Math.tan(vertical) * heightPx) / rect.height),
    Math.atan((Math.tan(horizontal) * width) / rect.width),
  )
  const distance = (sphere.radius / Math.sin(angle)) * 1.06
  camera.setViewOffset(rect.width, rect.height, (right - 20) / 2, (bottom - top) / 2, rect.width, rect.height)
  const offset = new Vector3(22, 17, 25).normalize().multiplyScalar(distance)
  const { x, y, z } = sphere.center
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  void controls.setFocalOffset(0, 0, 0, smooth)
  void controls.setLookAt(x + offset.x, y + offset.y, z + offset.z, x, y, z, smooth)
}
