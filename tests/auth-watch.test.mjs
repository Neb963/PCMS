import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {observeAuthWatch} from '../src/modules/auth-watch.mjs';
function pair(){
 const values=new Map([['app-storage','original'],['sessionTokenLastChangeTime','100']]),contexts=[];
 for(let i=0;i<2;i++){const handlers=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v);for(const other of contexts)if(other.index!==i)for(const fn of other.handlers.get('storage')??[])fn({storageArea:other.storage,key:k});}};
 const c=vm.createContext({Date,location:{origin:'https://perchance.org'},localStorage:storage,__PCMS_ACCOUNT_DOCUMENT_1:'doc-'+i,addEventListener:(k,fn)=>{const a=handlers.get(k)??[];a.push(fn);handlers.set(k,a);},removeEventListener:(k,fn)=>handlers.set(k,(handlers.get(k)??[]).filter(x=>x!==fn))});vm.runInContext('window=globalThis;window.top=window',c);contexts.push({index:i,c,handlers,storage,run:kind=>JSON.parse(JSON.stringify(vm.runInContext('('+observeAuthWatch.toString()+')',c)({kind,captureId:'capture',documentWitness:'doc-'+i})))});
 }return contexts;
}
test('sibling storage events detect a same-document write/restore even when current auth bytes are equal',()=>{
 const [a,b]=pair();assert.equal(a.run('BEGIN').ok,true);assert.equal(b.run('BEGIN').ok,true);a.storage.setItem('app-storage','rotated');a.storage.setItem('app-storage','original');assert.equal(a.storage.getItem('app-storage'),'original');assert.equal(a.run('CHECK').version,0);assert.equal(b.run('CHECK').version,2);b.storage.setItem('sessionTokenLastChangeTime','200');assert.equal(a.run('CHECK').version,1);
});
test('document loss is unknown; cleanup retains trusted human intent and removes only its own listeners',()=>{
 const [a]=pair();a.run('BEGIN');for(const fn of a.handlers.get('keydown'))fn({isTrusted:false});assert.equal(a.run('CHECK').human,false);for(const fn of a.handlers.get('pointerdown'))fn({isTrusted:true});assert.equal(a.run('END').human,true);assert.equal(a.handlers.get('storage').length,0);assert.equal(a.run('CHECK').code,'CAPTURE_WITNESS_LOST');
});
