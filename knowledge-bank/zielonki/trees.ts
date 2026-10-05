/**
 * Tree symbols from the Gmail survey PDF. CAD coordinates below are retained
 * ONLY to recognise and migrate the incorrect version-four placement.
 * This inventory covers the 17 symbols in the construction-area cluster,
 * not distant trees along Krakowskie Przedmiescie or the fruit-tree legend.
 * Coordinates are PL-2000 zone 7; CAD handles provide stable source identities.
 * The map identifies tree categories, not species, heights or crown diameters.
 */
export const zielonkiSurveyTrees = [
  { handle: '5012', category: 'conifer', easting: 7421512.825, northing: 5556073.167 },
  { handle: '5015', category: 'conifer', easting: 7421512.391, northing: 5556070.680 },
  { handle: '5018', category: 'conifer', easting: 7421510.981, northing: 5556071.786 },
  { handle: '501B', category: 'conifer', easting: 7421514.652, northing: 5556069.099 },
  { handle: '501E', category: 'conifer', easting: 7421517.643, northing: 5556064.906 },
  { handle: '5021', category: 'conifer', easting: 7421519.511, northing: 5556063.760 },
  { handle: '5024', category: 'conifer', easting: 7421521.025, northing: 5556062.894 },
  { handle: '5027', category: 'conifer', easting: 7421524.421, northing: 5556060.763 },
  { handle: '502A', category: 'conifer', easting: 7421526.001, northing: 5556059.600 },
  { handle: '502D', category: 'conifer', easting: 7421527.970, northing: 5556058.318 },
  { handle: '5030', category: 'conifer', easting: 7421530.170, northing: 5556056.895 },
  { handle: '5033', category: 'deciduous', easting: 7421527.441, northing: 5556056.848 },
  { handle: '503A', category: 'deciduous', easting: 7421524.316, northing: 5556061.791 },
  { handle: '50F5', category: 'deciduous', easting: 7421515.533, northing: 5556071.951 },
  { handle: '50C3', category: 'fruit', easting: 7421541.665, northing: 5556070.565 },
  { handle: '50CA', category: 'fruit', easting: 7421542.483, northing: 5556067.695 },
  { handle: '50D1', category: 'fruit', easting: 7421539.135, northing: 5556065.796 },
] as const

/** Legacy v4 placement: do not use this unregistered CAD frame for new trees. */
export function legacySurveyTreePosition(easting: number, northing: number) {
  const east = easting - 7421523.183
  const north = northing - 5556062.474
  const dx = 7421520.621 - 7421499.799
  const dy = 5556037.474 - 5556069.118
  const length = Math.hypot(dx, dy)
  return { x: (east * dx + north * dy) / length, z: (east * dy - north * dx) / length }
}

// PDF page coordinates (points, top-left origin), extracted from vector symbols.
const pdfTreeCentres: Record<string, { x: number; z: number }> = Object.fromEntries(
  zielonkiSurveyTrees.map((tree, index) => [tree.handle, [
    [350.70, 700.14], [348.24, 714.30], [340.26, 708.06], [361.02, 723.24],
    [378.00, 747.06], [388.56, 753.54], [397.14, 758.46], [416.40, 770.46],
    [425.34, 777.06], [436.50, 784.38], [448.98, 792.42], [433.50, 792.12],
    [415.86, 764.10], [366.06, 706.50], [514.14, 714.36], [518.82, 730.62], [499.80, 741.36],
  ][index]]).map(([handle, point]) => [handle, { x: (point as number[])[0], z: (point as number[])[1] }]),
)

/**
 * Register the PDF's visible construction-band corners to the displayed /3 band.
 * The displayed parcel geometry is not congruent with this PDF outline; bilinear
 * registration preserves each symbol's relative location, not survey precision.
 * Order: back-left, back-right, garden-right, garden-left. See TREES.md.
 */
export const treeMapRegistration = {
  pdf: [{ x: 419.28, z: 619.68 }, { x: 511.44, z: 753.48 }, { x: 449.04, z: 800.40 }, { x: 307.80, z: 705.96 }],
  model: [{ x: -19.778, z: -15.100 }, { x: 18.210, z: -15.861 }, { x: 19.477, z: 15.883 }, { x: -18.403, z: 15.882 }],
}
type Point = { x: number; z: number }
const mixQuad = ([a, b, c, d]: Point[], u: number, v: number): Point => ({
  x: a.x * (1-u) * (1-v) + b.x * u * (1-v) + c.x * u * v + d.x * (1-u) * v,
  z: a.z * (1-u) * (1-v) + b.z * u * (1-v) + c.z * u * v + d.z * (1-u) * v,
})
export function registerTreeMapPoint(point: Point): Point {
  const [a,b,c,d] = treeMapRegistration.pdf
  let u = 0.5; let v = 0.5
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const p = mixQuad(treeMapRegistration.pdf, u, v)
    const ux = (b.x-a.x)*(1-v)+(c.x-d.x)*v; const uz = (b.z-a.z)*(1-v)+(c.z-d.z)*v
    const vx = (d.x-a.x)*(1-u)+(c.x-b.x)*u; const vz = (d.z-a.z)*(1-u)+(c.z-b.z)*u
    const determinant = ux*vz-uz*vx
    const dx = point.x-p.x; const dz = point.z-p.z
    u += (dx*vz-dz*vx)/determinant
    v += (ux*dz-uz*dx)/determinant
  }
  return mixQuad(treeMapRegistration.model, u, v)
}
export const surveyTreePosition = (handle: string) => registerTreeMapPoint(pdfTreeCentres[handle])

// Reuse the original tree identities instead of drawing four demo duplicates.
export const surveyTreeRef = (handle: string) => ({
  '50F5': 'plant/apple', '50C3': 'plant/orchard-sour-cherry',
  '50CA': 'plant/orchard-pear', '50D1': 'plant/orchard-plum',
}[handle] ?? `plant/survey-${handle.toLowerCase()}`)
