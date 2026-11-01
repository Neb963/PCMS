// A volatile predicate over Core account bindings, not a route ledger/router.
// Empty on every boot; donor verification and the exact committed tuple are
// both required before traffic from a tagged Persona can leave quarantine.
let bindings=new Map(),pending=Promise.resolve();
export function accountRouteAllowed(profile,verified){
 if(!profile?.pcmsAccountId)return true;
 const pin=bindings.get(profile.pcmsAccountId);
 return !!pin&&verified?.ok===true&&pin.personaUid===profile.personaUid&&pin.containerId===profile.containerId&&pin.routeId===profile.routeId&&pin.exitAddresses.includes('IPv4:'+verified.data?.ip);
}
export function closeAccountPins(){bindings=new Map();}
export function refreshAccountPins(core){
 const turn=pending.catch(()=>{}).then(async()=>{const next=new Map();let cursor=null;do{const page=await core.list({table:'accounts',cursor});for(const p of page.rows){const a=await core.read('accounts',p.id);if(a?.personaUid&&a.containerId&&a.routeId&&a.exitAddresses?.length&&['OPEN','IDENTITY','LOGIN_REQUIRED','READY'].includes(a.flow?.stage)&&!['ARCHIVED','REMOVING','REMOVED'].includes(a.state))next.set(a.id,{personaUid:a.personaUid,containerId:a.containerId,routeId:a.routeId,exitAddresses:[...a.exitAddresses]});}cursor=page.cursor;}while(cursor);
  const root=await core.status?.();
  if(root?.restoreHold&&core.restore){
   const c=await core.restore.read(),m=await core.read('modules','pcms-backup'),job=c?.jobId?await core.read('jobs',c.jobId):null,boot=(await core.queue.status()).bootId;
   if(c?.id===root.restoreHold.id&&c.jobId===root.restoreHold.jobId&&job?.moduleId==='pcms-backup'&&job.kind==='RESTORE'&&job.generation===m?.generation&&m?.enabled&&!m.lifecycle&&m.packageClass==='bundled-backup'&&m.manifest?.capabilities?.includes('backup.restore')){
    for(const p of c.participants??[]){
     const proof=p.routeProof,map=c.mappings.find(x=>x.accountId===p.accountId);
     if(proof?.source!=='RESTORE_ROUTE_1'||proof.coreBootId!==boot||!Number.isFinite(proof.observedAt)||proof.observedAt<c.confirmedAt||!map||proof.personaUid!==map.personaUid||proof.containerId!==map.destinationContainerId||typeof proof.routeId!=='string'||['__block__','__direct__'].includes(proof.routeId)||!Array.isArray(proof.exitAddresses)||!proof.exitAddresses.length||!proof.exitAddresses.every(x=>typeof x==='string'&&/^IPv[46]:/.test(x)))continue;
     next.set(p.accountId,{personaUid:proof.personaUid,containerId:proof.containerId,routeId:proof.routeId,exitAddresses:[...proof.exitAddresses]});
    }
   }
  }
  bindings=next;});
 pending=turn;return turn.catch(error=>{closeAccountPins();throw error;});
}
