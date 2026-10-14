import { describe, expect, it } from 'vitest'
import { ikeaCatalog } from '../domain/ikeaCatalog'
import { interiorCatalog } from '../domain/interior'
import { interiorFinishes } from '../domain/interiorFinishes'
import { interiorMessage, interiorText } from './interiorLocale'

describe('Polish interior display text', () => {
  it('covers every catalogue description, finish, category and assembly note', () => {
    const values = new Set([
      ...ikeaCatalog.flatMap(p => [p.name, p.category, p.finish, p.assemblyNote, p.availabilityNote]),
      ...interiorCatalog.flatMap(p => [p.name, p.category]),
      ...interiorFinishes.map(p => p.name),
    ].filter((v): v is string => !!v))
    expect([...values].filter(value => interiorText(value) === value && value !== 'Kamper')).toEqual([])
  })
  it('preserves user names and explains invalid openings and room resizing in Polish', () => {
    expect(interiorText('Paulina — mój stół')).toBe('Paulina — mój stół')
    expect(interiorMessage('The opening must fit inside its wall.')).toBe('Otwór musi mieścić się w ścianie.')
    expect(interiorMessage('This IKEA configuration needs at least 237 cm of clear height for upright assembly.')).toContain('237 cm')
    expect(interiorMessage('This dimension has no single movable interior side. Move a connected partition or use plot tools for exterior walls.')).toContain('Zmień ściany osobno')
  })
})
