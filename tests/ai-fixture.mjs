import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {nativeAi} from '../src/modules/ai-native.mjs';
export function attachAi(native){
 const nodes=new Map();class Element{constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.hidden=false;this.disabled=false;this.value='';this.textContent='';this.handlers={};}set value(v){this._value=this.tagName==='TEXTAREA'?v.replace(/\r\n?/g,'\n'):v}get value(){return this._value}get firstChild(){return this.children[0]}set id(v){this._id=v;nodes.set(v,this)}get id(){return this._id}appendChild(n){this.children.push(n);this.textContent=this.children.map(n=>n.textContent).join('')}replaceChildren(...n){this.children=[];for(const v of n)this.appendChild(v)}addEventListener(type,fn){(this.handlers[type]??=[]).push(fn)}dispatchEvent(e){for(const fn of this.handlers[e.type]??[])fn(e)}click(){if(!this.disabled)this.dispatchEvent({type:'click'})}}
 const c=native.c,oldGet=c.document.getElementById;c.document.createElement=tag=>new Element(tag);c.document.body=new Element('body');c.document.getElementById=id=>nodes.get(id)??oldGet(id);c.getComputedStyle=e=>({display:e.hidden?'none':'block'});c.Event=class{constructor(type){this.type=type}};c.navigator={serviceWorker:{}};const fetch=c.fetch;c.fetch=(url,...rest)=>url==='/fixture/ai'?Promise.resolve(new Response('{}')):fetch(url,...rest);vm.runInContext(readFileSync(new URL('./native_ai_fixture.js',import.meta.url),'utf8'),c);
 return {nodes,run:request=>native.run(nativeAi,request)};
}
