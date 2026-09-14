export const TERRAIN_SURFACE_Y = 0

// Coplanar finish meshes need only a sub-centimetre render skin. Physical
// objects use groundContactY so their lowest face remains on the terrain.
export const GROUND_SURFACE_SKIN_M = 0.002

export const groundContactY = (supportHeightM = 0) => {
  if (!Number.isFinite(supportHeightM) || supportHeightM < 0) throw new Error('Ground support height must be a non-negative finite number.')
  return TERRAIN_SURFACE_Y + supportHeightM
}

export const groundSurfaceY = () => TERRAIN_SURFACE_Y + GROUND_SURFACE_SKIN_M

export const groundedBoxCenterY = (heightM: number, supportHeightM = 0) => {
  if (!Number.isFinite(heightM) || heightM <= 0) throw new Error('Grounded object height must be a positive finite number.')
  return groundContactY(supportHeightM) + heightM / 2
}
