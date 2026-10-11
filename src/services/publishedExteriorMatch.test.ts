import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import mainData from '../../project-data/zielonki-rear-bath-room/project.json'
import architectData from '../../project-data/architekt/project.json'
import architectBefore from '../../project-data/architekt/before-glowny-exterior-r4.json'
import paulinaData from '../../project-data/paulina-poprawki/project.json'
import paulinaBefore from '../../project-data/paulina-poprawki/before-glowny-exterior-r4.json'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { gableGlazingProfile } from '../domain/gableGlazing'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'

const main = parseProject(mainData).buildings[0]
const openings = (b: typeof main) => b.walls.flatMap(w => w.openings)
const spec = ({ widthM, heightM, sillM, kind, glazed, mullionFractions, finish }: ReturnType<typeof openings>[number]) => ({ widthM, heightM, sillM, kind, glazed, mullionFractions, finish })
for (const [data, beforeData] of [[architectData, architectBefore], [paulinaData, paulinaBefore]]) {
  const current = parseProject(data), before = parseProject(beforeData), b = current.buildings[0], old = before.buildings[0]
  it(`${current.name}: uses Główny's actual window specifications and glazed terrace doors`, () => {
    const sourceWindows = openings(main).filter(o => o.kind === 'window').map(spec)
    const windows = openings(b).filter(o => o.kind === 'window').map(spec)
    expect(windows).toHaveLength(sourceWindows.length)
    expect(windows).toEqual(expect.arrayContaining(sourceWindows))
    for (const ref of ['opening/reference-children-west-window', 'opening/reference-children-east-window', 'opening/reference-office-window']) expect(spec(openings(b).find(o => o.ref === ref)!)).toEqual(spec(openings(main).find(o => o.ref === ref)!))
    expect(spec(openings(b).find(o => o.ref === 'opening/architekt/terrace-side')!)).toEqual(spec(openings(main).find(o => o.ref === 'opening/living-terrace-door')!))
    expect(validateProject(current).filter(i => i.severity === 'error')).toEqual([])
  })
  it(`${current.name}: preserves the approved rooms, enclosed footprint, site, furniture and wall endpoints`, () => {
    for (const key of ['position','rotationDegrees','spaces','storeys','stairs','furniture','platforms','ceilingFinishes'] as const) expect(b[key],key).toEqual(old[key])
    expect(b.walls.map(({ref,start,end,thicknessM,baseElevationM,faceFinishes})=>({ref,start,end,thicknessM,baseElevationM,faceFinishes}))).toEqual(old.walls.map(({ref,start,end,thicknessM,baseElevationM,faceFinishes})=>({ref,start,end,thicknessM,baseElevationM,faceFinishes})))
    for (const slab of old.slabs) expect(b.slabs.find(s=>s.ref===slab.ref)?.footprint).toEqual(slab.footprint)
    expect(b.slabs[1].holes).toEqual(old.slabs[1].holes)
    expect(current.landscape).toEqual(before.landscape)
    expect(current.site).toEqual(before.site)
    expect(current.buildings.slice(1)).toEqual(before.buildings.slice(1))
  })
  it(`${current.name}: restores all five shaped upper panes, dark gables, the recess and canopy`, () => {
    for (const [suffix, side, count] of [['front-barn','min',1],['front-barn','max',2],['rear-barn','max',2]] as const) {
      const roof=b.roof.segments.find(r=>r.ref.endsWith(suffix))!, source=main.roof.segments.find(r=>r.ref===roof.ref)!
      const profile=gableGlazingProfile(roof,side,b)!
      expect(profile.panels).toHaveLength(count)
      expect(roof.gableGlazing?.[side]?.shape).toBe(source.gableGlazing?.[side]?.shape)
      expect(roof.gableWallFinishes).toEqual(source.gableWallFinishes)
      expect(roof.gableFrame).toEqual(source.gableFrame)
      expect(roof.pitchDegrees).toBe(old.roof.segments.find(r=>r.ref===roof.ref)!.pitchDegrees)
      if(side==='max'&&suffix==='rear-barn')expect(roof.gableRecess).toEqual(source.gableRecess)
    }
    const canopy=b.roof.segments.find(r=>r.type==='flat')!, sourceCanopy=main.roof.segments.find(r=>r.ref===canopy.ref)!
    expect(canopy.finish).toEqual(sourceCanopy.finish)
    expect(canopy.canopy?.soffitColorHex).toBe(sourceCanopy.canopy?.soffitColorHex)
    expect(canopy.canopy?.posts).toHaveLength(4)
    expect(b.slabs.some(s=>s.ref==='slab/recessed-terrace')).toBe(true)
  })
  it(`${current.name}: migrates saved r4, keeps local edits/deletions, and never resurrects a removed window`,async()=>{
    globalThis.indexedDB=new IDBFactory()
    await synchronizePublishedProject(before,before)
    const saved=(await loadWorkspace(before.ref))!
    const deleted=saved.project.buildings[0].furniture!.pop()!.ref
    saved.project.buildings[0].furniture![0].color='#123456'
    await saveWorkspace(saved)
    expect(await synchronizePublishedProject(current,before)).toEqual([])
    const merged=(await loadWorkspace(current.ref))!
    expect(merged.project.buildings[0].furniture!.some(i=>i.ref===deleted)).toBe(false)
    expect(merged.project.buildings[0].furniture![0].color).toBe('#123456')
    expect(openings(merged.project.buildings[0]).map(spec)).toEqual(openings(b).map(spec))
    const wall=merged.project.buildings[0].walls.find(w=>w.openings.some(o=>o.ref==='opening/architekt/bath-window'))!
    wall.openings=wall.openings.filter(o=>o.ref!=='opening/architekt/bath-window')
    await saveWorkspace(merged)
    expect(await synchronizePublishedProject(current,before)).toEqual([])
    expect(openings((await loadWorkspace(current.ref))!.project.buildings[0]).some(o=>o.ref==='opening/architekt/bath-window')).toBe(false)
  })
}
