import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {planRefreshMarkers,MARKER_RECIPE} from '../src/modules/refresh-markers.mjs';
const id='11111111-1111-4111-8111-111111111111',enc=new TextEncoder(),text=b=>new TextDecoder('utf-8',{ignoreBOM:true}).decode(b);
const files=(pjs='output\n  Hello [animal]\nanimal\n  cat\n  dog',html='<!doctype html><html><head><title>Sample</title></head><body><p>Hello</p></body></html>')=>[{path:'main.pjs',bytes:enc.encode(pjs)},{path:'index.html',bytes:enc.encode(html)},{path:'src/雪 space.bin',bytes:Uint8Array.from({length:256},(_,i)=>i)}];
const plan=(fs,counter=1)=>planRefreshMarkers(fs,{markerId:id,counter});
function render(text,last=false){const lists={};let current=null;for(const line of text.replace(/^\uFEFF/,'').split(/\r\n|\n|\r/)){if(!line.trim()||line.trimStart().startsWith('//'))continue;if(!line.startsWith(' ')){current=line;lists[current]=[];}else lists[current].push(line.trimStart());}const expand=name=>{const list=lists[name],value=last?list.at(-1):list[0];return value.replace(/\[([A-Za-z_]+)\]/g,(_,ref)=>expand(ref));};return expand('output');}
test('insert once and replace exact counters while preserving BOM/newlines/EOF and all binary paths/bytes',()=>{
 for(const newline of ['\n','\r\n','\r'])for(const prefix of ['','\uFEFF']){const p=prefix+['// Existing human comment','output','  Hello [animal]','animal','  cat','  dog'].join(newline),h=prefix+' \r\n<!-- human --><!DOCTYPE html>\r\n<html><body><p>Original</p></body></html>',before=files(p,h),one=plan(before),two=plan(one.files,2);
 assert.equal(one.recipe,MARKER_RECIPE);for(const result of [one,two]){assert.deepEqual(result.files[2],before[2]);assert.equal(render(text(result.files[0].bytes)),render(p));assert.equal(render(text(result.files[0].bytes),true),render(p,true));}
 assert.equal(text(two.files[0].bytes).replace('// pcms-refresh:'+id+':2'+newline,''),p);assert.equal(text(two.files[1].bytes).replace('<!-- pcms-refresh:'+id+':2 -->',''),h);assert.equal((text(two.files[0].bytes).match(/pcms-refresh/g)??[]).length,1);
 }});
test('HTML parsed prolog places exactly after doctype; raw text/style/script/template remain byte-identical and executable fixture behavior matches',()=>{
 const script='globalThis.answer = 6 * 7;',h='<!doctype html><html><head><style>p::before{content:"<tag>"}</style><script>'+script+'</script></head><body><template><p>Hidden</p><!-- keep --></template><textarea>raw <span> text</textarea><p>Visible</p></body></html>',before=files(undefined,h),p=plan(before),after=text(p.files[1].bytes);
 assert.ok(after.startsWith('<!doctype html><!-- pcms-refresh:'+id+':1 -->'));assert.equal(after.replace('<!-- pcms-refresh:'+id+':1 -->',''),h);
 for(const markup of [h,after]){const ctx=vm.createContext({});vm.runInContext(markup.slice(markup.indexOf('<script>')+8,markup.indexOf('</script>')),ctx);assert.equal(ctx.answer,42);}
 assert.equal(plan(files('output\n  plain','<p>Fragment</p>')).changes['index.html'].start,0);
});
test('duplicate/foreign/moved/modified/removed markers, unsafe HTML contexts and unsupported PJS never produce candidates',()=>{
 const pjs='// pcms-refresh:'+id+':1\noutput\n  same',html='<!-- pcms-refresh:'+id+':1 -->';
 const bad=[
 files(pjs+'\n// pcms-refresh:'+id+':1','<p>x</p>'),
 files('// human\n'+pjs,'<p>x</p>'),
 files(pjs.replace(':1',':9'),'<p>x</p>'),
 files(pjs,'<!doctype html><script>const x='+JSON.stringify(html)+'</script>'),
 files(pjs,'<!doctype html><template>'+html+'</template>'),
 files(pjs,'<!doctype html><!-- pcms-refresh:'+id+':1 changed --><p>x</p>'),
 files(pjs,'<!doctype html>'+html+html+'<p>x</p>'),
 files('output\n  [Math.random()]','<p>x</p>'),files('output = () => 1','<p>x</p>'),files('output\n    ambiguous','<p>x</p>'),
 files(pjs,'<!doctype svg><p>x</p>'),files(pjs,'<template><p>unclosed</p>'),
 files(pjs,'<script>unclosed'),files(pjs,'<!-- broken'),files(pjs,'<noscript>ambiguous</noscript>')];
 for(const fs of bad)assert.throws(()=>plan(fs,2),e=>e.code.startsWith('MARKER_'));
 assert.throws(()=>plan(files(),2),e=>e.code==='MARKER_REMOVED');assert.throws(()=>planRefreshMarkers(files(),{markerId:'wrong',counter:1}),e=>e.code==='MARKER_IDENTITY_INVALID');assert.throws(()=>planRefreshMarkers(files(),{markerId:id,counter:Number.MAX_SAFE_INTEGER+1}),e=>e.code==='MARKER_IDENTITY_INVALID');
 const invalid=files();invalid[0].bytes=Uint8Array.of(0xff);assert.throws(()=>plan(invalid),e=>e.code==='MARKER_UTF8_UNSUPPORTED');
});
