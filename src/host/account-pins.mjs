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
 const turn=pending.catch(()=>{}).then(async()=>{const next=new Map();let cursor=null;do{const page=await core.list({table:'accounts',cursor});for(const p of page.rows){const a=await core.read('accounts',p.id);if(a?.personaUid&&a.containerId&&a.routeId&&a.exitAddresses?.length&&['OPEN','IDENTITY','LOGIN_REQUIRED','READY'].includes(a.flow?.stage)&&!['ARCHIVED','REMOVING','REMOVED'].includes(a.state))next.set(a.id,{personaUid:a.personaUid,containerId:a.containerId,routeId:a.routeId,exitAddresses:[...a.exitAddresses]});}cursor=page.cursor;}while(cursor);bindings=next;});
 pending=turn;return turn.catch(error=>{closeAccountPins();throw error;});
}
