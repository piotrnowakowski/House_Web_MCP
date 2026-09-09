import { interiorCorners } from '../domain/interior'
import { ikeaProduct } from '../domain/ikeaCatalog'
import { polygonBounds, polygonCentroid, spaceFootprint } from '../domain/geometry'
import { roomDimensions } from '../domain/roomDimensions'
import type { BuildingModel, ProjectV2, StoreyModel } from '../domain/types'

export function downloadInteriorFile(filename: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function furnitureList(project: ProjectV2) {
  const rows = new Map<
    string,
    { name: string; article: string; finish: string; size: string; quantity: number; url: string }
  >()
  for (const building of project.buildings)
    for (const item of building.furniture ?? []) {
      const product = ikeaProduct(item.productId)
      const size = [item.widthM, item.depthM, item.heightM].map((n) => +(n * 100).toFixed(1)).join(' × ')
      const key = `${item.productId ?? item.name}/${item.variantId ?? ''}/${size}/${item.color}`
      const existing = rows.get(key)
      if (existing) existing.quantity++
      else
        rows.set(key, {
          name: product ? `${product.family} ${product.name}` : item.name,
          article: product?.articleNumber ?? '',
          finish: product?.finish ?? item.color,
          size,
          quantity: 1,
          url: product?.productUrl ?? '',
        })
    }
  return [...rows.values()]
}

export function furnitureCsv(project: ProjectV2) {
  const escape = (value: unknown) =>
    `"${String(value)
      .replace(/^[=+@-]/, "'$&")
      .replaceAll('"', '""')}"`
  return [
    ['Product', 'Article', 'Finish', 'Width × depth × height (cm)', 'Quantity', 'Product link'],
    ...furnitureList(project).map((row) => [row.name, row.article, row.finish, row.size, row.quantity, row.url]),
  ]
    .map((row) => row.map(escape).join(','))
    .join('\r\n')
}

const escapeXml = (value: string) =>
  value.replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]!)

/** Dimensioned semantic plan, independent of camera angle or canvas resolution. */
export function interiorPlanSvg(building: BuildingModel, storey: StoreyModel) {
  const slab = building.slabs.find((item) => item.ref === storey.baseSlabRef)!
  const bounds = polygonBounds(slab.footprint)
  const scale = 50
  const margin = 55
  const width = (bounds.maxX - bounds.minX) * scale + margin * 2
  const height = (bounds.maxZ - bounds.minZ) * scale + margin * 2
  const x = (n: number) => (n - bounds.minX) * scale + margin
  const z = (n: number) => (n - bounds.minZ) * scale + margin
  const points = (polygon: { x: number; z: number }[]) => polygon.map((p) => `${x(p.x)},${z(p.z)}`).join(' ')
  const walls = building.walls
    .filter((wall) => storey.wallRefs.includes(wall.ref))
    .map(
      (wall) =>
        `<line x1="${x(wall.start.x)}" y1="${z(wall.start.z)}" x2="${x(wall.end.x)}" y2="${z(wall.end.z)}" stroke="#283b36" stroke-width="${wall.thicknessM * scale}"/>`,
    )
  const openings = building.walls
    .filter((wall) => storey.wallRefs.includes(wall.ref))
    .flatMap((wall) =>
      wall.openings.map((opening) => {
        const length = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z)
        const dx = (wall.end.x - wall.start.x) / length
        const dz = (wall.end.z - wall.start.z) / length
        const start = opening.offsetM - opening.widthM / 2
        const end = opening.offsetM + opening.widthM / 2
        return `<line x1="${x(wall.start.x + start * dx)}" y1="${z(wall.start.z + start * dz)}" x2="${x(wall.start.x + end * dx)}" y2="${z(wall.start.z + end * dz)}" stroke="${opening.kind === 'door' ? '#ffffff' : '#a9cbd1'}" stroke-width="${wall.thicknessM * scale + 1}"/>`
      }),
    )
  const furniture = (building.furniture ?? [])
    .filter((item) => item.storeyRef === storey.ref)
    .map(
      (item) =>
        `<polygon points="${points(interiorCorners(item))}" fill="${item.color}" fill-opacity="0.35" stroke="#718076" stroke-width="0.8"/><text x="${x(item.position.x)}" y="${z(item.position.z)}" text-anchor="middle" font-size="8">${escapeXml(ikeaProduct(item.productId)?.family ?? item.name)}</text>`,
    )
  const rooms = building.spaces
    .filter((room) => storey.spaceRefs.includes(room.ref))
    .map((room) => {
      const centre = polygonCentroid(spaceFootprint(building, room))
      const dims = roomDimensions(building, room)
      return `<text x="${x(centre.x)}" y="${z(centre.z) - 16}" text-anchor="middle" font-size="11" font-weight="600">${escapeXml(room.name)}</text><text x="${x(centre.x)}" y="${z(centre.z) - 4}" text-anchor="middle" font-size="9">${dims.width.toFixed(2)} × ${dims.depth.toFixed(2)} m · ${dims.area.toFixed(2)} m²</text>`
    })
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="width:100%;max-height:68vh;font-family:Arial,sans-serif;background:white"><polygon points="${points(slab.footprint)}" fill="#fbfaf6"/>${(slab.holes ?? []).map((hole) => `<polygon points="${points(hole)}" fill="#d9dbd4"/>`).join('')}${furniture.join('')}${walls.join('')}${openings.join('')}${rooms.join('')}<text x="${width / 2}" y="25" text-anchor="middle" font-size="12">${(bounds.maxX - bounds.minX).toFixed(2)} m</text><text x="12" y="${height / 2}" font-size="12" transform="rotate(-90 12 ${height / 2})">${(bounds.maxZ - bounds.minZ).toFixed(2)} m</text></svg>`
}

export function printInteriorPlan(project: ProjectV2, building: BuildingModel, storey: StoreyModel) {
  const win = window.open('', '_blank')
  if (!win) throw new Error('Allow the print window, then try again.')
  const rows = furnitureList(project)
    .map(
      (row) =>
        `<tr><td>${escapeXml(row.name)}</td><td>${escapeXml(row.article)}</td><td>${escapeXml(row.size)}</td><td>${row.quantity}</td></tr>`,
    )
    .join('')
  win.document.write(
    `<!doctype html><html><head><title>${escapeXml(project.name)} · Interior plan</title><style>body{font:12px Arial;margin:28px;color:#243b30}h1{font-size:22px}table{border-collapse:collapse;width:100%}td,th{padding:7px;text-align:left;border-bottom:1px solid #ddd}button{padding:12px}@media print{button{display:none}@page{size:A4 landscape;margin:12mm}body{margin:0}table{break-before:page}}</style></head><body><button onclick="window.print()">Print / Save as PDF</button><h1>${escapeXml(project.name)} · ${escapeXml(storey.name)}</h1>${interiorPlanSvg(building, storey)}<p>Dimensions in metres. Furniture envelope sizes in centimetres. Concept planning drawing.</p><table><thead><tr><th>Furniture</th><th>Article</th><th>W × D × H (cm)</th><th>Qty</th></tr></thead><tbody>${rows}</tbody></table></body></html>`,
  )
  win.document.close()
}
