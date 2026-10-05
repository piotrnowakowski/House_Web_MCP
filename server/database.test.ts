import {expect,it} from 'vitest'
import {createPool} from './database'
const env={PGHOST:'db.example',PGDATABASE:'test',PGUSER:'test',PGPASSWORD:'test-only'}
it('verifies certificates in verify-full mode',async()=>{const p=createPool({...env,PGSSLMODE:'verify-full'});expect(p.options.ssl).toEqual({rejectUnauthorized:true});await p.end()})
it('keeps TLS while allowing explicitly requested unverified mode',async()=>{const p=createPool({...env,PGSSLMODE:'require'});expect(p.options.ssl).toEqual({rejectUnauthorized:false});await p.end()})
it('rejects unencrypted and unspecified database modes',()=>{expect(()=>createPool({...env,PGSSLMODE:'disable'})).toThrow();expect(()=>createPool(env)).toThrow()})
