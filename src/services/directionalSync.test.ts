import {beforeEach,expect,it,vi} from 'vitest'
import {createTerrainProject} from '../domain/terrain'
const mocks=vi.hoisted(()=>({state:{} as any,save:vi.fn(),recovery:vi.fn()}))
vi.mock('../state/store',()=>({useStudioStore:{getState:()=>mocks.state,setState:(v:any)=>Object.assign(mocks.state,v)}}))
vi.mock('./autosave',()=>({flushAutosave:async()=>{}}))
vi.mock('./workspaceLock',()=>({lockWorkspace:()=>()=>{},applyLockedWorkspace:(f:Function)=>f(),runWorkspaceActivity:(f:Function)=>f()}))
vi.mock('./persistence',()=>({loadWorkspace:vi.fn(),readSyncRecord:async()=>undefined,saveRecovery:mocks.recovery,saveWorkspace:mocks.save,writeSyncRecord:vi.fn()}))
import {transferWorkspace,useSyncStatus} from './mikrusSync'
let local:any,remote:any,calls:string[]
beforeEach(()=>{
 vi.clearAllMocks();calls=[]
 local={version:1,project:createTerrainProject({name:'Local',widthM:30,depthM:40,northDegrees:0,latitude:52,longitude:21,timezone:'Europe/Warsaw'}),proposals:[],draftChangeSets:[]}
 remote=structuredClone(local);remote.project.name='Remote'
 mocks.state={...local,setStructureReport:()=>{}}
 vi.stubGlobal('location',{protocol:'https:',hostname:'house.example',href:'https://house.example/'})
 vi.stubGlobal('localStorage',{getItem:()=> 'test-key-123456789012345678901234567890'})
 vi.stubGlobal('window',{confirm:()=>true})
 vi.stubGlobal('fetch',vi.fn(async (_url:any,options:any)=>{calls.push(options.method);return {ok:true,json:async()=>({serverVersion:2,workspace:options.method==='PUT'?JSON.parse(options.body).workspace:remote})}}))
 useSyncStatus.setState({busy:false,conflict:null})
})
it('Get downloads without issuing a remote write and backs up the local version',async()=>{await transferWorkspace('get');expect(calls).toEqual(['GET']);expect(mocks.state.project.name).toBe('Remote');expect(mocks.recovery).toHaveBeenCalledWith(local)})
it('Push sends the local version without merging remote content',async()=>{await transferWorkspace('push');expect(calls).toEqual(['GET','PUT']);expect(mocks.state.project.name).toBe('Local');const request=vi.mocked(fetch).mock.calls[1][1]!;expect(JSON.parse(request.body as string).workspace.project.name).toBe('Local')})
it('cancelled Get preserves local work and never uploads',async()=>{vi.stubGlobal('window',{confirm:()=>false});await transferWorkspace('get');expect(calls).toEqual(['GET']);expect(mocks.save).not.toHaveBeenCalled();expect(mocks.state.project.name).toBe('Local')})
