import {requireCore as check,sha256} from './records.mjs';
// Source paths are exact provider/Git names. No ASCII, case-folding or Unicode
// normalization is substituted for the provider's observed spelling.
export const sourcePath=p=>typeof p==='string'&&p.isWellFormed()&&(p==='main.pjs'||p==='index.html'||p.startsWith('src/'))&&!p.includes('\\')&&!p.includes('\0')&&!p.startsWith('/')&&p.split('/').every(s=>s!==''&&s!=='.'&&s!=='..');
export function sourcePaths(paths){
 check(Array.isArray(paths)&&paths.every(sourcePath),'SOURCE_PATH_UNSUPPORTED');const names=new Set(paths);check(names.size===paths.length,'SOURCE_PATH_COLLISION');
 for(const p of names){let i=p.indexOf('/');while(i>=0){check(!names.has(p.slice(0,i)),'SOURCE_PATH_COLLISION');i=p.indexOf('/',i+1);}}
 check(names.has('main.pjs')&&names.has('index.html'),'SOURCE_ROOTS_INCOMPLETE');return [...names].sort();
}
export function lfsPointer(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length>4096)return false;
 let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return false;}
 return /^version https:\/\/git-lfs.github.com\/spec\/v1\r?\n(?:[^\r\n]*\r?\n)*oid sha256:[a-f0-9]{64}\r?\nsize [0-9]+(?:\r?\n)?$/.test(text);
}
export function sourceMetadata(packet,target){
 check(packet?.ok===true&&packet.source==='PERCHANCE_SAVED_SOURCE_1'&&packet.slug===target.slug&&packet.remoteId===target.remoteId&&packet.principalFingerprint===target.principalFingerprint&&['PUBLIC','UNLISTED'].includes(packet.listing)&&/^[a-f0-9]{64}$/.test(packet.sourceStamp??'')&&Number.isFinite(packet.observedAt),'SOURCE_IDENTITY_UNVERIFIED');
 check(typeof packet.pjs==='string'&&packet.pjs.isWellFormed()&&typeof packet.html==='string'&&packet.html.isWellFormed()&&Array.isArray(packet.assets),'SOURCE_SCHEMA_UNSUPPORTED');
 const roots=[{path:'main.pjs',bytes:new TextEncoder().encode(packet.pjs)},{path:'index.html',bytes:new TextEncoder().encode(packet.html)}],assets=packet.assets.map(a=>{check(a&&typeof a.path==='string','SOURCE_ASSET_SCHEMA');const path='src/'+a.path;check(sourcePath(path)&&typeof a.key==='string'&&/^[a-f0-9]{32}\.[a-z0-9]{1,20}$/.test(a.key)&&Number.isSafeInteger(a.bytes)&&a.bytes>=0&&(a.sha256==null||/^[a-f0-9]{64}$/.test(a.sha256)),'SOURCE_ASSET_SCHEMA');return {path,virtualPath:a.path,key:a.key,bytes:a.bytes,sha256:a.sha256??null};});
 sourcePaths([...roots.map(f=>f.path),...assets.map(f=>f.path)]);for(const f of roots)check(!lfsPointer(f.bytes),'SOURCE_LFS_POINTER');return {roots,assets:assets.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0),sourceStamp:packet.sourceStamp,listing:packet.listing,observedAt:packet.observedAt,providerRevision:packet.providerRevision??null};
}
export async function sourceAsset(bytes,entry){
 check(bytes instanceof Uint8Array&&bytes.length===entry.bytes,'SOURCE_ASSET_LENGTH');check(!lfsPointer(bytes),'SOURCE_LFS_POINTER');const hash=await sha256(bytes);check(!entry.sha256||hash===entry.sha256,'SOURCE_ASSET_HASH');return {path:entry.path,bytes,sha256:hash};
}
export function compareSources(before,after){
 const a=new Map(before.map(f=>[f.path,f])),b=new Map(after.map(f=>[f.path,f]));return [...new Set([...a.keys(),...b.keys()])].sort().map(path=>({path,state:!a.has(path)?'ADDED':!b.has(path)?'DELETED':a.get(path).sha256!==b.get(path).sha256?'CHANGED':'UNCHANGED',before:a.get(path)??null,after:b.get(path)??null}));
}
