import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {setImmediate} from 'node:timers/promises';
const script=readFileSync(new URL('../src/host/editor-finish.js',import.meta.url),'utf8');
test('packaged button ignores untrusted clicks and recovers a lost acceptance response by observing its persisted state',async()=>{
 const nodes=new Map();class Element{constructor(tag){this.tagName=tag;this.style={};this.handlers={};this.disabled=false;this.checked=false;}set id(v){this._id=v;nodes.set(v,this)}get id(){return this._id}setAttribute(){}appendChild(child){this.append(child);return child;}append(...children){for(const c of children)if(c&&typeof c==='object')c.parentElement=this;}addEventListener(name,fn){this.handlers[name]=fn}remove(){nodes.delete(this.id)}}
 let accepted=false,finishCalls=0;const world={window:{addEventListener(){}},location:{origin:'https://perchance.org',hash:'#edit'},document:{createElement:t=>new Element(t),createTextNode:t=>({textContent:t}),body:new Element('body')},setInterval:()=>1,clearInterval(){},browser:{runtime:{sendMessage:async message=>{if(message.operation==='editor.context')return {ok:true,result:{available:true,jobId:'bound',accepted,needsAttestation:false,message:accepted?'Accepted — PCMS paused':'Review this result'}};finishCalls++;accepted=true;throw Error('lost response after acceptance commit');}}}};
 vm.runInNewContext(script,world);for(let i=0;i<3;i++)await setImmediate();const button=nodes.get('pcms-finish-publish');assert.ok(button);assert.equal(typeof button.handlers.click,'function',JSON.stringify([...nodes.keys()]));await button.handlers.click({isTrusted:false});assert.equal(finishCalls,0);await button.handlers.click({isTrusted:true});assert.equal(finishCalls,1);assert.equal(nodes.get('pcms-finish-state').textContent,'Accepted — PCMS paused');assert.equal(button.disabled,true);
});
