/** Match Główny's exterior specifications without moving room boundaries or furniture.
 * Reads immutable r4 snapshots, writes r5, and refuses to overwrite later revisions.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { parseProject } from '../src/domain/schema'
import { validateProject } from '../src/domain/commands'
import { pointOnSegment, polygonBounds, wallLength } from '../src/domain/geometry'
import { atticWallProfile, wallProfileHeightAt } from '../src/domain/attic'
import { roofWings, gableRoofJunction } from '../src/domain/roofWings'
import { gableGlazingProfile } from '../src/domain/gableGlazing'
import type { OpeningModel, ProjectV2, Vec2, WallModel } from '../src/domain/types'

export const exteriorOpeningSources: Record<string, string> = {
  'opening/reference-office-window': 'opening/reference-office-window',
  'opening/reference-entrance': 'opening/reference-entrance',
  'opening/reference-kitchen': 'opening/reference-terrace-north',
  'opening/architekt/living-left': 'opening/reference-terrace-east/right',
  'opening/architekt/living-right': 'opening/reference-terrace-east',
  'opening/architekt/terrace-side': 'opening/living-terrace-door',
  'opening/reference-children-west-window': 'opening/reference-children-west-window',
  'opening/reference-children-east-window': 'opening/reference-children-east-window',
  'opening/architekt/bath-window': 'opening/upper-bathroom-window',
  'opening/architekt/parents-window': 'roof/reference/front-barn/glazing-upper',
  'opening/architekt/void-left': 'roof/reference/rear-barn/glazing-upper/right',
  'opening/architekt/void-right': 'roof/reference/rear-barn/glazing-upper',
}
const clone = <T>(v: T): T => structuredClone(v)
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6
const middle = (w: WallModel, offset: number): Vec2 => ({ x: w.start.x + (w.end.x - w.start.x) * offset / wallLength(w), z: w.start.z + (w.end.z - w.start.z) * offset / wallLength(w) })

export function matchGlownyExterior(input: ProjectV2, glowny: ProjectV2) {
  const project = clone(input), house = project.buildings.find(b => b.ref === 'house/main')!, source = glowny.buildings.find(b => b.ref === house.ref)!
  const perimeter = clone(house.roof.footprint!), bounds = polygonBounds(perimeter)
  const front = house.roof.segments.find(s => s.ref.endsWith('/front-barn'))!, rear = house.roof.segments.find(s => s.ref.endsWith('/rear-barn'))!
  const frontBounds = polygonBounds(front.footprint), rearBounds = polygonBounds(rear.footprint)
  const sourceOpenings = new Map(source.walls.flatMap(w => w.openings.map(o => [o.ref, o] as const)))
  const sourceRear = source.roof.segments.find(s => s.ref === rear.ref)!
  const moved: Array<{ ref: string; before: Vec2; after: Vec2 }> = []
  const exterior = (w: WallModel) => perimeter.some((a, i) => pointOnSegment(w.start, a, perimeter[(i + 1) % perimeter.length]) && pointOnSegment(w.end, a, perimeter[(i + 1) % perimeter.length]))

  for (const wall of house.walls.filter(exterior)) {
    const storey = house.storeys.find(s => s.wallRefs.includes(wall.ref))!
    const dark = storey.level > 0 || near(wall.start.z, bounds.minZ) && near(wall.end.z, bounds.minZ) || near(wall.start.x, bounds.maxX) && near(wall.end.x, bounds.maxX)
    wall.finish = clone(source.walls.find(w => w.ref === (dark ? 'wall/reference-ground/1' : 'wall/carport-layout/ground/3'))!.finish)
    // Główny's gable glazing begins at the knee wall. The roof cap supplies the rest.
    if (storey.level > 0 && (near(wall.start.z, bounds.minZ) && near(wall.end.z, bounds.minZ) || near(wall.start.x, bounds.maxX) && near(wall.end.x, bounds.maxX))) wall.heightM = storey.kneeWallHeightM!
    if (storey.level > 0 && near(wall.start.z, bounds.maxZ) && near(wall.end.z, bounds.maxZ)) wall.heightM = 2.2
  }

  for (const roof of [front, rear]) {
    const original = source.roof.segments.find(s => s.ref === roof.ref)!
    roof.finish = clone(original.finish)
    roof.gableWallFinishes = clone(original.gableWallFinishes)
    roof.gableFrame = clone(original.gableFrame)
    roof.gableGlazing = clone(original.gableGlazing)
    for (const glazing of Object.values(roof.gableGlazing!)) if (glazing?.hostOpeningRefs) glazing.hostOpeningRefs = glazing.hostOpeningRefs.map(ref => Object.entries(exteriorOpeningSources).find(([, value]) => value === ref)?.[0] ?? ref)
  }
  house.roof.finish = clone(source.roof.finish)
  // Extend the roof OUTWARD along its ridge to create the same 1 m recess;
  // retain the facade, rooms, wall-axis span, pitch and ridge intersection.
  const recessDepth = sourceRear.gableRecess!.max!.depthM
  rear.gableRecess = clone(sourceRear.gableRecess)
  rear.footprint = rear.footprint.map(p => ({ ...p, x: near(p.x, rearBounds.maxX) ? p.x + recessDepth : p.x }))
  house.roof.footprint = perimeter.map(p => ({ ...p, x: near(p.x, bounds.maxX) ? p.x + recessDepth : p.x }))

  if (!house.walls.some(w => w.openings.some(o => o.ref === 'opening/architekt/terrace-side'))) {
    const ground = house.storeys.find(s => s.level === 0)!
    const wall = house.walls.find(w => ground.wallRefs.includes(w.ref) && near(w.start.z, rearBounds.maxZ) && near(w.end.z, rearBounds.maxZ) && Math.min(w.start.x, w.end.x) >= frontBounds.maxX - 1e-6)!
    if (!wall) throw Error('Missing courtyard facade for the terrace door')
    wall.openings.push({ ...clone(sourceOpenings.get('opening/living-terrace-door')!), ref: 'opening/architekt/terrace-side', wallRef: wall.ref, offsetM: wallLength(wall) / 2 })
  }

  for (const wall of house.walls) for (let i = 0; i < wall.openings.length; i++) {
    const old = wall.openings[i], sourceRef = exteriorOpeningSources[old.ref]
    if (!sourceRef) continue
    const opening: OpeningModel = { ...clone(sourceOpenings.get(sourceRef)!), ref: old.ref, wallRef: wall.ref, offsetM: old.offsetM }
    const length = wallLength(wall), profile = atticWallProfile(house, wall)
    const fits = (offset: number) => offset - opening.widthM / 2 >= .04 && offset + opening.widthM / 2 <= length - .04
      && (!profile || [offset - opening.widthM / 2, offset + opening.widthM / 2].every(x => wallProfileHeightAt(profile, x) + .0001 >= opening.sillM + opening.heightM))
    if (!fits(opening.offsetM)) {
      const candidates = Array.from({ length: Math.ceil(length * 1000) }, (_, j) => j / 1000).filter(fits)
      candidates.sort((a, b) => Math.abs(a - old.offsetM) - Math.abs(b - old.offsetM))
      if (!candidates.length) throw Error(`Główny specification does not fit ${old.ref}; do not shrink it silently`)
      opening.offsetM = candidates[0]
    }
    if (!near(old.offsetM, opening.offsetM)) moved.push({ ref: old.ref, before: middle(wall, old.offsetM), after: middle(wall, opening.offsetM) })
    wall.openings[i] = opening
  }
  // The paired living panes retain the same central 40 cm pier as Główny,
  // centered on each variant's facade, with exact source pane dimensions.
  for (const refs of [['opening/architekt/living-right', 'opening/architekt/living-left'], ['opening/architekt/void-right', 'opening/architekt/void-left']]) {
    for (const [index, ref] of refs.entries()) {
      const wall = house.walls.find(w => w.openings.some(o => o.ref === ref))!, opening = wall.openings.find(o => o.ref === ref)!
      const z = (rearBounds.minZ + rearBounds.maxZ) / 2 + (index ? 1 : -1) * (.2 + opening.widthM / 2)
      opening.offsetM = Math.abs(z - wall.start.z)
    }
  }
  const sourceCanopy = source.roof.segments.find(s => s.ref.endsWith('/courtyard-canopy'))!
  const canopy = clone(sourceCanopy), oldCanopyBounds = polygonBounds(canopy.footprint)
  const canopyBounds = { minX: frontBounds.maxX, maxX: bounds.maxX + recessDepth, minZ: rearBounds.maxZ, maxZ: frontBounds.maxZ + .04 }
  const canopyPoint = (p: Vec2): Vec2 => ({ x: canopyBounds.minX + (p.x - oldCanopyBounds.minX) / (oldCanopyBounds.maxX - oldCanopyBounds.minX) * (canopyBounds.maxX - canopyBounds.minX), z: canopyBounds.minZ + (p.z - oldCanopyBounds.minZ) / (oldCanopyBounds.maxZ - oldCanopyBounds.minZ) * (canopyBounds.maxZ - canopyBounds.minZ) })
  canopy.footprint = canopy.footprint.map(canopyPoint)
  canopy.canopy!.posts = canopy.canopy!.posts.map(canopyPoint)
  house.roof.segments.push(canopy)
  for (const slab of house.slabs) slab.edgeColorHex = source.slabs.find(s => s.ref === slab.ref)?.edgeColorHex
  const terrace = clone(source.slabs.find(s => s.ref === 'slab/recessed-terrace')!)
  const slabBounds = polygonBounds(house.slabs[0].footprint)
  terrace.footprint = [{ x: slabBounds.maxX, z: slabBounds.minZ }, { x: slabBounds.maxX + recessDepth, z: slabBounds.minZ }, { x: slabBounds.maxX + recessDepth, z: rearBounds.maxZ + (slabBounds.maxX - bounds.maxX) }, { x: slabBounds.maxX, z: rearBounds.maxZ + (slabBounds.maxX - bounds.maxX) }]
  house.slabs.push(terrace)
  house.interiorSource?.notes.push('2026-10-12: user requested Główny window specifications and exterior materials/details while retaining this variant’s footprint and room dimensions. Window locations adapt to the existing rooms. Main gable pitches, ridges, partitions, stairs, furniture and site remain unchanged; roof-only east extension creates the 1 m recessed terrace and courtyard canopy.')
  const errors = validateProject(project).filter(i => i.severity === 'error')
  if (errors.length) throw Error(JSON.stringify(errors, null, 2))
  const roofs = roofWings(house).filter(w => w.type === 'gable').map(w => {
    const b = polygonBounds(w.footprint), span = w.ridgeAxis === 'z' ? b.maxX - b.minX : b.maxZ - b.minZ
    const angle = Math.atan2(w.ridgeElevationM - w.baseElevationM, span / 2) * 180 / Math.PI
    if (angle < 37 || angle > 45) throw Error('Noncompliant main slope')
    return { ref: w.ref, span, angle, ridge: w.ridgeElevationM }
  })
  if (Math.abs(roofs[0].ridge - roofs[1].ridge) > 1e-8 || !gableRoofJunction(house, roofWings(house).find(w => w.ref === rear.ref)!)) throw Error('Broken roof junction')
  const glazing = [front, rear].flatMap(r => Object.keys(r.gableGlazing!).map(side => ({ ref: r.ref, side, panels: gableGlazingProfile(r, side as 'min' | 'max', house)!.panels.length })))
  if (glazing.some(g => !g.panels)) throw Error(`Missing gable glazing: ${JSON.stringify(glazing)}`)
  return { project, report: { moved, roofs, glazing } }
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/match-glowny-exteriors.ts')) {
  const source = parseProject(JSON.parse(readFileSync('project-data/zielonki-rear-bath-room/project.json', 'utf8')))
  mkdirSync('tmp/exterior-match-20261012-iab', { recursive: true })
  for (const slug of ['architekt', 'paulina-poprawki']) {
    const dir = `project-data/${slug}`, path = `${dir}/project.json`, basePath = `${dir}/before-glowny-exterior-r4.json`
    const current = parseProject(JSON.parse(readFileSync(path, 'utf8')))
    if (current.revision > 5) throw Error('Refusing to overwrite a newer publication')
    if (!existsSync(basePath)) {
      if (current.revision !== 4) throw Error('Expected r4 common baseline')
      writeFileSync(basePath, readFileSync(path))
    }
    const base = parseProject(JSON.parse(readFileSync(basePath, 'utf8')))
    const { project, report } = matchGlownyExterior(base, source)
    project.revision = 5; project.updatedAt = current.revision === 5 ? current.updatedAt : new Date().toISOString()
    writeFileSync(path, JSON.stringify(project, null, 2) + '\n')
    writeFileSync(`tmp/exterior-match-20261012-iab/${slug}-geometry.json`, JSON.stringify(report, null, 2))
    console.log(JSON.stringify({ slug, revision: project.revision, ...report }, null, 2))
  }
}
