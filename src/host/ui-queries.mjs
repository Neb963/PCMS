import {requireCore as check} from '../core/records.mjs';
// Read-only projections over the one Core dataset and queue. No UI authority.
export function createUiQueries({core}) {
 const cache=new Map();
 async function snapshot(at=null) {
  const root=at??await core.status(),key=root.dataset+':'+(at?'cut:'+root.sequence:'data:'+(root.dataRevision??root.revision));
  if(cache.has(key))return cache.get(key);
  const pending=(async()=>{const tables={};
  for(const table of ['accounts','generators','jobs']) {
   const rows=[];let cursor={dataset:root.dataset,table,cut:root.sequence,after:'',search:'',filters:{}};
   do{const p=await core.list({table,cursor,limit:200});rows.push(...p.rows);cursor=p.cursor;}while(cursor);
   tables[table]=rows;
  }
  return {root,...tables};})();cache.set(key,pending);cache.set(root.dataset+':cut:'+root.sequence,pending);while(cache.size>8)cache.delete(cache.keys().next().value);
  try{return await pending;}catch(error){cache.delete(key);cache.delete(root.dataset+':cut:'+root.sequence);throw error;}
 }
 function items(s) {
  const as=new Map(s.accounts.map(a=>[a.id,a])),gs=new Map(s.generators.map(g=>[g.id,g]));
  return [
   ...s.accounts.map(a=>({type:'account',id:a.id,label:a.label??a.id,status:a.state??'Unknown',detail:a.principalLabel??'',href:'#accounts/'+a.id})),
   ...s.generators.map(g=>({type:'generator',id:g.id,label:g.slug??g.id,status:g.listing??g.creatorState??'Unknown',detail:[as.get(g.accountId)?.label,g.folder,g.repository].filter(Boolean).join(' · '),href:'#generators/'+g.id})),
   ...s.jobs.map(j=>({type:'job',id:j.id,label:j.kind+' · '+(gs.get(j.targetId)?.slug??as.get(j.targetId)?.label??j.targetId),status:j.effect?.boundary==='POSSIBLE'?'Unknown':j.state,detail:[as.get(j.accountId)?.label,gs.get(j.targetId)?.folder,j.moduleId,j.recovery?.code,j.batchId].filter(Boolean).join(' · '),href:'#work/'+j.id}))
  ].sort((a,b)=>(a.type+':'+a.id).localeCompare(b.type+':'+b.id));
 }
 async function search({query='',cursor=null,limit=20}={}) {
  check(typeof query==='string'&&Number.isSafeInteger(limit)&&limit>0&&limit<=100,'INVALID_QUERY');
  const q=query.trim().toLowerCase();if(!q)return {rows:[],cursor:null};
  const root=await core.status();check(!cursor||cursor.dataset===root.dataset&&cursor.query===q&&Number.isSafeInteger(cursor.cut)&&cursor.cut<=root.sequence&&typeof cursor.after==='string','STALE_CURSOR');
  // Supply the same immutable cut to every table and every later result page.
  const s=cursor?await snapshot({...root,sequence:cursor.cut}):await snapshot(),cut=s.root.sequence;
  const rows=items(s).filter(r=>(!cursor||(r.type+':'+r.id).localeCompare(cursor.after)>0)&&[r.label,r.id,r.status,r.detail].join(' ').toLowerCase().includes(q)),page=rows.slice(0,limit),last=page.at(-1);
  return {rows:page,cursor:rows.length>limit?{dataset:root.dataset,cut,query:q,after:last.type+':'+last.id}:null};
 }
 async function home() {
  const s=await snapshot(),labels=new Map(items(s).map(r=>[r.type+':'+r.id,r.label])),reviewed=await core.view('attention-reviewed')??{},groups=new Map();
  for(const j of s.jobs.filter(j=>['HELD','FAILED'].includes(j.state)||j.effect?.boundary==='POSSIBLE')) {
   const code=j.recovery?.code??(j.effect?.boundary==='POSSIBLE'?'OUTCOME_UNKNOWN':'JOB_FAILED'),key=JSON.stringify([j.targetId,code]);
   const p=groups.get(key)??{key,code,targetId:j.targetId,label:labels.get('generator:'+j.targetId)??labels.get('account:'+j.targetId)??j.targetId,count:0,jobs:[],sequence:0};
   p.count++;p.jobs.push(j.id+':'+j.rev);if(j.sequence>=p.sequence){p.sequence=j.sequence;p.href='#work/'+j.id;p.jobId=j.id;}groups.set(key,p);
  }
  const attention=[...groups.values()].map(p=>{const {jobs,...rest}=p,signature=jobs.sort().join('|');return {...rest,signature,reviewed:reviewed[p.key]===signature};}).sort((a,b)=>Number(a.reviewed)-Number(b.reviewed)||b.sequence-a.sequence||a.key.localeCompare(b.key));
  const priority={RUNNING:0,READY:1,WAITING:2};
  const current=s.jobs.filter(j=>j.state in priority&&j.effect?.boundary!=='POSSIBLE').sort((a,b)=>priority[a.state]-priority[b.state]||a.sequence-b.sequence||a.id.localeCompare(b.id)).map(j=>({id:j.id,label:labels.get('job:'+j.id),state:j.state,href:'#work/'+j.id}));
  return {attention,current,counts:{accounts:s.accounts.length,generators:s.generators.length,jobs:s.jobs.length},sequence:s.root.sequence};
 }
 async function generators({search='',cursor=null,limit=50,accountId='',listing='',workState='',state='',selectedOnly=false,selectedIds=[]}={}){
  check([search,accountId,listing,workState,state].every(v=>typeof v==='string')&&Array.isArray(selectedIds)&&selectedIds.every(id=>typeof id==='string')&&Number.isSafeInteger(limit)&&limit>0&&limit<=200,'INVALID_QUERY');
  const root=await core.status(),query=JSON.stringify([search.toLowerCase(),accountId,listing,workState,state,selectedOnly,selectedOnly?[...selectedIds].sort():[]]);
  check(!cursor||cursor.dataset===root.dataset&&cursor.query===query&&cursor.cut<=root.sequence&&typeof cursor.after==='string','STALE_CURSOR');
  const s=cursor?await snapshot({...root,sequence:cursor.cut}):await snapshot(),owners=new Map(s.accounts.map(a=>[a.id,a.label??a.id])),selected=new Set(selectedIds);
  const rows=s.generators.map(g=>({...g,accountLabel:owners.get(g.accountId??g.allocationAccountId)??null,workStatus:g.deploymentState??g.creatorState??g.state??'UNKNOWN'})).filter(g=>(!cursor||g.id>cursor.after)&&(!accountId||(g.accountId??g.allocationAccountId)===accountId)&&(!listing||(g.listing??'UNKNOWN')===listing)&&(!workState||g.workStatus===workState)&&(!state||g.gitState===state)&&(!selectedOnly||selected.has(g.id))&&(!search||[g.slug,g.accountLabel,g.folder,g.id].join(' ').toLowerCase().includes(search.toLowerCase()))).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0),page=rows.slice(0,limit),last=page.at(-1);
  return {rows:page,accounts:s.accounts.map(a=>({id:a.id,label:a.label??a.id})),workStates:[...new Set(s.generators.map(g=>g.deploymentState??g.creatorState??g.state??'UNKNOWN'))].sort(),cursor:rows.length>limit?{dataset:root.dataset,cut:s.root.sequence,query,after:last.id}:null};
 }
 return {search,generators,
  work:async({search='',state='',moduleId='',cursor=null,limit=50}={})=>{
   check(typeof search==='string'&&typeof state==='string'&&typeof moduleId==='string'&&Number.isSafeInteger(limit)&&limit>0&&limit<=200,'INVALID_QUERY');const root=await core.status(),q=search.toLowerCase();
   check(!cursor||cursor.dataset===root.dataset&&cursor.search===q&&cursor.state===state&&cursor.moduleId===moduleId&&cursor.cut<=root.sequence&&typeof cursor.after==='string','STALE_CURSOR');
   const s=cursor?await snapshot({...root,sequence:cursor.cut}):await snapshot(),cut=s.root.sequence,labels=new Map(items(s).filter(r=>r.type==='job').map(r=>[r.id,r])),rank={HELD:0,FAILED:0,RUNNING:1,WAITING:2,READY:2,COMPLETE:3};
   const key=j=>(rank[j.state]??4)+':'+j.id,rows=s.jobs.filter(j=>(!state||j.state===state)&&(!moduleId||j.moduleId===moduleId)&&(!cursor||key(j)>cursor.after)&&(!q||[labels.get(j.id)?.label,labels.get(j.id)?.detail,j.id,j.targetId,j.accountId,j.moduleId].join(' ').toLowerCase().includes(q))).sort((a,b)=>key(a).localeCompare(key(b))),page=rows.slice(0,limit),last=page.at(-1);
   const current=await Promise.all(page.map(async j=>{const r=!cursor&&root.dataRevision===s.root.dataRevision?j:await core.get('jobs',j.id);return r?{...r,label:labels.get(j.id)?.label,accountLabel:s.accounts.find(a=>a.id===r.accountId)?.label??null}:null;}));
   return {rows:current.filter(Boolean),cursor:rows.length>limit?{dataset:root.dataset,cut,search:q,state,moduleId,after:key(last)}:null};
  },home:async()=>{const p=await home();return {...p,attentionTotal:p.attention.length,currentTotal:p.current.length,attention:p.attention.slice(0,5),current:p.current.slice(0,5)};},
  review:async({key,signature,requestId})=>{const p=await home(),problem=p.attention.find(p=>p.key===key);check(problem&&problem.signature===signature,'ATTENTION_CHANGED');const v=await core.view('attention-reviewed')??{};await core.saveView('attention-reviewed',{...v,[key]:signature},requestId);return {reviewed:true,resolved:false};},
  diagnostics:async()=>{const r=await core.status(),q=await core.queue.status();return {dataset:r.dataset,revision:r.revision,sequence:r.sequence,paused:r.paused,restoreHold:!!r.restoreHold,queueState:q.state,bootId:q.bootId};}
 };
}
