import {initialControl,selectRefresh,settleRefresh,providerBackoff,controlContext} from './refresh-control.mjs';
import {publicError} from '../core/records.mjs';
import {currentRows} from '../core/current-rows.mjs';
const ID='pcms-refresher',KEY='refresher-control';
export function createRefreshController({core,refresher,directory,save,clock=Date.now,random=Math.random}) {
 let serial=Promise.resolve();const run=fn=>{const p=serial.then(fn,fn);serial=p.catch(()=>{});return p;};
 const state=async()=>({...initialControl(),...await core.view(KEY)});
 async function persist(s){await core.saveView(KEY,s,crypto.randomUUID());return s;}
 const rows=table=>currentRows(core,table);
 async function enabled(){const m=await core.read('modules',ID),r=await core.status();return !!m?.enabled&&!m.lifecycle&&!m.refresher?.paused&&!r.paused&&!r.restoreHold&&m.manifest?.capabilities?.includes('perchance.source');}
 async function tick() {
  let s=await state();const now=clock();
  // Restore imports historical decisions, never a destination dispatch permit.
  const runtime=await core.status();
  if(s.dataset&&s.dataset!==runtime.dataset)s={...initialControl(),dataset:runtime.dataset,code:'RESTORED_CONTROL_RECHECK'};
  s.dataset=runtime.dataset;s.waiting??={};
  const gs=await rows('generators'),as=new Map((await rows('accounts')).map(a=>[a.id,a]));
  const owned=gs.filter(g=>g.remoteId&&!g.ownerMissing&&g.ownerPrincipal===as.get(g.accountId)?.expectedPrincipal);
  const d=await directory.projection(),raw=await core.view('refresher-directory'),snapshot=d.fresh?raw?.lastGood:null;
  // A completed original Unknown save is observed without another source effect.
  for(const [id,p]of Object.entries(s.waiting)) {
   const j=p.jobId?await core.read('jobs',p.jobId):null,g=gs.find(g=>g.id===id);
   if(j?.state==='COMPLETE'&&g?.refreshLast?.decisionId===p.decisionId){s.lastRecovered={generatorId:id,jobId:j.id,verifiedAt:g.refreshLast.verifiedAt,observedAt:d.observedAt,attribution:'ORIGINAL_OPERATION_READBACK'};delete s.waiting[id];}
  }
  if(s.pending) {
   let p=s.pending,g=gs.find(g=>g.id===p.id),j=p.jobId?await core.read('jobs',p.jobId):g?.sourceSaveJobId?await core.read('jobs',g.sourceSaveJobId):null;
   if(j?.refresh?.decisionId!==p.decisionId)j=null;
   if(!j) {
    if(!await enabled())return persist({...s,code:'PAUSED'});
    try{await save.prepare({id:p.id,requestId:p.decisionId,decisionId:p.decisionId,automatic:true});g=await core.read('generators',p.id);j=await core.read('jobs',g.sourceSaveJobId);}
    catch(error){s.targets[p.id]={until:now+60000,code:publicError(error)};s.pending=null;s.nextDue=now+s.spacingMs;s.code=publicError(error);return persist(s);}
   }
   p={...p,jobId:j.id};s.pending=p;
   if(j.state==='HELD'&&!j.refresh.context?.loading&&j.effect?.kind==='REFRESH_EDITOR'&&j.effect.boundary==='POSSIBLE')return persist({...s,code:j.recovery?.code??'REFRESH_EDITOR_OPEN_UNKNOWN'});
   if(j.state==='HELD'&&!j.refresh.context?.loading) {
    s.waiting[p.id]=p;s.pending=null;s.nextDue=Math.max(s.nextDue,now+s.spacingMs);s.code=j.recovery?.code??'REFRESH_HELD';
    const packet=j.save?.operationId?await core.view('source-save:'+j.save.operationId):null;
    if(/RATE_LIMITED|TOO_MANY_REQUESTS|PROVIDER_BACKOFF/.test(s.code)){
     s=providerBackoff(s,{now,retryAfterMs:packet?.retryAfterMs??0,jitter:random()*5000});
     const m=await core.read('modules',ID);await core.mutate([{table:'modules',id:ID,expectedRev:m.rev,refs:m.refs,value:{...m,refresher:{...m.refresher,backoffUntil:s.backoffUntil}}}],{moduleId:ID,targetId:p.id,step:'REFRESH_PROVIDER_BACKOFF',result:'WAITING'});await refresher.changed?.();
    }
    return persist(s);
   }
   if(j.state!=='COMPLETE'||g?.refreshLast?.decisionId!==p.decisionId)return persist({...s,code:j.refresh.context?.loading?'REFRESH_EDITOR_LOADING':'SAVING'});
   if(!p.savedAt){p={...p,savedAt:g.refreshLast.verifiedAt,observeAfter:g.refreshLast.verifiedAt+5000};s.pending=p;await directory.afterSave(p.savedAt);}
   if(!snapshot||snapshot.observedAt<p.observeAfter)return persist({...s,code:'WAITING_FOR_MEASUREMENT'});
   if(controlContext(snapshot)!==controlContext(p.before)){s.pending=null;s.nextDue=now+s.spacingMs;s.code='DIRECTORY_CONTEXT_CHANGED';return persist(s);}
   s=settleRefresh(s,{pending:p,snapshot,owned,now});s.code=s.pending?'WAITING_FOR_PROPAGATION':s.last.responded?'MEASURED_RESPONSE':'NO_VISIBILITY_RESPONSE';
   if(!s.pending&&!s.last.responded){const target=await core.read('generators',p.id);await core.mutate([{table:'generators',id:p.id,expectedRev:target.rev,refs:target.refs,value:{...target,refreshBackoffUntil:s.targets[p.id].until}}],{moduleId:ID,targetId:p.id,step:'REFRESH_TARGET_BACKOFF',result:'WAITING'});await refresher.changed?.();}
   if(s.pending)await directory.afterSave(s.pending.observeAfter-5000);
   return persist(s);
  }
  if(!await enabled())return persist({...s,code:'PAUSED'});
  if(!snapshot)return persist({...s,code:d.code??'DIRECTORY_NOT_MEASURED'});
  if(s.context!==controlContext(snapshot)){s.context=controlContext(snapshot);s.insertions=[];s.propagations=[];}
  if(s.nextDue>now||s.backoffUntil>now)return s;
  const available=[];let offset=0;
  do{const page=await refresher.status({phase:'AVAILABLE',offset,limit:200});for(const row of page.rows){const g=gs.find(g=>g.id===row.id);if(g&&!s.waiting[g.id])available.push(g);}offset=page.next;}while(offset!==null);
  const decision=selectRefresh({snapshot,previous:raw.history?.[0],owned,eligible:available,state:s,now});
  if(!decision)return persist({...s,code:'NO_PROJECTED_GAIN',nextDue:now+60000});
  s.pending={id:decision.id,slug:decision.slug,accountId:decision.accountId,decisionId:crypto.randomUUID(),jobId:null,plannedAt:now,before:snapshot,prediction:decision};s.code='SELECTED';
  await persist(s); // Intent precedes job preparation; a crash resumes this same decision.
  return tick();
 }
 return {tick:()=>run(tick),
  deadline:async()=>{
   const s=await state();if(s.pending){const p=s.pending,j=p.jobId?await core.read('jobs',p.jobId):null;if(j?.refresh.context?.loading)return j.refresh.context.nextCheck;if(p.savedAt)return p.observeAfter>clock()?p.observeAfter:null;return null;}
   if(!await enabled())return null;const d=await directory.projection();return d.fresh?Math.max(s.nextDue,s.backoffUntil,clock()+1000):null;
  },
  projection:async()=>{const s=await state();return {state:s.code??'MONITORING',spacingMs:s.spacingMs,nextDue:s.nextDue,backoffUntil:s.backoffUntil,pending:s.pending?{generatorId:s.pending.id,jobId:s.pending.jobId,predictedGain:s.pending.prediction.gain,savedAt:s.pending.savedAt??null}:null,last:s.last,lastRecovered:s.lastRecovered??null,held:Object.keys(s.waiting??{}).length};}
 };
}
