import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import data from '../../project-data/architekt-7-11/project.json'
import previous from '../../project-data/architekt-7-11/before-retained-trees-r15.json'
import { surveyTreePosition } from '../../knowledge-bank/zielonki/trees'
import { parseProject } from './schema'
import { pointInPolygon, polygonArea } from './geometry'
import { mergeProjects } from './projectMerge'
import { excavatedGroundGeometry } from '../scene/gardenGround'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from '../services/persistence'

const current = parseProject(data), before = parseProject(previous)
const retained = ['5012','5015','5018','5027','502A','502D','5030']
const removed = ['503A','5033','50D1']
const terrace = current.landscape.zones.find(z=>z.ref==='zone/terrace')!
const tree = current.landscape.plants.find(p=>p.surveyHandle==='5015')!

it('retains only the seven selected site trees at survey coordinates and preserves the house, context and planting',()=>{
  expect(current.buildings).toEqual(before.buildings)
  expect(current.site).toEqual(before.site)
  expect(current.landscape.fixtures).toEqual(before.landscape.fixtures)
  expect(current.landscape.plants.filter(p=>p.surveyHandle&&p.placementRole!=='context').map(p=>p.surveyHandle).sort()).toEqual(retained)
  for(const p of current.landscape.plants.filter(p=>p.surveyHandle)) expect(p.position).toEqual(surveyTreePosition(p.surveyHandle!))
  expect(current.landscape.plants.filter(p=>p.surveyHandle!=='5015')).toEqual(before.landscape.plants.filter(p=>!removed.includes(p.surveyHandle??'')))
  expect(current.landscape.zones.filter(z=>!['zone/terrace','zone/architekt-711/tree-opening-5015'].includes(z.ref))).toEqual(before.landscape.zones.filter(z=>z.ref!=='zone/terrace'))
  expect(tree.trunkDiameterM).toBe(1)
})

it('cuts the deck mesh itself: a 2 m opening around the 1 m trunk, open to the garden',()=>{
  expect(pointInPolygon(tree.position,terrace.footprint)).toBe(false)
  const old=before.landscape.zones.find(z=>z.ref===terrace.ref)!
  expect(polygonArea(old.footprint)-polygonArea(terrace.footprint)).toBeCloseTo(2.51619316)
  const geometry=excavatedGroundGeometry(terrace.footprint,[]).toNonIndexed()
  const pos=geometry.getAttribute('position')
  const triangles=Array.from({length:pos.count/3},(_,i)=>Array.from({length:3},(_,j)=>({x:pos.getX(3*i+j),z:pos.getZ(3*i+j)})))
  // Sample the whole clearance area; checking only a soil-coloured overlay would miss covered decking.
  for(let radius=0;radius<=.98;radius+=.07)for(let a=0;a<Math.PI*2;a+=.13){
    const point={x:tree.position.x+radius*Math.cos(a),z:tree.position.z+radius*Math.sin(a)}
    expect(triangles.some(t=>pointInPolygon(point,t))).toBe(false)
  }
  geometry.dispose()
})

it('migrates the tree inventory and notch through save/reload, preserving independent deletions',async()=>{
  globalThis.indexedDB=new IDBFactory()
  const local=structuredClone(before),deleted=local.landscape.plants.find(p=>!p.surveyHandle)!.ref
  local.landscape.plants=local.landscape.plants.filter(p=>p.ref!==deleted);local.name='Mój ogród'
  await saveWorkspace({version:1,project:local,proposals:[],draftChangeSets:[]})
  expect(await synchronizePublishedProject(current,before)).toEqual([])
  const saved=(await loadWorkspace(before.ref))!.project
  expect(saved.name).toBe(local.name)
  expect(saved.landscape.plants.some(p=>p.ref===deleted)).toBe(false)
  expect(saved.landscape.plants.filter(p=>p.surveyHandle&&p.placementRole!=='context').map(p=>p.surveyHandle).sort()).toEqual(retained)
  expect(saved.landscape.plants.find(p=>p.surveyHandle==='5015')?.trunkDiameterM).toBe(1)
  expect(saved.landscape.zones.find(z=>z.ref===terrace.ref)).toEqual(terrace)
  expect(await synchronizePublishedProject(current,before)).toEqual([])
  expect((await loadWorkspace(before.ref))!.project).toEqual(saved)
})

it('preserves and reports independently moved trees or edited decking instead of replacing them',()=>{
  const local=structuredClone(before),moved=local.landscape.plants.find(p=>p.surveyHandle==='503A')!
  moved.position.x+=1
  const deck=local.landscape.zones.find(z=>z.ref==='zone/terrace')!;deck.footprint[0].x+=.1
  const result=mergeProjects(before,local,current)
  expect(result.conflicts.some(p=>p.includes(moved.ref))).toBe(true)
  expect(result.conflicts.some(p=>p.includes('zone/terrace/footprint'))).toBe(true)
  expect(result.project.landscape.plants.find(p=>p.ref===moved.ref)).toEqual(moved)
  expect(result.project.landscape.zones.find(z=>z.ref===deck.ref)).toEqual(deck)
})
