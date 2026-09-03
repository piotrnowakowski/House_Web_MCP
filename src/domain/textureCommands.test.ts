import { describe, expect, it } from 'vitest'
import { applyCommand } from './commands'
import { diffProjects } from './diff'
import { modernBarnProject, sampleProject } from './sampleProject'
import { parseProject } from './schema'
import { wallFinishCommands } from './wallFinishes'

const wall = (project = sampleProject) => ({ buildingRef: project.buildings[0].ref, wallRef: project.buildings[0].walls[0].ref })
const unlocked = () => { const project = structuredClone(sampleProject); for (const zone of project.landscape.zones) zone.locked = false; return project }

describe('texture choices in the command bus', () => {
  it('stores a chosen wall scan with the finish and keeps the material default when omitted', () => {
    const { buildingRef, wallRef } = wall()
    const chosen = applyCommand(sampleProject, { type: 'wall.finish', buildingRef, wallRef, material: 'brick', colorHex: '#8b4e3c', textureId: 'brick-floor' })
    expect(chosen.buildings[0].walls[0].finish).toEqual({ material: 'brick', colorHex: '#8B4E3C', textureId: 'brick-floor' })
    const defaulted = applyCommand(sampleProject, { type: 'wall.finish', buildingRef, wallRef, material: 'brick', colorHex: '#8B4E3C' })
    expect(defaulted.buildings[0].walls[0].finish).toEqual({ material: 'brick', colorHex: '#8B4E3C' })
    const flat = applyCommand(sampleProject, { type: 'wall.finish', buildingRef, wallRef, material: 'brick', colorHex: '#8B4E3C', textureId: 'none' })
    expect(flat.buildings[0].walls[0].finish?.textureId).toBe('none')
  })

  it('rejects wall scans that are not made for walls or do not exist', () => {
    const { buildingRef, wallRef } = wall()
    expect(() => applyCommand(sampleProject, { type: 'wall.finish', buildingRef, wallRef, material: 'brick', colorHex: '#8B4E3C', textureId: 'leafy-grass' })).toThrow(/wall/)
    expect(() => applyCommand(sampleProject, { type: 'wall.finish', buildingRef, wallRef, material: 'brick', colorHex: '#8B4E3C', textureId: 'marble' })).toThrow(/list_textures/)
    expect(() => wallFinishCommands(sampleProject, { buildingRef, scope: 'all-exterior', material: 'brick', colorHex: '#8B4E3C', textureId: 'dirt' })).toThrow(/wall/)
  })

  it('passes the scan choice through every command of an all-exterior finish', () => {
    const commands = wallFinishCommands(modernBarnProject, { buildingRef: 'house/main', scope: 'all-exterior', material: 'natural-timber', colorHex: '#8A6544', textureId: 'coated-pine' })
    expect(commands.length).toBeGreaterThan(1)
    expect(commands.every((command) => command.textureId === 'coated-pine')).toBe(true)
  })

  it('sets and clears a zone surface without touching its footprint', () => {
    const base = unlocked(); const terrace = base.landscape.zones.find((zone) => zone.kind === 'terrace')!
    const surfaced = applyCommand(base, { type: 'landscape.update', action: 'set-surface', zoneRef: terrace.ref, textureId: 'brick-pavement' })
    const next = surfaced.landscape.zones.find((zone) => zone.ref === terrace.ref)!
    expect(next.textureId).toBe('brick-pavement')
    expect(next.footprint).toEqual(terrace.footprint)
    const flat = applyCommand(surfaced, { type: 'landscape.update', action: 'set-surface', zoneRef: terrace.ref, textureId: 'none' })
    expect(flat.landscape.zones.find((zone) => zone.ref === terrace.ref)!.textureId).toBe('none')
    expect(() => applyCommand(base, { type: 'landscape.update', action: 'set-surface', zoneRef: terrace.ref })).toThrow(/textureId/)
    expect(() => applyCommand(base, { type: 'landscape.update', action: 'set-surface', zoneRef: terrace.ref, textureId: 'hinoki' })).toThrow(/ground/)
  })

  it('accepts a surface when adding a zone and refuses to resurface a locked zone', () => {
    const added = applyCommand(sampleProject, { type: 'landscape.update', action: 'add', zoneRef: 'zone/herbs', name: 'Herbs', kind: 'vegetable', footprint: [{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: 2, z: 2 }, { x: 0, z: 2 }], textureId: 'forest-floor' })
    expect(added.landscape.zones.find((zone) => zone.ref === 'zone/herbs')?.textureId).toBe('forest-floor')
    const locked = structuredClone(sampleProject); locked.landscape.zones[0].locked = true
    expect(() => applyCommand(locked, { type: 'landscape.update', action: 'set-surface', zoneRef: locked.landscape.zones[0].ref, textureId: 'dirt' })).toThrow(/locked/)
  })

  it('round-trips scan choices through the persisted schema and reports them in diffs', () => {
    const base = unlocked(); const terrace = base.landscape.zones.find((zone) => zone.kind === 'terrace')!
    const { buildingRef, wallRef } = wall()
    const edited = applyCommand(applyCommand(base, { type: 'landscape.update', action: 'set-surface', zoneRef: terrace.ref, textureId: 'square-tiles' }), { type: 'wall.finish', buildingRef, wallRef, material: 'brick', colorHex: '#8B4E3C', textureId: 'brick-floor' })
    const parsed = parseProject(JSON.parse(JSON.stringify(edited)))
    expect(parsed.landscape.zones.find((zone) => zone.ref === terrace.ref)?.textureId).toBe('square-tiles')
    expect(parsed.buildings[0].walls[0].finish?.textureId).toBe('brick-floor')
    expect(parseProject(JSON.parse(JSON.stringify(sampleProject))).landscape.zones.every((zone) => zone.textureId === undefined)).toBe(true)
    const diff = diffProjects(base, edited)
    expect(diff.changes.some((change) => change.kind === 'zone' && change.ref === terrace.ref)).toBe(true)
    expect(diff.changes.some((change) => change.kind === 'wall' && change.ref === wallRef)).toBe(true)
  })
})
