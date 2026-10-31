import test from 'node:test';
import assert from 'node:assert/strict';
import {AVAILABLE,RESERVED,classifySlug,importSlugs,nativeSlug} from '../src/modules/slug-observations.mjs';
const page=(text,extra={})=>({complete:true,text,rootOutput:false,requiredFrames:[],...extra});
test('exact Unicode, punctuation, spelling and visible linked words; only layout whitespace folds',()=>{
 assert.equal(AVAILABLE,'(⊙.⊙) sorry, we cannot find a generator with that name! create one?');
 assert.equal(RESERVED,String.raw`(⊙.⊙) sorry, this is a reserved name - had to do this because a few users where "name-squatting" on lots of common words and not actually using them ¯\_(⊙_ʖ⊙)_/¯`);
 assert.equal(classifySlug(page(' \n'+AVAILABLE.replaceAll(' ',' \n\t ')+' ')).result,'Available');
 assert.equal(classifySlug(page(RESERVED)).basis,'EXACT_RESERVED_MESSAGE');
 for(const text of [AVAILABLE.slice(1),AVAILABLE.replace('!','.'),AVAILABLE.replace('⊙','O'),AVAILABLE.replace('create one?','https://perchance.org/create'),RESERVED.replace('where','were'),RESERVED.replace(' - ',' — '),RESERVED.replace('\\_','_'),RESERVED+' Learn more'])assert.equal(classifySlug(page(text)).result,'Unknown',text);
});
test('actual output including a permitted loaded frame; shells, blocked/empty/loading/challenge and conflicts stay Unknown',()=>{
 assert.equal(classifySlug(page('shell',{requiredFrames:[{accessible:true,complete:true,content:true}]})).basis,'ACTUAL_GENERATOR_OUTPUT');
 assert.equal(classifySlug(page('changed partial message',{rootOutput:true})).result,'Taken');
 for(const extra of [{},{requiredFrames:[{accessible:true,complete:true,content:false}]},{requiredFrames:[{accessible:false}]},{requiredFrames:[{accessible:true,complete:false,content:true}]},{complete:false},{challenge:true,rootOutput:true},{transportError:true,rootOutput:true},{rootOutput:true,text:AVAILABLE}]){
  assert.equal(classifySlug(page('shell',extra)).result,'Unknown');
 }
});
test('normalization preserves every original rejection and collision, without inventing availability',()=>{
 const rows=importSlugs('  My_Name  \r\nmy name\n!!!\nhub\nabc\n  \nÉlan world');
 assert.deepEqual(rows.map(r=>[r.slug,r.state,r.duplicateOf]),[['my-name','PENDING',null],['my-name','COLLISION',0],[null,'REJECTED',null],['hub','PENDING',null],[null,'REJECTED',null],[null,'REJECTED',null],['lan-world','PENDING',null]]);
 assert.equal(rows[0].raw,'  My_Name  ');assert.ok(rows.every(r=>r.result===null&&r.checkedAt===null));assert.equal(nativeSlug('a'.repeat(101)),null);
});
