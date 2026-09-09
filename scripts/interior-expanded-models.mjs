/**
 * Independently authored IKEA planning studies for the expanded catalogue.
 * Called by build-interior-assets.mjs with metre dimensions and shared mesh helpers.
 * Adds direct child meshes; the caller merges materials and normalizes the envelope.
 * No downloaded manufacturer geometry or import-time file operations.
 */
import * as THREE from 'three'

export function expandedFurniture(product, mobile, helpers) {
  const { add, box, cylinder, beam, legs, cabinet, material, main, oak, dark, fabric, metal } = helpers
  const [w, d, h] = product.size
  const cloth = material(product.color, 'linen')
  const pine = material('#d4b98e', 'oak')
  const white = material('#eeece5')
  const glass = material('#bfd0cd', 'glass')
  glass.transparent = true
  glass.opacity = 0.28
  glass.roughness = 0.12
  const sphere = (size, position, mat = main) => {
    const mesh = add(new THREE.SphereGeometry(1, mobile ? 16 : 32, mobile ? 10 : 20), position, mat)
    mesh.scale.set(...size.map((value) => value / 2))
    return mesh
  }
  const ring = (radius, thickness, position, mat = main, rotation = [Math.PI / 2, 0, 0]) =>
    add(new THREE.TorusGeometry(radius, thickness, mobile ? 6 : 10, mobile ? 24 : 48), position, mat, rotation)
  const drawer = (width, height, x, y, z, mat = main) => {
    box([width, height, 0.022], [x, y, z], mat)
    cylinder(0.011, 0.022, [x, y, z + 0.02], dark, 0.011, [Math.PI / 2, 0, 0])
  }
  const starBase = (radius, seatHeight, mat = dark, wheels = true) => {
    cylinder(0.027, seatHeight - 0.1, [0, (seatHeight + 0.1) / 2, 0], metal)
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      beam([0, 0.15, 0], [x, 0.055, z], 0.021, mat)
      if (wheels) cylinder(0.032, 0.035, [x, 0.032, z], dark, 0.032, [Math.PI / 2, 0, angle])
    }
  }
  const openShelves = (count, mat = main, back = true) => {
    for (const side of [-1, 1]) box([0.018, h, d], [side * (w - 0.018) / 2, h / 2, 0], mat)
    for (let i = 0; i <= count; i++) box([w - 0.036, 0.018, d], [0, 0.018 + i * (h - 0.036) / count, 0], mat)
    if (back) box([w - 0.036, h - 0.036, 0.005], [0, h / 2, -d / 2 + 0.003], mat)
  }
  switch (product.id) {
    case 'vimle':
    case 'friheten':
    case 'soderhamn': {
      const thin = product.id === 'soderhamn'
      const chaise = !thin
      const arm = thin ? 0.06 : product.id === 'vimle' ? 0.12 : 0.14
      const regular = thin ? d : 0.98
      const bottom = thin ? 0.14 : 0.06
      box([w - arm * 2, 0.21, regular - 0.08], [0, bottom + 0.105, -d / 2 + regular / 2], cloth, 0.035)
      box([w, thin ? 0.42 : 0.53, 0.13], [0, thin ? 0.48 : 0.52, -d / 2 + 0.065], cloth, 0.035)
      for (const side of [-1, 1]) {
        box([arm, thin ? 0.5 : 0.48, regular], [side * (w - arm) / 2, bottom + (thin ? 0.25 : 0.24), -d / 2 + regular / 2], cloth, 0.025)
        for (const z of [-d / 2 + 0.1, -d / 2 + regular - 0.1])
          cylinder(thin ? 0.012 : 0.025, bottom, [side * (w / 2 - 0.1), bottom / 2, z], thin ? metal : dark)
      }
      const seatWidth = (w - arm * 2) / (thin ? 2 : 3)
      for (let i = 0; i < (thin ? 2 : 3); i++) {
        const x = -w / 2 + arm + (i + 0.5) * seatWidth
        const depth = chaise && i === 2 ? d - 0.16 : regular - 0.16
        if (chaise && i === 2) {
          box([seatWidth, 0.24, depth], [x, 0.22, -d / 2 + 0.16 + depth / 2], cloth, 0.03)
          cylinder(0.025, bottom, [x, bottom / 2, d / 2 - 0.05], dark)
        }
        box([seatWidth - 0.012, 0.14, depth], [x, 0.40, -d / 2 + 0.16 + depth / 2], cloth, 0.045)
        box([seatWidth - 0.025, 0.36, 0.18], [x, h - 0.18, -d / 2 + 0.24], cloth, 0.06, [-0.15, 0, 0])
      }
      if (thin) for (const side of [-1, 1])
        box([0.35, 0.32, 0.13], [side * 0.65, 0.62, -0.12], cloth, 0.065, [-0.15, 0, side * 0.2])
      break
    }
    case 'dyvlinge': {
      starBase(0.29, 0.35, dark, false)
      box([0.60, 0.15, 0.53], [0, 0.40, 0.08], cloth, 0.07, [-0.12, 0, 0])
      box([0.62, 0.37, 0.13], [0, 0.52, -0.22], cloth, 0.06, [-0.38, 0, 0])
      if (!mobile) for (let i = -12; i <= 12; i++) {
        box([0.005, 0.33, 0.005], [i * 0.021, 0.54, -0.147], cloth, 0.002, [-0.38, 0, 0])
      }
      break
    }
    case 'stockholm-table':
      cylinder(w / 2 - 0.022, 0.014, [0, h - 0.019, 0], glass)
      ring(w / 2 - 0.022, 0.022, [0, h - 0.022, 0], oak)
      for (let i = 0; i < 3; i++) {
        const angle = i * Math.PI * 2 / 3
        const x = Math.cos(angle) * 0.34, z = Math.sin(angle) * 0.34
        box([0.06, h - 0.04, 0.07], [x, (h - 0.04) / 2, z], oak, 0.01, [0, -angle, 0])
        beam([0, 0.11, 0], [x, 0.11, z], 0.03, oak, false)
      }
      break
    case 'tonstad':
      legs(0.3, 0.045, oak, 0.024)
      box([w, h - 0.23, 0.06], [0, (h + 0.23) / 2, -d / 2 + 0.03], oak, 0.016)
      box([w, 0.24, 0.06], [0, 0.35, d / 2 - 0.03], oak, 0.014)
      for (const side of [-1, 1]) box([0.05, 0.24, d - 0.12], [side * (w - 0.05) / 2, 0.35, 0], oak)
      box([1.60, 0.17, 2], [0, 0.49, 0], fabric, 0.03)
      box([1.61, 0.035, 1.3], [0, 0.59, 0.33], material('#aeb6a2', 'linen'), 0.012)
      for (const side of [-1, 1]) box([0.65, 0.1, 0.38], [side * 0.40, 0.61, -0.70], fabric, 0.04)
      break
    case 'brimnes':
      box([w, 0.025, d], [0, 0.0125, 0])
      for (const z of [-1, 1]) box([w, h, 0.028], [0, h / 2, z * (d - 0.028) / 2])
      box([w - 0.055, 0.08, d - 0.055], [0, h - 0.065, 0], fabric, 0.012)
      for (const side of [-1, 1]) for (const end of [-1, 1]) {
        box([0.022, 0.30, d / 2 - 0.025], [side * (w - 0.022) / 2, 0.18, end * d / 4])
        box([0.023, 0.016, 0.28], [side * w / 2, 0.28, end * d / 4], metal)
      }
      break
    case 'hemnes-daybed':
      box([w, 0.36, d - 0.025], [0, 0.22, 0])
      box([w, 0.42, 0.04], [0, h - 0.21, -d / 2 + 0.02])
      for (const side of [-1, 1]) box([0.04, h, d], [side * (w - 0.04) / 2, h / 2, 0])
      for (let i = 0; i < 3; i++) drawer(w / 3 - 0.025, 0.27, (i - 1) * w / 3, 0.21, d / 2 - 0.015)
      box([2, 0.10, 0.80], [0, 0.43, 0], fabric, 0.025)
      break
    case 'nasinge':
    case 'flisat':
      box([w, 0.027, d], [0, h - 0.0135, 0], product.id === 'flisat' ? pine : main, 0.008)
      legs(h - 0.027, 0.04, product.id === 'flisat' ? pine : main, 0.027)
      if (product.id === 'nasinge') {
        box([w - 0.1, 0.075, d - 0.08], [0, h - 0.065, 0])
        box([0.003, 0.001, d - 0.015], [0, h + 0.0005, 0], material('#c6c6be'))
      } else for (const side of [-1, 1]) {
        box([w / 2 - 0.055, 0.012, d - 0.055], [side * w / 4, h + 0.003, 0], white, 0.008)
        cylinder(0.014, 0.002, [side * 0.03, h + 0.01, 0], dark)
      }
      break
    case 'norden': {
      const centre = -0.315
      box([0.26, 0.025, d], [centre, h - 0.0125, 0])
      box([0.63, 0.025, d], [centre + 0.445, h - 0.0125, 0])
      box([0.025, 0.63, d], [centre - 0.14, h - 0.34, 0])
      for (const x of [centre - 0.1, centre + 0.1, centre + 0.62]) for (const z of [-1, 1])
        box([0.035, h - 0.025, 0.035], [x, (h - 0.025) / 2, z * (d / 2 - 0.05)])
      for (let i = 0; i < 3; i++) for (const side of [-1, 1])
        drawer(0.18, 0.18, centre, 0.2 + i * 0.2, side * (d / 2 - 0.022))
      break
    }
    case 'bergmund':
      legs(0.46, 0.055, dark, 0.022)
      box([0.52, 0.12, 0.48], [0, 0.47, 0.03], cloth, 0.033)
      box([0.45, 0.49, 0.07], [0, 0.71, -0.23], cloth, 0.035, [-0.10, 0, 0])
      break
    case 'pax-tall':
    case 'pax-wide':
    case 'pax-wide-tall':
      for (let i = 0; i < Math.round(w); i++) cabinet(1, 2, 0, 1, d, h, -w / 2 + i + 0.5)
      break
    case 'platsa':
    case 'platsa-tall':
      for (let i = 0; i < 3; i++) {
        const x = -0.6 + i * 0.6
        cabinet(1, 1, 0, 0.6, d, 1.8, x, 0.011)
        if (product.id === 'platsa-tall') cabinet(0, 1, 0, 0.6, d, 0.599, x, 1.811)
        for (const z of [-1, 1]) cylinder(0.022, 0.011, [x, 0.0055, z * (d / 2 - 0.05)])
      }
      break
    case 'billy-tall':
      cabinet(5, 0, 0, w, d, 2.02)
      cabinet(0, 0, 0, w, d, 0.35, 0, 2.02)
      break
    case 'billy-oxberg':
    case 'billy-oxberg-tall': {
      cabinet(5, 0, 0, w, d - 0.02, 2.02)
      for (const side of [-1, 1]) {
        const x = side * w / 4, dw = w / 2 - 0.006
        box([dw - 0.05, 1.90, 0.008], [x, 1.02, d / 2 - 0.013], glass)
        for (const edge of [-1, 1]) box([0.032, 1.97, 0.02], [x + edge * (dw - 0.032) / 2, 1.02, d / 2 - 0.01])
        for (const y of [0.05, 0.94, 1.98]) box([dw, 0.036, 0.02], [x, y, d / 2 - 0.01])
        box([dw - 0.055, 0.83, 0.012], [x, 0.495, d / 2 - 0.016])
        cylinder(0.009, 0.015, [side * 0.045, 1, d / 2], dark, 0.009, [Math.PI / 2, 0, 0])
      }
      if (product.id.endsWith('tall')) {
        cabinet(0, 0, 0, w, d, 0.35, 0, 2.02)
        for (const side of [-1, 1]) {
          box([w / 2 - 0.05, 0.30, 0.008], [side * w / 4, 2.195, d / 2 - 0.008], glass)
          for (const y of [2.045, 2.35]) box([w / 2 - 0.006, 0.03, 0.02], [side * w / 4, y, d / 2 - 0.01])
        }
      }
      break
    }
    case 'ivar':
    case 'ivar-tall': {
      for (const x of [-1, 1]) for (const z of [-1, 1]) box([0.044, h, 0.035], [x * (w - 0.044) / 2, h / 2, z * (d - 0.035) / 2], pine)
      const levels = product.id === 'ivar' ? 5 : 6
      for (let i = 0; i < levels; i++) box([w, 0.018, d], [0, 0.06 + i * (h - 0.078) / (levels - 1), 0], pine)
      beam([-w / 2 + 0.04, 0.4, -d / 2], [w / 2 - 0.04, h - 0.3, -d / 2], 0.004, metal)
      beam([w / 2 - 0.04, 0.4, -d / 2], [-w / 2 + 0.04, h - 0.3, -d / 2], 0.004, metal)
      if (product.id === 'ivar-tall') for (const side of [-1, 1]) {
        box([0.36, 0.30, d - 0.025], [side * 0.20, 0.22, 0], pine)
        box([0.09, 0.025, 0.006], [side * 0.20, 0.30, d / 2 - 0.009], dark)
      }
      break
    }
    case 'baggebo':
      for (const x of [-1, 1]) for (const z of [-1, 1]) box([0.013, h, 0.013], [x * (w - 0.013) / 2, h / 2, z * (d - 0.013) / 2])
      for (const y of [0.12, 0.45, 0.80, h - 0.009]) box([w, 0.012, d], [0, y, 0], y > 0.2 && y < 1 ? glass : main)
      for (const side of [-1, 1]) box([0.005, h - 0.15, d - 0.025], [side * (w - 0.015) / 2, (h + 0.12) / 2, 0], material('#e0e4dd', 'mesh'))
      box([w - 0.025, h - 0.15, 0.008], [0, (h + 0.12) / 2, -d / 2 + 0.008], material('#e0e4dd', 'mesh'))
      box([w - 0.028, h - 0.15, 0.006], [0, (h + 0.12) / 2, d / 2 - 0.003], glass)
      cylinder(0.009, 0.018, [w / 2 - 0.05, h * 0.53, d / 2], dark, 0.009, [Math.PI / 2, 0, 0])
      break
    case 'trones':
      box([w, h, d], [0, h / 2, 0], main, 0.028)
      box([w - 0.03, h - 0.065, 0.018], [0, h / 2 - 0.014, d / 2], main, 0.016)
      box([0.16, 0.014, 0.018], [0, h - 0.043, d / 2], material('#bbbdb6'), 0.005)
      break
    case 'mittzon':
      box([w, 0.025, d], [0, h - 0.0125, 0])
      for (const side of [-1, 1]) {
        box([0.065, h - 0.055, 0.065], [side * (w / 2 - 0.18), (h + 0.015) / 2, 0])
        box([0.075, 0.035, d - 0.04], [side * (w / 2 - 0.18), 0.0175, 0], main, 0.01)
      }
      box([w - 0.30, 0.055, 0.09], [0, h - 0.065, 0])
      box([w - 0.06, 0.003, 0.10], [0, h + 0.001, -d / 2 + 0.07], material('#dbdcd6'))
      break
    case 'jarvfjallet':
      starBase(0.32, 0.52, metal)
      box([0.50, 0.08, 0.49], [0, 0.53, 0.04], main, 0.04)
      box([0.042, 0.70, 0.045], [0, 0.91, -0.23], metal)
      box([0.46, 0.60, 0.035], [0, 0.94, -0.24], material('#464e4a', 'mesh'), 0.045, [-0.09, 0, 0])
      box([0.33, 0.18, 0.085], [0, h - 0.09, -0.28], main, 0.05)
      for (const side of [-1, 1]) {
        beam([side * 0.22, 0.52, 0], [side * 0.30, 0.75, 0], 0.018, metal)
        box([0.065, 0.04, 0.25], [side * 0.30, 0.76, 0.02], main, 0.012)
      }
      break
    case 'vadholma':
      box([w, 0.035, d], [0, h - 0.0175, 0], oak)
      for (const x of [-1, 1]) for (const z of [-1, 1]) box([0.055, h - 0.035, 0.055], [x * (w / 2 - 0.06), (h - 0.035) / 2, z * (d / 2 - 0.07)])
      for (const y of [0.08, 0.44]) box([w - 0.13, 0.025, d * 0.47], [0, y, -d * 0.19])
      box([w - 0.13, h - 0.09, 0.02], [0, (h + 0.01) / 2, 0.01])
      break
    case 'metod-high-standard':
    case 'metod-tall':
      cabinet(0)
      box([w - 0.036, 0.018, d - 0.03], [0, 0.62, 0])
      break
    case 'metod-wall-tall':
      cabinet(0)
      break
    case 'havback':
      for (const side of [-1, 1]) cabinet(0, 0, 2, 0.60, d - 0.015, 0.63, side * 0.30)
      box([w, 0.02, d], [0, 0.64, 0], oak)
      // Open basin rim and recessed bottom, rather than a solid white block.
      box([0.50, 0.018, 0.44], [0, 0.657, 0], white, 0.014)
      for (const side of [-1, 1]) {
        box([0.028, 0.06, 0.44], [side * 0.236, h - 0.03, 0], white, 0.012)
        box([0.46, 0.06, 0.028], [0, h - 0.03, side * 0.206], white, 0.012)
      }
      cylinder(0.018, 0.001, [0, 0.667, 0], metal)
      break
    case 'nysjon':
      cabinet(3, 1, 0, w, d, h - 0.13, 0, 0.13)
      legs(0.13, 0.025, main, 0.015)
      box([0.009, 0.10, 0.018], [w / 2 - 0.03, h * 0.52, d / 2], metal)
      break
    case 'kura':
      for (const x of [-1, 1]) for (const z of [-1, 1]) box([0.044, h, 0.044], [x * (w - 0.044) / 2, h / 2, z * (d - 0.044) / 2], pine)
      box([w - 0.08, 0.035, d - 0.08], [0, 0.83, 0], pine)
      for (const z of [-1, 1]) {
        box([w - 0.06, 0.22, 0.018], [0, 0.995, z * (d - 0.044) / 2], white)
        box([w, 0.035, 0.035], [0, h - 0.02, z * (d - 0.044) / 2], pine)
      }
      box([0.018, 0.23, d - 0.08], [-w / 2 + 0.025, 0.995, 0], white)
      box([0.035, 0.035, d], [-w / 2 + 0.025, h - 0.02, 0], pine)
      box([0.018, 0.23, d - 0.49], [w / 2 - 0.025, 0.995, -0.205], white)
      box([0.035, 0.035, d - 0.43], [w / 2 - 0.025, h - 0.02, -0.215], pine)
      for (const z of [d / 2 - 0.44, d / 2 - 0.045]) box([0.044, 0.88, 0.035], [w / 2 - 0.03, 0.44, z], pine)
      for (const y of [0.22, 0.44, 0.66]) box([0.065, 0.026, 0.4], [w / 2 - 0.03, y, d / 2 - 0.24], pine)
      box([0.90, 0.08, 2], [0, 0.89, 0], fabric, 0.015)
      break
    case 'trofast':
      for (let i = 0; i < 3; i++) {
        const x = -w / 2 + (i + 0.5) * w / 3, height = h - i * 0.23
        for (const side of [-1, 1]) box([0.02, height, d], [x + side * (w / 3 - 0.02) / 2, height / 2, 0], pine)
        box([w / 3, 0.02, d], [x, height - 0.01, 0], pine)
        for (let j = 0; j < 3 - i; j++) {
          const mat = j % 2 ? material('#a0b0ad') : white
          box([w / 3 - 0.045, 0.19, d - 0.018], [x, 0.14 + j * 0.23, 0], mat, 0.015)
          box([0.08, 0.02, 0.004], [x, 0.20 + j * 0.23, d / 2 - 0.004], dark, 0.005)
        }
      }
      break
    case 'regnskur':
      sphere([w, h - 0.03, d], [0, h / 2 - 0.005, 0], cloth)
      cylinder(0.055, 0.03, [0, h - 0.015, 0], white)
      if (!mobile) for (let i = 0; i < 12; i++)
        ring(0.20, 0.0015, [0, h / 2, 0], cloth, [0, i * Math.PI / 12, 0])
      break
    case 'hektar':
      cylinder(0.17, 0.028, [-0.08, 0.014, 0])
      beam([-0.08, 0.028, 0], [-0.08, 1.56, 0], 0.015, main)
      beam([-0.08, 1.56, 0], [0.11, 1.69, 0], 0.018, main)
      cylinder(0.1575, 0.30, [0.09, 1.64, 0], main, 0.125, [0, 0, -0.30])
      cylinder(0.14, 0.005, [0.134, 1.495, 0], material('#e9e3d3'), 0.14, [0, 0, -0.30])
      break
    case 'fado':
      cylinder(0.067, 0.035, [0, 0.0175, 0], pine)
      sphere([w, h - 0.015, d], [0, (h + 0.015) / 2, 0], white)
      break
    case 'lindbyn': {
      const mirror = material('#b0c6ca', 'mirror')
      mirror.metalness = 0.55
      mirror.roughness = 0.15
      cylinder(w / 2 - 0.009, d * 0.6, [0, h / 2, 0], mirror, w / 2 - 0.009, [Math.PI / 2, 0, 0])
      ring(w / 2 - 0.009, 0.009, [0, h / 2, 0], main, [0, 0, 0])
      break
    }
    case 'stoense':
      box([w, h, d], [0, h / 2, 0], cloth, 0.003)
      break
    case 'kallax-large':
      openShelves(4, main, false)
      for (let i = 1; i < 4; i++) box([0.018, h - 0.036, d], [-w / 2 + i * w / 4, h / 2, 0])
      break
    default:
      throw new Error(`Missing authored model for ${product.id}`)
  }
}
