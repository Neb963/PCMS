import 'fake-indexeddb/auto';
import {openCore} from '../src/core/records.mjs';
import {seedBundled} from '../src/modules/seed.mjs';
import {FIRST_PARTY,bundledPackage} from '../scripts/bundled.mjs';
export async function seeded(t){
 const name='capture-cut-'+crypto.randomUUID(),c=await openCore({name});await c.queue.boot();t.after(()=>c.close());const packages=FIRST_PARTY.map(([id,title])=>bundledPackage(id,title)),map=new Map(packages.map(p=>['bundled/'+p.id+'.zip',p.zip]));map.set('bundled/registry.json',new TextEncoder().encode(JSON.stringify({schema:1,packages:packages.map(({id,packageHash,manifestHash})=>({id,packageHash,manifestHash}))})));await seedBundled(c,{read:async path=>map.get(path)});return {c,name,packages};
}
