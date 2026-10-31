// Read transport and Git blob verification adapt pinned Alpha git-catalog.mjs:
// https://github.com/Neb963/PCMS-Alpha/blob/c5b23b77f50db7ffe50e2ef705a8bf0b5879e36e/src/runtime/git-catalog.mjs
// Accepted v42 replaces its private-repo default, legacy declaration and caps.
import {requireCore as check,CoreError} from './records.mjs';
export const gitSha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
export const validRepository=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(v)&&v.split('/').every(x=>x!=='.'&&x!=='..');
async function objectOid(type,bytes){const prefix=new TextEncoder().encode(type+' '+bytes.length+'\0'),all=new Uint8Array(prefix.length+bytes.length);all.set(prefix);all.set(bytes,prefix.length);return [...new Uint8Array(await crypto.subtle.digest('SHA-1',all))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export const gitBlob=bytes=>objectOid('blob',bytes);
export async function verifyGitTree(entries,sha){
 const encoder=new TextEncoder(),encoded=entries.map(e=>({...e,sort:encoder.encode(e.path+(e.type==='tree'?'/':''))}));
 encoded.sort((a,b)=>{for(let i=0;i<Math.min(a.sort.length,b.sort.length);i++)if(a.sort[i]!==b.sort[i])return a.sort[i]-b.sort[i];return a.sort.length-b.sort.length;});
 const chunks=[];for(const e of encoded){check(['040000','100644','100755','120000','160000'].includes(e.mode)&&gitSha(e.sha),'GIT_TREE_INVALID');chunks.push(encoder.encode((e.mode==='040000'?'40000':e.mode)+' '+e.path+'\0'),Uint8Array.from(e.sha.match(/../g),x=>parseInt(x,16)));}const bytes=new Uint8Array(chunks.reduce((sum,b)=>sum+b.length,0));let at=0;for(const b of chunks){bytes.set(b,at);at+=b.length;}check(await objectOid('tree',bytes)===sha,'GIT_TREE_HASH_MISMATCH');
}
export async function decodeGitBlob(body,sha){
 check(body?.sha===sha&&body.encoding==='base64'&&Number.isSafeInteger(body.size)&&body.size>=0&&typeof body.content==='string'&&/^[A-Za-z0-9+/=\s]*$/.test(body.content),'GIT_BLOB_INVALID');let bytes;
 try{bytes=Uint8Array.from(atob(body.content.replace(/\s/g,'')),c=>c.charCodeAt(0));}catch{throw new CoreError('GIT_BLOB_INVALID');}
 check(bytes.length===body.size&&await gitBlob(bytes)===sha,'GIT_BLOB_INVALID');return bytes;
}
export function createGitReader({transport=globalThis.fetch,clock=Date.now}){
 return async({repository,token,path='',etag=null})=>{
  check(validRepository(repository),'GIT_REPOSITORY_INVALID');check(typeof token==='string'&&token.length>=12&&/^[\x21-\x7e]+$/.test(token),'GIT_CREDENTIAL_REQUIRED');
  check(path===''||/^\/git\/(ref\/heads\/main|commits\/[a-f0-9]{40}|trees\/[a-f0-9]{40}(\?recursive=1)?|blobs\/[a-f0-9]{40})$/.test(path),'GIT_READ_SCOPE_DENIED');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);let response;
  try{try{response=await transport('https://api.github.com/repos/'+repository+path,{method:'GET',credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28',...etag?{'If-None-Match':etag}:{}}});}
  catch{throw new CoreError('GIT_CONNECTION_UNAVAILABLE');}
  const get=name=>response.headers?.get(name),retry=get('retry-after'),reset=Number(get('x-ratelimit-reset'))*1000,remaining=get('x-ratelimit-remaining');
  if(response.status===429||response.status===403&&(retry!=null||remaining==='0')){const seconds=Number(retry),date=Date.parse(retry);const at=retry!=null?(Number.isFinite(seconds)?clock()+Math.max(0,seconds)*1000:date):reset;throw Object.assign(new CoreError('GIT_RATE_LIMIT'),{retryAt:Math.max(clock()+1000,Number.isFinite(at)&&at>clock()?at:clock()+60000)});}
  if(response.status===304){check(path==='/git/ref/heads/main'&&etag,'GIT_RESPONSE_INVALID');return {status:304,etag:get('etag')??etag};}
  if(response.status===401||response.status===403)throw new CoreError('GIT_ACCESS_DENIED');
  if(response.status===404||response.status===409)throw new CoreError(path==='/git/ref/heads/main'?'GIT_MAIN_MISSING':'GIT_OBJECT_UNAVAILABLE');
  check(response.status===200,'GIT_CONNECTION_UNAVAILABLE');let body;try{body=await response.json();}catch{throw new CoreError('GIT_RESPONSE_INVALID');}return {status:200,body,etag:get('etag')??null};}finally{clearTimeout(timer);}
 };
}
