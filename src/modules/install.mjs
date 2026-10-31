import {validatePackage,compareVersions,PackageError} from './package.mjs';
import {publicError} from '../core/records.mjs';
export function createInstaller(core){
 return {async install(bytes,{budget}={}){
  const candidate=await validatePackage(bytes,{budget}),m=candidate.manifest;
  const current=await core.read('modules',m.id);
  if(current){
   if(current.packageHash===candidate.packageHash){await core.record({step:'IMPORT_MODULE',result:'EXISTING',moduleId:m.id});return {state:'UNCHANGED',id:m.id};}
   const order=compareVersions(m.version,current.version);
   if(order===0)throw new PackageError('SAME_VERSION_CHANGED');if(order<0)throw new PackageError('DOWNGRADE_REJECTED');
   if(m.settingsSchema!==(current.manifest?.settingsSchema??current.settingsSchema))throw new PackageError('INCOMPATIBLE_SETTINGS_SCHEMA');
   let cursor=null;do{const page=await core.list({table:'jobs',cursor});for(const p of page.rows)if(p.moduleId===m.id&&p.state!=='COMPLETE'){const job=await core.read('jobs',p.id);if(!m.readsJobSchemas.includes(job.jobSchema))throw new PackageError('INCOMPATIBLE_JOB_SCHEMA');}cursor=page.cursor;}while(cursor);
  }
  const pinId='import-'+crypto.randomUUID(),payload={},refs=[];let committed=false;
  try{
   for(const file of m.files){payload[file.path]=await core.putBytes(candidate.files.get(file.path),pinId);refs.push(payload[file.path]);}
   const manifestHash=await core.putBytes(candidate.files.get('module.json'),pinId),packageHash=await core.putBytes(candidate.zip,pinId);refs.push(manifestHash,packageHash);
   const packageRecord={packageHash,manifestHash,manifest:m,payload,refs};
   const value=current?{...current,staged:packageRecord}:{moduleId:m.id,name:m.name,version:m.version,enabled:true,generation:1,settings:{},settingsSchema:m.settingsSchema,state:'READY',...packageRecord};
   try{await core.mutate([{table:'modules',id:m.id,value,expectedRev:current?.rev??0,refs:[...new Set([...(current?.refs??[]),...refs])]}],{step:'IMPORT_MODULE',result:current?'STAGED':'COMPLETE',moduleId:m.id});committed=true;}
   catch(error){const latest=await core.read('modules',m.id);if(latest?.packageHash===packageHash){try{await core.releasePin(pinId);}catch{}return {state:'UNCHANGED',id:m.id};}throw error;}
   let cleanupCode=null;try{await core.releasePin(pinId);}catch{cleanupCode='IMPORT_PIN_CLEANUP_PENDING';}
   return {state:current?'STAGED':'INSTALLED',id:m.id,cleanupCode};
  }catch(error){if(!committed){try{await core.releasePin(pinId);}catch{}try{await core.record({step:'IMPORT_MODULE',result:'FAILED',moduleId:m.id,code:error instanceof PackageError?error.code:publicError(error)});}catch{}}throw error;}
 }};
}
