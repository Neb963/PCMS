import {requireCore as check,CoreError} from './records.mjs';

// Private derived metadata only. One shared cache per Core object; records and
// effect admission remain authoritative in IndexedDB. Never cache credentials,
// source bytes, clock/directory observations or module/Pause admission.
const readers=new WeakMap();
const stamp=root=>JSON.stringify([root.dataset,root.dataRevision??root.revision]);
export async function currentRows(core,table){
 check(['accounts','generators'].includes(table),'QUERY_DENIED');
 let cache=readers.get(core);if(!cache){cache=new Map();readers.set(core,cache);}
 for(let attempt=0;attempt<3;attempt++){
  const cut=stamp(await core.status());let entry=cache.get(table);
  if(entry?.cut!==cut){
   entry={cut};cache.set(table,entry);
   entry.pending=(async()=>{
    const rows=[];let cursor=null;
    do{const page=await core.list({table,cursor,limit:200});for(const item of page.rows){const row=await core.read(table,item.id);if(!row)throw new CoreError('STALE_REVISION');rows.push(row);}cursor=page.cursor;}while(cursor);
    if(stamp(await core.status())!==cut)throw new CoreError('STALE_REVISION');
    return rows;
   })();
  }
  try{
   const rows=await entry.pending;
   if(stamp(await core.status())!==cut){if(cache.get(table)===entry)cache.delete(table);continue;}
   return structuredClone(rows);
  }catch(error){
   if(cache.get(table)===entry)cache.delete(table);
   if(error?.code!=='STALE_REVISION')throw error;
  }
 }
 throw new CoreError('STALE_REVISION');
}
