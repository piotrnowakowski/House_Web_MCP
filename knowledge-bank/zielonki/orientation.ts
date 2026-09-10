/** Survey frame: CAD easting/northing (EPSG:2178) to the existing model's x/z axes. */
export const surveyOrigin = { easting: 7421523.183, northing: 5556062.474 }
export const surveyAxisLength = Math.hypot(20.822, 31.644)
export function surveyToModel(easting: number, northing: number) {
  const east = easting - surveyOrigin.easting, north = northing - surveyOrigin.northing
  return { x: (east * 20.822 - north * 31.644) / surveyAxisLength, z: (-east * 31.644 - north * 20.822) / surveyAxisLength }
}
// EPSG:2178 -> WGS84 at the CAD origin; true north includes meridian convergence.
// Derived with PROJ from a constant-longitude step of 0.0001 degrees; see NEIGHBORS.md.
export const zielonkiOrientation = { northDegrees: -124.187875, latitude: 50.135450043, longitude: 19.902235433 }
