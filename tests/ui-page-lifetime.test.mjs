import test from 'node:test';
import assert from 'node:assert/strict';
import {openModulePage} from '../src/ui/module-page.mjs';
test('a module descriptor delivered after navigation releases its exact page binding without mounting a stale frame',async()=>{
 let deliver;const seen=[],container={isConnected:true},core=async(op,args)=>{seen.push([op,args]);if(op==='module.open')return new Promise(resolve=>deliver=resolve);return {ok:true};};
 const opening=openModulePage({core,moduleId:'fixture-module',pageId:'main',container,onError:()=>assert.fail('detached page cannot alter current UI')});
 container.isConnected=false;deliver({ok:true,result:{token:'original-page-token'}});const dispose=await opening;dispose();
 assert.deepEqual(seen,[['module.open',{id:'fixture-module',pageId:'main'}],['module.close',{token:'original-page-token'}]]);
});
