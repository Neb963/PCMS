// Private first-install path: validate packaged bytes through the same strict
// local-ZIP validator as user-selected modules; do not grant module code Core.
import {validatePackage} from './package.mjs';
const ids=['pcms-accounts','pcms-discover','pcms-creator','pcms-deployer',
 'pcms-refresher','pcms-journal','pcms-backup'];
const pinId='bundled-first-install';
const bundledUrl=id=>'bundled/'+id+'.zip';
export async function seedBundled(core,{read=async path=>{
 const response=await fetch(browser.runtime.getURL(path));
 if(!response.ok)throw Error('BUNDLED_RESOURCE_UNAVAILABLE');
 return new Uint8Array(await response.arrayBuffer());
 }}={}){
 const initial=await core.moduleSeedStatus();
 if(initial.initialized)return {state:'UNCHANGED'};
 // Existing records belong to the operator or a restored dataset. Set the
 // marker without downloading or replacing a user-selected module.
 if(initial.moduleCount)return core.seedModules([]);
 const response=await read('bundled/registry.json');
 const index=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(response));
 if(index.schema!==1||!Array.isArray(index.packages)||index.packages.length!==ids.length||
  index.packages.some((p,i)=>p.id!==ids[i]||!/^[a-f0-9]{64}$/.test(p.packageHash)||!/^[a-f0-9]{64}$/.test(p.manifestHash)))throw Error('BUNDLED_MANIFEST_INVALID');
 const candidates=[];
 for(const entry of index.packages){
  const candidate=await validatePackage(await read(bundledUrl(entry.id)));
  if(candidate.manifest.id!==entry.id||candidate.packageHash!==entry.packageHash||
   candidate.manifestHash!==entry.manifestHash||candidate.manifest.version!=='0.1.0'||
   candidate.manifest.capabilities.length||candidate.manifest.pages.length||
   candidate.manifest.entries.background!=='background.js')throw Error('BUNDLED_PACKAGE_MISMATCH');
  candidates.push(candidate);
 }
 const rows=[];
 try {
  for(const c of candidates){
   const payload={},refs=[];
   for(const f of c.manifest.files){payload[f.path]=await core.putBytes(c.files.get(f.path),pinId);refs.push(payload[f.path]);}
   const manifestHash=await core.putBytes(c.files.get('module.json'),pinId);
   const packageHash=await core.putBytes(c.zip,pinId);
   if(manifestHash!==c.manifestHash||packageHash!==c.packageHash)throw Error('BUNDLED_HASH_MISMATCH');
   refs.push(manifestHash,packageHash);
   rows.push({moduleId:c.manifest.id,name:c.manifest.name,version:c.manifest.version,
    enabled:true,generation:1,state:'READY',packageClass:
    c.manifest.id==='pcms-journal'?'bundled-journal':c.manifest.id==='pcms-backup'?'bundled-backup':null,
    settings:{},settingsSchema:c.manifest.settingsSchema,manifest:c.manifest,
    packageHash,manifestHash,payload,refs});
  }
  return await core.seedModules(rows);
 }finally{
  // If a process terminates before this point, the fixed pin is reused and
  // released on the next successful seed attempt. No module row was exposed.
  try{await core.releasePin(pinId);}catch{}
 }
}
export const bundledIds=Object.freeze(ids);
