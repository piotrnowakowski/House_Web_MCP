import { describe, expect, it } from 'vitest'
import { applyCommand } from './commands'
import { createIkeaItem, ikeaCatalog, ikeaHeightVariants, withIkeaHeightVariant } from './ikeaCatalog'
import { placementWarnings } from './interiorPlacement'
import { parseProject } from './schema'
import { sampleProject } from './sampleProject'
import { useStudioStore } from '../state/store'

const base = { type: 'interior.update' as const, buildingRef: 'house/main', storeyRef: 'storey/ground' }
const position = { x: -3, z: 2 }
function projectWithHeight(height = 3) {
  const project = structuredClone(sampleProject)
  project.buildings[0].ceilingFinishes = []
  project.buildings[0].storeys[0].clearHeightM = height
  return project
}

describe('Expanded IKEA catalogue and real height configurations', () => {
  it('places and reloads all 32 requested configurations at their catalogue dimensions', () => {
    const ids = ['vimle', 'soderhamn', 'friheten', 'dyvlinge', 'stockholm-table', 'tonstad', 'brimnes',
      'hemnes-daybed', 'nasinge', 'norden', 'bergmund', 'platsa', 'ivar', 'baggebo', 'trones', 'mittzon',
      'jarvfjallet', 'vadholma', 'metod-tall', 'havback', 'nysjon', 'kura', 'trofast', 'flisat',
      'regnskur', 'hektar', 'fado', 'lindbyn', 'stoense', 'kallax-large', 'billy-oxberg', 'pax-wide-tall']
    for (const id of ids) {
      const product = ikeaCatalog.find((entry) => entry.id === id)!
      const item = createIkeaItem(id, base.storeyRef, position)
      const saved = parseProject(JSON.parse(JSON.stringify(applyCommand(projectWithHeight(), { ...base, action: 'put', item }))))
      expect(saved.buildings[0].furniture?.[0]).toMatchObject({
        productId: id, variantId: product.articleNumber,
        widthM: product.size[0], depthM: product.size[1], heightM: product.size[2],
      })
    }
  })

  it('changes each supported cabinet to its own assembly, including top modules, with no invented ceiling size', () => {
    const pairs = [
      ['pax', 'pax-tall', 2.364], ['pax-wide', 'pax-wide-tall', 2.364],
      ['billy', 'billy-tall', 2.37], ['billy-oxberg', 'billy-oxberg-tall', 2.37],
      ['platsa', 'platsa-tall', 2.41], ['ivar', 'ivar-tall', 2.264],
      ['metod-high-standard', 'metod-tall', 2.2], ['metod-wall', 'metod-wall-tall', 1],
    ] as const
    for (const [standard, tall, height] of pairs) {
      const original = { ...createIkeaItem(standard, base.storeyRef, position), name: 'My cabinet', rotationDegrees: 35, groupRef: 'group/study' }
      const item = withIkeaHeightVariant(original, tall)
      expect(item).toMatchObject({ ref: original.ref, name: 'My cabinet', rotationDegrees: 35, groupRef: 'group/study', position, heightM: height })
      expect(withIkeaHeightVariant(item, standard)).toEqual(original)
      expect(ikeaHeightVariants(standard).map((entry) => entry.id)).toEqual([standard, tall])
    }
    expect(ikeaHeightVariants('nysjon')).toEqual([])
    expect(() => withIkeaHeightVariant(createIkeaItem('pax', base.storeyRef, position), 'platsa-tall')).toThrow(/configuration/)
  })

  it('rejects too-low ceilings and assembly clearance without mutating the project', () => {
    const item = createIkeaItem('pax-tall', base.storeyRef, position)
    expect(() => applyCommand(projectWithHeight(2.36), { ...base, action: 'put', item })).toThrow(/taller/)
    const tight = projectWithHeight(2.366)
    expect(() => applyCommand(tight, { ...base, action: 'put', item })).toThrow(/237 cm/)
    expect(tight.buildings[0].furniture).toBeUndefined()
    expect(() => applyCommand(projectWithHeight(2.37), { ...base, action: 'put', item })).not.toThrow()
    expect(() => applyCommand(projectWithHeight(2.40), { ...base, action: 'put', item: { ...item, elevationM: 0.04 } })).toThrow(/taller|assembly/)
    expect(() => applyCommand(projectWithHeight(), { ...base, action: 'put', item: { ...item, heightM: 2.3 } })).toThrow(/catalogue size/)
    const existing = projectWithHeight(2.366)
    existing.buildings[0].furniture = [item]
    expect(() => applyCommand(existing, { ...base, action: 'put', item: { ...item, position: { x: -3.1, z: 2 } } })).not.toThrow()
  })

  it('changes height in one undoable transaction, keeps original sizes after reload and refuses locked edits', () => {
    const original = createIkeaItem('platsa', base.storeyRef, position)
    const project = applyCommand(projectWithHeight(), { ...base, action: 'put', item: original })
    const tall = withIkeaHeightVariant(original, 'platsa-tall')
    useStudioStore.setState({ project, history: [], future: [], variants: [], proposals: [], draftChangeSets: [] })
    const store = useStudioStore.getState
    store().commitCommand({ ...base, action: 'put', item: tall })
    expect(store().history).toHaveLength(1)
    expect(store().project.buildings[0].furniture?.[0]).toMatchObject({ heightM: 2.41, depthM: 0.57 })
    store().undo()
    expect(store().project.buildings[0].furniture?.[0]).toEqual(original)
    store().redo()
    expect(parseProject(JSON.parse(JSON.stringify(store().project))).buildings[0].furniture?.[0]).toEqual(tall)
    store().commitCommand({ ...base, action: 'lock', itemRefs: [tall.ref], locked: true })
    const before = store().project
    expect(() => store().commitCommand({ ...base, action: 'put', item: original })).toThrow(/Unlock/)
    expect(store().project).toBe(before)
  })

  it('treats STOENSE like a rug beneath furniture, while retaining actual furniture collision warnings', () => {
    const project = projectWithHeight()
    const house = project.buildings[0], floor = house.storeys[0]
    const table = createIkeaItem('lack', floor.ref, position)
    const rug = createIkeaItem('stoense', floor.ref, position)
    house.furniture = [table, rug]
    expect(placementWarnings(table, house, floor).filter((entry) => entry.kind === 'overlap')).toEqual([])
    expect(placementWarnings(rug, house, floor)).toEqual([])
    house.furniture.push(createIkeaItem('dyvlinge', floor.ref, position))
    expect(placementWarnings(table, house, floor).some((entry) => entry.kind === 'overlap')).toBe(true)
  })
})
