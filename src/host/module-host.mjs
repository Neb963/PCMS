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
export function createModuleHost({core,api,document=globalThis.document,window=globalThis.window,onDue=async()=>{}}) {
 const frames=new Set(),backgrounds=new Map(),pageBindings=new Map(),bootId=crypto.randomUUID();let running=null;const reconciled=new Set();
 const manifestCap=(m,group)=>m.manifest?.capabilities?.find(c=>c.startsWith(group+'.'));
 async function current(binding){return core.read('modules',binding.moduleId);}
 async function load(module,path){
  const descriptor=module.manifest.files.find(f=>f.path===path),blobId=module.payload?.[path];
  if(!descriptor||descriptor.sha256!==blobId)throw Error('MODULE_PAYLOAD_MISSING');
  const bytes=await core.bytes(blobId);if(bytes.length!==descriptor.bytes)throw Error('MODULE_PAYLOAD_MISSING');return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 }
 async function rpc(binding,m){
  const active=await current(binding),operation=m.operation,args=m.args??{};
  if(binding.reconciling&&!['query','getView'].includes(operation))throw Error('READ_ONLY_RECONCILIATION');
  const capability=operation==='query'?manifestCap(active??{},'records'):operation==='action'?manifestCap(active??{},'jobs'):'ui.view';
  if(!bindingAllows(binding,{source:binding.window,channel:m.channel,current:active,targetId:args.targetId,operation:capability}))throw Error('CAPABILITY_DENIED');
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
   const timer=setTimeout(()=>{binding.pending.delete(callId);reject(Error('MODULE_STEP_TIMEOUT'));},30000);
   binding.pending.set(callId,{resolve,reject,timer});binding.window.postMessage({channel:binding.channel,type,callId,...value},'*');
  });
 }
 async function frame(module,mode,pageId='background',container=document.body){
  if(!module||!/^[a-f0-9]{64}$/.test(module.packageHash)||!Number.isSafeInteger(module.generation)||!module.enabled||!module.manifest||module.manifest.coreApi!==1||!Array.isArray(module.manifest.capabilities)||module.manifest.capabilities.some(c=>!CAPABILITIES.has(c)))throw Error('MODULE_INCOMPATIBLE');
  const page=mode==='page'?module.manifest.pages.find(p=>p.id===pageId):null;if(mode==='page'&&!page)throw Error('PAGE_MISSING');
  const script=await load(module,mode==='background'?module.manifest.entries.background:page.script);
  const html=page?sanitizeMarkup(await load(module,page.html),document):'',css=page?.style?sanitizeStyle(await load(module,page.style)):'';
  const iframe=document.createElement('iframe');iframe.src=api.runtime.getURL('host/module-runner.html');iframe.setAttribute('sandbox','allow-scripts');iframe.title=page?.title??module.manifest.name;iframe.className='module-frame';iframe.hidden=mode==='background';
  const binding={moduleId:module.id,hash:module.packageHash,generation:module.generation,bootId,capabilities:new Set([...module.manifest.capabilities,'ui.view']),channel:crypto.randomUUID(),mode,pageId,iframe,pending:new Map(),targetId:null};
  const ready=new Promise((resolve,reject)=>binding.ready={resolve,reject});let timer;
  const loaded=new Promise((resolve,reject)=>{iframe.onload=resolve;iframe.onerror=()=>reject(Error('PAGE_LOAD_FAILED'));});container.append(iframe);binding.window=iframe.contentWindow;frames.add(binding);
  try{await loaded;binding.window.postMessage({type:'INIT',channel:binding.channel,mode,script,html,css,settings:module.settings??{}},'*');await Promise.race([ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('MODULE_START_TIMEOUT')),10000);})]);return binding;}
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
   runner.targetId=job.targetId;runner.accountId=job.accountId;runner.reconciling=!!recovery;
   try{const result=validateStep(await request(runner,'STEP',{job,reconcile:!!recovery}));
    const latestModule=await current(runner);if(!bindingAllows(runner,{source:runner.window,channel:runner.channel,current:latestModule,operation:'ui.view'}))throw Error('STALE_GENERATION');
    const patch={checkpoint:result.checkpoint??null,state:result.kind==='complete'?'COMPLETE':result.kind==='hold'?'HELD':'WAITING',step:result.kind==='complete'?'COMPLETE':'CHECKPOINT'};
    if(result.kind==='wait')patch.dueAt=result.dueAt;if(result.kind==='hold')patch.recovery={action:result.recovery?.action??'OPEN_MODULES',code:result.reason};
    if(job.effect?.boundary==='POSSIBLE')await core.queue.reconciliationCheckpoint(job.id,job.rev,result.checkpoint??null);else await core.queue.transition(job.id,job.rev,patch);
   }catch{const latest=await core.read('jobs',job.id);if(latest?.effect?.boundary!=='POSSIBLE')await core.queue.transition(job.id,latest.rev,{state:'HELD',recovery:{action:'OPEN_MODULES',code:'MODULE_STEP_FAILED'}});}
   finally{runner.targetId=null;runner.accountId=null;runner.reconciling=false;await onDue();}
  })().finally(()=>{running=null;});return running;
 }
 async function openPage(moduleId,pageId,container){const module=await core.read('modules',moduleId);return frame(module,'page',pageId,container);}
 async function stop(binding){const receipt=await request(binding,'STOP',{generation:binding.generation});frames.delete(binding);binding.iframe.remove();if(backgrounds.get(binding.moduleId)===binding)backgrounds.delete(binding.moduleId);await core.record({step:'STOP_MODULE',result:'COMPLETE',moduleId:binding.moduleId});return receipt;}
 async function preparePage(moduleId,pageId,sender){
  const module=await core.read('modules',moduleId);if(!module?.enabled||!module.manifest)throw Error('MODULE_DISABLED');if(!/^[a-f0-9]{64}$/.test(module.packageHash)||!Number.isSafeInteger(module.generation)||module.manifest.coreApi!==1||module.manifest.capabilities.some(c=>!CAPABILITIES.has(c)))throw Error('MODULE_INCOMPATIBLE');
  const page=module.manifest.pages.find(p=>p.id===pageId);if(!page)throw Error('PAGE_MISSING');
  const token=crypto.randomUUID(),senderKey=JSON.stringify([sender.id,sender.tab?.id,sender.frameId,sender.coreDocument,sender.url]);
  const binding={moduleId,hash:module.packageHash,generation:module.generation,bootId,mode:'page',pageId,channel:token,window:null,capabilities:new Set([...module.manifest.capabilities,'ui.view']),targetId:null,senderKey};
  pageBindings.set(token,binding);
  return {token,moduleId,pageId,generation:module.generation,hash:module.packageHash,title:page.title,html:sanitizeMarkup(await load(module,page.html),document),css:page.style?sanitizeStyle(await load(module,page.style)):'',script:await load(module,page.script)};
 }
 async function pageRPC(token,message,sender){
  const binding=pageBindings.get(token),senderKey=JSON.stringify([sender.id,sender.tab?.id,sender.frameId,sender.coreDocument,sender.url]);
  if(!binding||binding.senderKey!==senderKey)throw Error('DOCUMENT_DENIED');
  return rpc(binding,{...message,channel:binding.channel});
 }
 return {start,turn,openPage,stop,preparePage,pageRPC,closeDocument:id=>{for(const [token,b] of pageBindings)if(JSON.parse(b.senderKey)[3]===id)pageBindings.delete(token);},close(){window.removeEventListener('message',message);for(const b of frames){b.iframe.remove();for(const p of b.pending.values()){clearTimeout(p.timer);p.reject(Error('MODULE_STOPPED'));}}frames.clear();backgrounds.clear();}};
}
