/**
 * Tree symbols verified against the survey PDF emailed to the architect.
 * CAD coordinates use the same model frame as the MPZP boundary.
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

/** PL-2000 zone 7 to the model frame used by the parcel and MPZP geometry. */
export function surveyMapPosition(easting: number, northing: number) {
  const east = easting - 7421523.183
  const north = northing - 5556062.474
  const dx = 7421520.621 - 7421499.799
  const dy = 5556037.474 - 5556069.118
  const length = Math.hypot(dx, dy)
  return { x: (east * dx + north * dy) / length, z: (east * dy - north * dx) / length }
}

export const surveyTreePosition = (handle: string) => {
  const tree = zielonkiSurveyTrees.find((item) => item.handle === handle)
  if (!tree) throw new Error(`Unknown survey tree: ${handle}`)
  return surveyMapPosition(tree.easting, tree.northing)
}

// Reuse the original tree identities instead of drawing four demo duplicates.
export const surveyTreeRef = (handle: string) => ({
  '50F5': 'plant/apple', '50C3': 'plant/orchard-sour-cherry',
  '50CA': 'plant/orchard-pear', '50D1': 'plant/orchard-plum',
}[handle] ?? `plant/survey-${handle.toLowerCase()}`)
