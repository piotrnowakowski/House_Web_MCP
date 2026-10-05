import {expect,it} from 'vitest'
import data from '../../project-data/zielonki-rear-bath-room/before-sync-release-r11.json'
import previous from '../../project-data/zielonki-rear-bath-room/before-master-oak-r9.json'
import source from '../../project-data/zielonki-rear-carport/project.json'
import {parseProject} from '../domain/schema'
import {validateProject} from '../domain/commands'
const p=parseProject(data),b=parseProject(previous),s=parseProject(source)
it('transfers oak bedroom into MAIN while preserving all unrelated data',()=>{
 expect(validateProject(p).filter(v=>v.severity==='error')).toEqual([])
 const h=p.buildings[0],old=b.buildings[0]
 const selected=(ref:string)=>ref==='interior/reference-parents-bed'||ref.startsWith('interior/master-oak/')
 expect(h.furniture!.filter(i=>selected(i.ref))).toEqual(s.buildings[0].furniture!.filter(i=>selected(i.ref)))
 const restored=structuredClone(p),rh=restored.buildings[0]
 rh.furniture=rh.furniture!.filter(i=>!i.ref.startsWith('interior/master-oak/')).map(i=>i.ref==='interior/reference-parents-bed'?old.furniture!.find(v=>v.ref===i.ref)!:i)
 rh.spaces=rh.spaces.map(r=>r.ref==='space/reference-parents'?old.spaces.find(v=>v.ref===r.ref)!:r)
 for(const w of rh.walls){const prior=old.walls.find(v=>v.ref===w.ref)!;if(w.ref==='wall/reference-upper/4')w.faceFinishes=prior.faceFinishes;for(const o of w.openings)if(['opening/reference-parents','opening/reference-wardrobe'].includes(o.ref)){const prev=prior.openings.find(v=>v.ref===o.ref)!;if(prev.finish)o.finish=prev.finish;else delete o.finish;}}
 restored.revision=b.revision;restored.updatedAt=b.updatedAt
 expect(restored).toEqual(b)
})
