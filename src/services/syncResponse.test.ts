import {expect,it} from 'vitest'
import {readSyncJson,unavailableSyncMessage} from './syncResponse'
it('rejects SPA HTML returned with a successful status',async()=>{await expect(readSyncJson(new Response('<!doctype html>',{headers:{'content-type':'text/html'}}))).rejects.toThrow(unavailableSyncMessage)})
it('reports malformed JSON without leaking its body',async()=>{await expect(readSyncJson(new Response('<private>',{headers:{'content-type':'application/json'}}))).rejects.toThrow('invalid response')})
it('accepts JSON API responses',async()=>{expect(await readSyncJson(new Response('{"serverVersion":2}',{headers:{'content-type':'application/json; charset=utf-8'}}))).toEqual({serverVersion:2})})
