import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {commitIdentity} from '../src/core/git-commit-identity.mjs';
const a={name:'PCMS',email:'pcms@local.invalid',date:'2023-11-14T22:13:20.000Z'},tree='1'.repeat(40),parent='2'.repeat(40),message='PCMS PREPARE generators/example\n\nPCMS-Operation: stable-operation\n';
const raw=Buffer.from('tree '+tree+'\nparent '+parent+'\nauthor PCMS <pcms@local.invalid> 1700000000 +0000\ncommitter PCMS <pcms@local.invalid> 1700000000 +0000\n\n'+message);
// Independent Git executable computes the object identity, no planner/encoder.
const sha=execFileSync('git',['hash-object','-t','commit','--stdin'],{input:raw}).toString().trim();
const expected={sha,body:{tree,parents:[parent],message,author:a,committer:a}};
const observed=()=>({sha,tree:{sha:tree},parents:[{sha:parent}],message:message.slice(0,-1),author:{...a,date:'2023-11-14T22:13:20Z'},committer:a});
test('R02: API message may omit exactly the raw terminal LF for the identical independently hashed commit',()=>{
 assert.equal(commitIdentity(expected,observed()).matched,true);assert.equal(commitIdentity(expected,{...observed(),message}).matched,true);
 assert.notEqual(execFileSync('git',['hash-object','-t','commit','--stdin'],{input:raw.subarray(0,-1)}).toString().trim(),sha);
});
test('R02: message/trailer/whitespace/SHA/tree/parent/attribution drift never passes',()=>{
 for(const patch of [{message:message+'\n'},{message:message.slice(0,-2)},{message:message.replace('stable-operation','different-operation')},{message:message.replaceAll('\n','\r\n')},{sha:'3'.repeat(40)},{tree:{sha:'3'.repeat(40)}},{parents:[]},{parents:[{sha:parent},{sha:parent}]},{author:{...a,name:'Other'}},{committer:{...a,date:'2023-11-14T22:13:21Z'}}])assert.equal(commitIdentity(expected,{...observed(),...patch}).matched,false,JSON.stringify(patch));
});
