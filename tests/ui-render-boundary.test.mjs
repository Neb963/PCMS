import test from 'node:test';
import assert from 'node:assert/strict';
import {renderBoundary} from '../src/ui/render-boundary.mjs';
function fixture(){
 const node=(tag,text='')=>({tag,text,dataset:{},attributes:{},children:[],listeners:{},setAttribute(k,v){this.attributes[k]=v;},replaceChildren(...v){this.children=v;},append(...v){this.children.push(...v);},addEventListener(k,fn){this.listeners[k]=fn;}});
 const mount=node('section'),area=node('div'),reports=[],saved={draft:'retained human draft'},f={mount,area,saved,reports,current:true,retries:0};
 f.options={mount,area,target:'accounts',page:'accounts',isCurrent:()=>f.current,node,report:async data=>{reports.push(data);return {ok:true};},retry:()=>{f.retries++;}};return f;
}
test('a failed actual renderer replaces partial content with a labelled retry, records only typed metadata and stays unready',async()=>{
 const f=fixture(),secret='PRIVATE_SOURCE_cookie_token';f.mount.dataset.routeReady='old-page';
 const complete=await renderBoundary({...f.options,render:async()=>{f.area.append({text:secret});throw new TypeError(secret);}});
 assert.equal(complete,false);assert.equal(f.mount.attributes['aria-busy'],'false');assert.equal(f.mount.dataset.routeReady,undefined);assert.equal(f.mount.dataset.renderError,'UI_RENDER_FAILED');
 assert.equal(f.area.children[0].attributes.role,'alert');assert.equal(f.area.children[1].text,'Reload view');f.area.children[1].listeners.click();assert.equal(f.retries,1);assert.deepEqual(f.saved,{draft:'retained human draft'});
 assert.deepEqual(f.reports,[{page:'accounts',exceptionType:'TYPE_ERROR'}]);assert.ok(!JSON.stringify(f.area).includes(secret));assert.ok(!JSON.stringify(f.reports).includes(secret));
});
test('a later route wins over an old asynchronous render failure and its completion markers',async()=>{
 const f=fixture();let entered,reject;const started=new Promise(resolve=>entered=resolve),pending=new Promise((_,r)=>reject=r);
 const old=renderBoundary({...f.options,render:async()=>{entered();await pending;}});await started;
 f.current=false;f.mount.dataset.routeReady='work';f.mount.setAttribute('aria-busy','false');f.area.children=[{text:'new current view'}];reject(new Error('private stale renderer'));
 assert.equal(await old,false);assert.equal(f.mount.dataset.routeReady,'work');assert.equal(f.mount.attributes['aria-busy'],'false');assert.deepEqual(f.area.children,[{text:'new current view'}]);assert.deepEqual(f.reports,[{page:'accounts',exceptionType:'OTHER_ERROR'}]);
});
test('logger failure is visible without exposing the exception or declaring a successful render',async()=>{
 const f=fixture();const complete=await renderBoundary({...f.options,render:()=>{throw {name:'constructor',message:'PRIVATE_EXCEPTION_BODY'};},report:async data=>{assert.deepEqual(data,{page:'accounts',exceptionType:'OTHER_ERROR'});return {ok:false,code:'STORAGE_FULL'};}});
 assert.equal(complete,false);assert.ok(f.area.children.some(c=>c.text.includes('Diagnostic recording is unavailable')));assert.ok(!JSON.stringify(f.area).includes('PRIVATE_EXCEPTION'));assert.equal(f.mount.dataset.routeReady,undefined);
});
test('successful current rendering alone marks readiness; an already stale mount does no work or logging',async()=>{
 const f=fixture();f.mount.dataset.renderError='old';assert.equal(await renderBoundary({...f.options,render:()=>f.area.append({text:'accounts rendered'})}),true);assert.equal(f.mount.dataset.routeReady,'accounts');assert.equal(f.mount.dataset.renderError,undefined);assert.deepEqual(f.reports,[]);
 f.current=false;assert.equal(await renderBoundary({...f.options,render:()=>assert.fail('stale render')}),false);assert.deepEqual(f.reports,[]);
});
