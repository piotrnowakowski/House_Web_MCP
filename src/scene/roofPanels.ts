/** Thickness of the rendered roof sheets, centred on the model's slope planes. */
export const roofPanelThicknessM = .2

/** Vertical inset needed to place a lining below the underside of a sloping sheet. */
export const roofLiningInsetM = (pitchDegrees: number) => roofPanelThicknessM / (2 * Math.cos(pitchDegrees * Math.PI / 180)) + .005
