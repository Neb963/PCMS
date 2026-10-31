import {project,publicError} from '../core/records.mjs';
import {CAPABILITIES,bindingAllows,validateStep} from '../modules/bindings.mjs';
export function sanitizeMarkup(html,document) {
 const parsed=new DOMParser().parseFromString(html,'text/html');
 const allowed=new Set(['P','DIV','SECTION','H1','H2','H3','LABEL','INPUT','TEXTAREA','BUTTON','SELECT','OPTION','UL','OL','LI','SPAN','STRONG','SMALL','BR','A','IMG']);
 const attributes=new Set(['id','class','type','value','placeholder','name','for','rows','cols','role','tabindex','title','alt','disabled','checked','selected']);
 for(const element of [...parsed.body.querySelectorAll('*')]){
  if(!allowed.has(element.tagName)){element.remove();continue;}
  for(const attr of [...element.attributes]){
   if(attributes.has(attr.name)||attr.name.startsWith('aria-')||attr.name.startsWith('data-'))continue;
   if(attr.name==='src'&&element.tagName==='IMG'&&/^data:image\/(png|jpeg|webp|gif);base64,/.test(attr.value))continue;
   if(attr.name==='href'&&element.tagName==='A'&&/^#[a-zA-Z0-9_-]*$/.test(attr.value))continue;
   element.removeAttribute(attr.name);
  }
 }
 return parsed.body.innerHTML;
}
export function sanitizeStyle(css){return /@import|url\s*\(|expression\s*\(|-moz-binding|\\/i.test(css)?'':css;}
export function createModuleHost({core,api,document=globalThis.document,window=globalThis.window,onDue=async()=>{},notify=()=>{},journalEffect=null,accountEffect=null}) {
 const frames=new Set(),backgrounds=new Map(),pageBindings=new Map(),bootId=crypto.randomUUID();let running=null;const reconciled=new Set();
 const manifestCap=(m,group)=>m.manifest?.capabilities?.find(c=>c.startsWith(group+'.'));
 async function current(binding){return core.read('modules',binding.moduleId);}
 async function load(module,path){
  const descriptor=module.manifest.files.find(f=>f.path===path),blobId=module.payload?.[path];
  if(!descriptor||descriptor.sha256!==blobId)throw Error('MODULE_PAYLOAD_MISSING');
  const bytes=await core.bytes(blobId);if(bytes.length!==descriptor.bytes)throw Error('MODULE_PAYLOAD_MISSING');return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 }
 async function rpc(binding,m){
  if(binding.mode==='validate')throw Error('VALIDATION_READ_ONLY');
  const active=await current(binding),operation=m.operation,args=m.args??{};
  if(binding.reconciling&&!['query','getView'].includes(operation))throw Error('READ_ONLY_RECONCILIATION');
  const accountCall=['accounts.step','accounts.status'].includes(args.name);
  const journalCall=['journal.export','journal.status','journal.cleanup','journal.cleanupStatus'].includes(args.name);
  const capability=accountCall?'persona.prepare':journalCall?(args.name.startsWith('journal.cleanup')?'journal.cleanup':'journal.export'):operation==='query'?manifestCap(active??{},'records'):operation==='action'?manifestCap(active??{},'jobs'):'ui.view';
  if(!bindingAllows(binding,{source:binding.window,channel:m.channel,current:active,targetId:args.targetId,operation:capability})&&!(binding.stopping&&['saveView','getView'].includes(operation)))throw Error('CAPABILITY_DENIED');
  if(accountCall){
   if(binding.mode!=='background'||!binding.jobId||active.id!=='pcms-accounts'||!accountEffect||(args.name==='accounts.status'?operation!=='query':operation!=='action'))throw Error('ACTION_DENIED');
   const job=await core.read('jobs',binding.jobId);if(job?.moduleId!==binding.moduleId||job.accountId!==binding.accountId||job.targetId!==binding.targetId||job.rev!==binding.expectedRevision)throw Error('STALE_REVISION');
   if(['FAILED','COMPLETE'].includes(job.state))throw Error('JOB_FINISHED');
   const result=await accountEffect(job,args.name==='accounts.status');binding.expectedRevision=result.jobRevision;return result.value;
  }
  if(journalCall){
   if(binding.mode!=='background'||!binding.jobId||active.packageClass!=='bundled-journal'||!journalEffect||(['journal.status','journal.cleanupStatus'].includes(args.name)?operation!=='query':operation!=='action'))throw Error('ACTION_DENIED');
   const job=await core.read('jobs',binding.jobId);if(job?.moduleId!==binding.moduleId||job.rev!==binding.expectedRevision)throw Error('STALE_REVISION');
   if((job.kind==='CLEANUP')!==args.name.startsWith('journal.cleanup'))throw Error('ACTION_DENIED');
   const result=await journalEffect(job,['journal.status','journal.cleanupStatus'].includes(args.name));binding.expectedRevision=result.jobRevision;return result.value;
  }
  if(operation==='pageReady'||operation==='pageFailed')return core.record({step:'OPEN_MODULE_PAGE',result:operation==='pageReady'?'COMPLETE':'FAILED',moduleId:binding.moduleId});
  if(operation==='saveView')return core.saveView('module:'+binding.moduleId+':'+binding.pageId,args.value,m.requestId);
  if(operation==='getView')return core.view('module:'+binding.moduleId+':'+binding.pageId);
  if(operation==='query'){
   if(!['generators','accounts','jobs'].includes(args.table))throw Error('QUERY_DENIED');
   if(binding.targetId&&args.id&&args.table==='accounts'&&args.id!==binding.accountId)throw Error('TARGET_DENIED');
   if(binding.targetId&&args.id&&args.table==='generators'&&args.id!==binding.targetId)throw Error('TARGET_DENIED');
   if(args.id){const row=await core.read(args.table,args.id);if(args.table==='jobs'&&(row?.moduleId!==binding.moduleId||binding.targetId&&row?.targetId!==binding.targetId))throw Error('TARGET_DENIED');return project(args.table,row);}
   if(binding.targetId)throw Error('TARGET_DENIED');
   const page=await core.list({table:args.table,cursor:args.cursor,search:args.search??''});
   if(args.table==='jobs')page.rows=page.rows.filter(j=>j.moduleId===binding.moduleId);return page;
  }
  if(operation==='action'){
   if(args.name!=='enqueue'||binding.mode!=='page')throw Error('ACTION_DENIED');
   const target=await core.read('generators',args.targetId);if(!target)throw Error('TARGET_DENIED');
   const job=await core.queue.enqueue({requestId:args.requestId??m.requestId,logicalKey:args.logicalKey,moduleId:binding.moduleId,targetId:target.id,accountId:target.accountId??null,kind:args.kind,jobSchema:active.manifest.jobSchema,input:args.input??{},dueAt:Date.now()});
   void turn().catch(()=>{});return project('jobs',job);
  }
  throw Error('OPERATION_DENIED');
 }
 async function message(event){
  const binding=[...frames].find(b=>event.source===b.window);if(!binding||event.data?.channel!==binding.channel)return;
  const m=event.data;
  if(m.type==='RPC'){
   try{const result=await rpc(binding,m);binding.window.postMessage({channel:binding.channel,type:'RPC_RESULT',requestId:m.requestId,ok:true,result},'*');}
   catch(error){binding.window.postMessage({channel:binding.channel,type:'RPC_RESULT',requestId:m.requestId,ok:false,code:/^[A-Z_]+$/.test(error.message)?error.message:publicError(error)},'*');}return;
  }
  if(m.type==='READY'){binding.ready.resolve();return;}
  if(m.type==='FAILED'){binding.ready.reject(Error('MODULE_START_FAILED'));return;}
  const pending=binding.pending.get(m.callId);if(!pending)return;
  binding.pending.delete(m.callId);clearTimeout(pending.timer);
  if(m.type==='STEP_RESULT'||m.type==='STOPPED')pending.resolve(m.result??m.receipt);else pending.reject(Error('MODULE_STEP_FAILED'));
 }
 window.addEventListener('message',message);
 function request(binding,type,value={}){
  const callId=crypto.randomUUID();return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{binding.pending.delete(callId);reject(Error('MODULE_STEP_TIMEOUT'));},binding.moduleId==='pcms-accounts'&&type==='STEP'?90000:30000);
   binding.pending.set(callId,{resolve,reject,timer});binding.window.postMessage({channel:binding.channel,type,callId,...value},'*');
  });
 }
 async function frame(module,mode,pageId='background',container=document.body){
  if(!module||!/^[a-f0-9]{64}$/.test(module.packageHash)||!Number.isSafeInteger(module.generation)||!module.enabled||!module.manifest||module.manifest.coreApi!==1||!Array.isArray(module.manifest.capabilities)||module.manifest.capabilities.some(c=>!CAPABILITIES.has(c)))throw Error('MODULE_INCOMPATIBLE');
  const page=mode==='page'?module.manifest.pages.find(p=>p.id===pageId):null;if(mode==='page'&&!page)throw Error('PAGE_MISSING');
  const script=await load(module,mode!=='page'?module.manifest.entries.background:page.script);
  const html=page?sanitizeMarkup(await load(module,page.html),document):'',css=page?.style?sanitizeStyle(await load(module,page.style)):'';
  const iframe=document.createElement('iframe');iframe.src=api.runtime.getURL('host/module-runner.html');iframe.setAttribute('sandbox','allow-scripts');iframe.title=page?.title??module.manifest.name;iframe.className='module-frame';iframe.hidden=mode==='background';
  const binding={moduleId:module.id,hash:module.packageHash,generation:module.generation,bootId,capabilities:new Set([...module.manifest.capabilities,'ui.view']),channel:crypto.randomUUID(),mode,pageId,iframe,pending:new Map(),targetId:null};
  const ready=new Promise((resolve,reject)=>binding.ready={resolve,reject});let timer;
  const loaded=new Promise((resolve,reject)=>{iframe.onload=resolve;iframe.onerror=()=>reject(Error('PAGE_LOAD_FAILED'));});container.append(iframe);binding.window=iframe.contentWindow;frames.add(binding);
  try{await loaded;binding.window.postMessage({type:'INIT',channel:binding.channel,document:bootId,mode:mode==='validate'?'background':mode,script,html,css,settings:module.settings??{},jobs:module.validationJobs??[]},'*');await Promise.race([ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('MODULE_START_TIMEOUT')),10000);})]);if(mode!=='validate'){const latest=await current(binding);if(!bindingAllows(binding,{source:binding.window,channel:binding.channel,current:latest,operation:'ui.view'}))throw Error('STALE_GENERATION');}return binding;}
  catch(error){frames.delete(binding);iframe.remove();throw error;}finally{clearTimeout(timer);}
 }
 async function start(){
  let cursor=null;do{const page=await core.list({table:'modules',cursor});for(const projection of page.rows){const module=await core.read('modules',projection.id);if(module.enabled&&module.manifest?.entries?.background&&!backgrounds.has(module.id))try{backgrounds.set(module.id,await frame(module,'background'));await core.record({step:'START_MODULE',result:'COMPLETE',moduleId:module.id});}catch{await core.record({step:'START_MODULE',result:'FAILED',moduleId:module.id,code:'MODULE_START_FAILED'});}}cursor=page.cursor;}while(cursor);
 }
 async function turn(){
  if(running)return running;
  running=(async()=>{
   await start();const reconcileJobs=await core.queue.reconciliation();const recovery=reconcileJobs.find(j=>!reconciled.has(j.id));const job=recovery??await core.queue.next();if(!job)return;if(recovery)reconciled.add(job.id);
   const runner=backgrounds.get(job.moduleId);if(!runner){if(recovery)return;await core.queue.transition(job.id,job.rev,{state:'HELD',recovery:{action:'OPEN_MODULES',code:'RUNNER_UNAVAILABLE'}});return;}
   runner.targetId=job.targetId;runner.accountId=job.accountId;runner.reconciling=!!recovery;runner.jobId=job.id;runner.expectedRevision=job.rev;
   try{const result=validateStep(await request(runner,'STEP',{job,reconcile:!!recovery}));
    const latestModule=await current(runner);if(!bindingAllows(runner,{source:runner.window,channel:runner.channel,current:latestModule,operation:'ui.view'}))throw Error('STALE_GENERATION');
    const patch={checkpoint:result.checkpoint??null,state:result.kind==='complete'?'COMPLETE':result.kind==='hold'?'HELD':'WAITING',step:result.kind==='complete'?'COMPLETE':'CHECKPOINT'};
    if(result.kind==='wait')patch.dueAt=result.dueAt;if(result.kind==='hold')patch.recovery={action:result.recovery?.action??'OPEN_MODULES',code:result.reason};
    const latest=await core.read('jobs',job.id);if(latest.rev!==runner.expectedRevision||latest.state==='FAILED')return;
    if(latest.effect?.boundary==='POSSIBLE')await core.queue.reconciliationCheckpoint(job.id,latest.rev,result.checkpoint??null);else await core.queue.transition(job.id,latest.rev,patch);
   }catch(error){const latest=await core.read('jobs',job.id),m=await core.read('modules',job.moduleId);if(error.message!=='STALE_REVISION'&&m?.enabled&&!m.lifecycle&&latest?.generation===runner.generation&&latest?.effect?.boundary!=='POSSIBLE'&&latest?.state!=='FAILED')await core.queue.transition(job.id,latest.rev,{state:'HELD',recovery:{action:'OPEN_MODULES',code:'MODULE_STEP_FAILED'}});}
   finally{runner.targetId=null;runner.accountId=null;runner.reconciling=false;runner.jobId=null;await onDue();}
  })().finally(()=>{running=null;});return running;
 }
 async function openPage(moduleId,pageId,container){const module=await core.read('modules',moduleId);return frame(module,'page',pageId,container);}
 function remove(binding){frames.delete(binding);binding.iframe.remove();if(backgrounds.get(binding.moduleId)===binding)backgrounds.delete(binding.moduleId);}
 async function stop(binding){binding.stopping=true;const receipt=await request(binding,'STOP',{generation:binding.generation});if(receipt?.instance!==binding.channel||receipt.generation!==binding.generation||receipt.document!==bootId||receipt.unresolvedEffectIds?.length)throw Error('MODULE_STOP_INCOMPLETE');remove(binding);await core.record({step:'STOP_MODULE',result:'COMPLETE',moduleId:binding.moduleId});return receipt;}
 async function preparePage(moduleId,pageId,sender){
  const module=await core.read('modules',moduleId);if(!module?.enabled||module.lifecycle||!module.manifest)throw Error('MODULE_DISABLED');if(!/^[a-f0-9]{64}$/.test(module.packageHash)||!Number.isSafeInteger(module.generation)||module.manifest.coreApi!==1||module.manifest.capabilities.some(c=>!CAPABILITIES.has(c)))throw Error('MODULE_INCOMPATIBLE');
  const page=module.manifest.pages.find(p=>p.id===pageId);if(!page)throw Error('PAGE_MISSING');
  const token=crypto.randomUUID(),senderKey=JSON.stringify([sender.id,sender.tab?.id,sender.frameId,sender.coreDocument,sender.url]);
  const binding={moduleId,hash:module.packageHash,generation:module.generation,bootId,mode:'page',pageId,channel:token,window:null,capabilities:new Set([...module.manifest.capabilities,'ui.view']),targetId:null,senderKey};
  pageBindings.set(token,binding);
  const descriptor={token,moduleId,pageId,generation:module.generation,document:bootId,hash:module.packageHash,title:page.title,html:sanitizeMarkup(await load(module,page.html),document),css:page.style?sanitizeStyle(await load(module,page.style)):'',script:await load(module,page.script)};
  if((await current(binding))?.rev!==module.rev){pageBindings.delete(token);throw Error('STALE_GENERATION');}return descriptor;
 }
 async function pageRPC(token,message,sender){
  const binding=pageBindings.get(token),senderKey=JSON.stringify([sender.id,sender.tab?.id,sender.frameId,sender.coreDocument,sender.url]);
  if(!binding||binding.senderKey!==senderKey)throw Error('DOCUMENT_DENIED');
  if(message.operation==='pageStopped'){
   const receipt=message.args?.receipt;if(!binding.stopping||receipt?.instance!==token||receipt.document!==bootId||receipt.generation!==binding.generation||receipt.unresolvedEffectIds?.length)throw Error('MODULE_STOP_INCOMPLETE');
   binding.receipt=receipt;binding.stopping.resolve(receipt);return {state:'STOPPED'};
  }
  return rpc(binding,{...message,channel:binding.channel});
 }
 function closePage(token,sender){
  const b=pageBindings.get(token);if(!b)return {state:'CLOSED'};
  const senderKey=JSON.stringify([sender.id,sender.tab?.id,sender.frameId,sender.coreDocument,sender.url]);
  if(b.senderKey!==senderKey)throw Error('DOCUMENT_DENIED');
  b.stopping?.resolve({instance:token,document:bootId,generation:b.generation,disposedResources:0,unresolvedEffectIds:[]});pageBindings.delete(token);return {state:'CLOSED'};
 }
 const lifecycle={
  async checkCandidate(m,jobs){const b=await frame({...m,validationJobs:jobs},'validate');remove(b);},
  async instances(m){return [...frames,...pageBindings.values()].filter(b=>b.moduleId===m.id).map(b=>({instance:b.channel,document:bootId,type:'sandbox'}));},
  async fence(m){notify({type:'moduleFenced',moduleId:m.id});},
  async stopModule(m,l,recordReceipt=async()=>{}){
   if(running)await running;
   const receipts=[];
   for(const expected of l.instances){
    const previous=l.receipts?.find(r=>r.instance===expected.instance);if(previous){receipts.push(previous);continue;}
    const accept=async receipt=>{await recordReceipt(receipt);receipts.push(receipt);};
    const b=[...frames,...pageBindings.values()].find(b=>b.channel===expected.instance);
    if(!b){await accept({...expected,generation:l.oldGeneration,disposedResources:0,unresolvedEffectIds:[]});continue;}
    if(frames.has(b)){await accept(await stop(b));continue;}
    if(b.receipt){await accept(b.receipt);continue;}
    let timer;try{const receipt=await new Promise((resolve,reject)=>{b.stopping={resolve};notify({type:'stopModulePage',token:b.channel,generation:b.generation});timer=setTimeout(()=>reject(Error('MODULE_STOP_INCOMPLETE')),10000);});await accept(receipt);}finally{clearTimeout(timer);}
   }return receipts;
  },
  async rebuild(m){await lifecycle.checkCandidate(m,[]);}
 };
 return {start,turn,openPage,stop,preparePage,pageRPC,closePage,lifecycle,load,closeDocument:id=>{for(const [token,b] of pageBindings)if(JSON.parse(b.senderKey)[3]===id){b.stopping?.resolve({instance:token,document:bootId,generation:b.generation,disposedResources:0,unresolvedEffectIds:[]});pageBindings.delete(token);}},close(){window.removeEventListener('message',message);for(const b of frames){b.iframe.remove();for(const p of b.pending.values()){clearTimeout(p.timer);p.reject(Error('MODULE_STOPPED'));}}frames.clear();backgrounds.clear();}};
}
