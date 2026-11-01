import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sourcePaths,sourceMetadata,sourceAsset,compareSources,lfsPointer} from '../src/core/source-set.mjs';
const fp='a'.repeat(64),target={slug:'source-name',remoteId:'public_source-id',principalFingerprint:fp},packet={ok:true,source:'PERCHANCE_SAVED_SOURCE_1',...target,listing:'UNLISTED',sourceStamp:'b'.repeat(64),observedAt:1700000000000,pjs:'model\r\n雪\n',html:'<!doctype html>\r\n<p>exact</p>\n',assets:[{path:'Zażółć 雪.bin',key:'1'.repeat(32)+'.bin',bytes:4},{path:'Case.txt',key:'2'.repeat(32)+'.txt',bytes:0},{path:'case.txt',key:'3'.repeat(32)+'.txt',bytes:0}]};
test('complete exact Unicode/case-distinct paths and source newlines survive without normalization or invented filename restrictions',()=>{
 const m=sourceMetadata(packet,target);assert.equal(new TextDecoder().decode(m.roots[0].bytes),packet.pjs);assert.equal(new TextDecoder().decode(m.roots[1].bytes),packet.html);assert.deepEqual(m.assets.map(a=>a.path),['src/Case.txt','src/Zażółć 雪.bin','src/case.txt']);const decomposed='src/e\u0301.txt';assert.ok(sourcePaths(['main.pjs','index.html',decomposed,'src/é.txt']).includes(decomposed));
});
test('traversal, malformed names, duplicates and real file-directory collisions reject before source admission',()=>{
 for(const p of ['src/../escape','src/a/../../escape','src//empty','/src/absolute','src/./same','src/back\\slash','src/nul\0byte','src/lone\ud800','other.txt'])assert.throws(()=>sourcePaths(['main.pjs','index.html',p]),/SOURCE_PATH_UNSUPPORTED/);assert.throws(()=>sourcePaths(['main.pjs','index.html','src/exact','src/exact']),/SOURCE_PATH_COLLISION/);assert.throws(()=>sourcePaths(['main.pjs','index.html','src/file','src/file/child']),/SOURCE_PATH_COLLISION/);assert.throws(()=>sourcePaths(['main.pjs','src/asset']),/SOURCE_ROOTS_INCOMPLETE/);
});
test('wrong owner/ID/slug/schema and unvalidated native asset keys never become complete metadata',()=>{
 for(const patch of [{remoteId:'public_other'},{slug:'different-name'},{principalFingerprint:'c'.repeat(64)},{sourceStamp:null},{pjs:null},{assets:[{path:'safe.bin',key:'https://foreign.invalid/asset',bytes:2}]},{assets:[{path:'safe.bin',key:'1'.repeat(32)+'.bin',bytes:-1}]}])assert.throws(()=>sourceMetadata({...packet,...patch},target));
});
test('independent binary hash and exact length qualify bytes, never CDN references or unresolved LFS pointers',async()=>{
 const bytes=new Uint8Array([0,255,17,42]),hash=createHash('sha256').update(bytes).digest('hex'),entry={path:'src/binary.bin',bytes:4,sha256:hash};assert.equal((await sourceAsset(bytes,entry)).sha256,hash);await assert.rejects(sourceAsset(bytes,{...entry,bytes:3}),/LENGTH/);await assert.rejects(sourceAsset(bytes,{...entry,sha256:'0'.repeat(64)}),/HASH/);const pointer=new TextEncoder().encode('version https://git-lfs.github.com/spec/v1\noid sha256:'+'1'.repeat(64)+'\nsize 1234\n');assert.equal(lfsPointer(pointer),true);await assert.rejects(sourceAsset(pointer,{path:'src/asset.bin',bytes:pointer.length}),/LFS_POINTER/);
});
test('full manifest comparison records deletion separately from unchanged and changed bytes',()=>{
 const previous=[{path:'main.pjs',sha256:'a'},{path:'index.html',sha256:'b'},{path:'src/deleted.bin',sha256:'c'}],current=[{path:'main.pjs',sha256:'d'},{path:'index.html',sha256:'b'},{path:'src/new.bin',sha256:'e'}];assert.deepEqual(compareSources(previous,current).map(f=>[f.path,f.state]),[['index.html','UNCHANGED'],['main.pjs','CHANGED'],['src/deleted.bin','DELETED'],['src/new.bin','ADDED']]);
});
