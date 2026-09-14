import {afterEach,expect,it,vi} from 'vitest'
vi.mock('vite',()=>({loadEnv:()=>({HOUSE_SYNC_CONNECTION_KEY:'test-key-123456789012345678901234567890'})}))
import {localSyncPlugin} from '../scripts/local-sync'
afterEach(()=>vi.unstubAllGlobals())
async function call(path:string,headers:Record<string,string>={}){
 let middleware:any;const p=localSyncPlugin();(p.configureServer as Function)({config:{mode:'test',envDir:'.'},middlewares:{use:(v:any)=>middleware=v}})
 const req={url:'/api/local-sync/'+path,method:'GET',headers:{host:'localhost:5173','x-house-local-sync':'1',...headers},socket:{remoteAddress:'127.0.0.1'},async *[Symbol.asyncIterator](){}}
 const res={statusCode:200,body:'',setHeader:vi.fn(),end(v:string){this.body=v}}
 await middleware(req,res,vi.fn());return res
}
it('reports configured without returning the key',async()=>{const r=await call('configuration');expect(r.statusCode).toBe(200);expect(JSON.parse(r.body)).toEqual({configured:true});expect(r.body).not.toContain('test-key')})
it('rejects foreign origins and rebinding hosts',async()=>{expect((await call('projects',{origin:'https://foreign.example'})).statusCode).toBe(403);expect((await call('projects',{host:'foreign.example'})).statusCode).toBe(403)})
it('injects credentials only upstream and refuses arbitrary routes',async()=>{const upstream=vi.fn().mockResolvedValue({status:200,text:async()=>'[]'});vi.stubGlobal('fetch',upstream);expect((await call('projects')).body).toBe('[]');expect(upstream.mock.calls[0][1].headers.Authorization).toMatch(/^Bearer /);expect((await call('../health')).statusCode).toBe(404);expect(upstream).toHaveBeenCalledTimes(1)})
