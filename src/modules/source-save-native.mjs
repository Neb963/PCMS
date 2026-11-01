// Fixed MAIN-world native adapter. No raw endpoint/module RPC is exposed.
// The version observations are checkpoints, distinct from content hashes.
export async function observeSourceCheckpoint(request){
 const hold=code=>({ok:false,code});
 try{
  if(location.origin!=='https://perchance.org'||location.pathname!=='/'+request.slug||location.hash!=='#edit'||location.search)return hold('EDITOR_TARGET_CHANGED');
  const w=window,g=w.app?.data?.generator,cp=w.saveCheckpointManager?.current?.();
  if(g?.name!==request.slug||'public_'+(g.publicId??w.generatorPublicId)!==request.remoteId||w.generatorSaveCountKnown!==true||!Number.isSafeInteger(w.generatorSaveCount)||w.generatorSaveCount<0||!Number.isSafeInteger(w.generatorLastSaveTime)||w.generatorLastSaveTime<=0||cp?.saveCountKnown!==true||cp.saveCount!==w.generatorSaveCount||cp.time!==w.generatorLastSaveTime)return hold('SOURCE_CHECKPOINT_UNSUPPORTED');
  const visible=e=>!!e&&!e.hidden&&getComputedStyle(e).display!=='none',stop=document.getElementById('aiAgentStopBtn'),queue=document.getElementById('aiAgentQueueRowEl');
  if(visible(stop)||visible(queue)&&queue.children.length||w.__pendingCheckpointNote||w.__saveInFlight!==false)return hold('EDITOR_AI_OR_SAVE_PENDING');
  const workspace=typeof w.aiAgentWorkspaceSnapshot==='function'?await w.aiAgentWorkspaceSnapshot():null;
  if(workspace?.unavailable||workspace?.preferWorkspace?.modelText||workspace?.preferWorkspace?.outputTemplate)return hold('EDITOR_AI_PENDING');
  if(!w.__PCMS_SOURCE_DOCUMENT_1)Object.defineProperty(w,'__PCMS_SOURCE_DOCUMENT_1',{value:crypto.randomUUID()});
  return {ok:true,source:'PERCHANCE_NATIVE_CHECKPOINT_1',document:w.__PCMS_SOURCE_DOCUMENT_1,time:cp.time,saveCount:cp.saveCount,sourceRevision:/^[a-f0-9]{64}$/.test(w.lastSavedGeneratorSourceRevision??'')?w.lastSavedGeneratorSourceRevision:null};
 }catch{return hold('SOURCE_CHECKPOINT_UNSUPPORTED');}
}

export async function saveNativeSource(request){
 const hold=(code,extra={})=>({ok:false,code,...extra}),w=window;let dispatched=0,staged=false,ack=null,code=null,failurePath=null;
 const fail=c=>{code=c;throw Object.assign(Error(c),{code:c});},ensure=(v,c)=>{if(!v)fail(c);},hash=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join(''),encode=new TextEncoder();
 let fetchOriginal,confirmOriginal,saveOriginal,model,html,src,menu;const options=[],listeners=[],linked=[];
 try{
  ensure(request?.schema===1&&typeof request.operationId==='string'&&Array.isArray(request.files)&&request.checkpoint,'SOURCE_SAVE_CONTRACT');
  ensure(location.origin==='https://perchance.org'&&location.pathname==='/'+request.slug&&location.hash==='#edit'&&!location.search&&w.__PCMS_SOURCE_DOCUMENT_1===request.checkpoint.document,'EDITOR_DOCUMENT_CHANGED');
  ensure(!w.__PCMS_SOURCE_SAVE_ACTIVE_1,'EDITOR_SAVE_UNSETTLED');
  const storage=localStorage.getItem('app-storage'),change=localStorage.getItem('sessionTokenLastChangeTime'),user=JSON.parse(storage)?.user;
  ensure(user?.loggedIn===true&&typeof user.email==='string'&&await hash(encode.encode(user.email.trim().toLowerCase()))===request.principalFingerprint,'ACCOUNT_PRINCIPAL_CHANGED');
  const g=w.app?.data?.generator;model=w.modelTextEditor;html=w.outputTemplateEditor;src=w.srcState;menu=w.menuBar;
  ensure(w.__editorReady===true&&w.userOwnsThisGenerator===true&&g?.name===request.slug&&'public_'+(g.publicId??w.generatorPublicId)===request.remoteId&&g.isPrivate===(request.listing==='UNLISTED'),'SOURCE_TARGET_CHANGED');
  ensure(typeof w.app.saveGenerator==='function'&&typeof src?.ready==='function'&&typeof src.prepareForSave==='function'&&typeof src.afterSaveSuccess==='function'&&typeof src.writeFile==='function'&&typeof src.deleteFile==='function'&&typeof src._internals?.validatePath==='function'&&typeof menu?.setSaveState==='function','SOURCE_SAVE_CONTRACT');
  const checkpointSame=()=>{const cp=w.saveCheckpointManager?.current?.();return cp?.time===request.checkpoint.time&&cp.saveCount===request.checkpoint.saveCount&&cp.saveCountKnown===true&&w.generatorSaveCountKnown===true&&w.generatorSaveCount===cp.saveCount&&w.generatorLastSaveTime===cp.time;};
  const contextSame=()=>location.pathname==='/'+request.slug&&location.hash==='#edit'&&!location.search&&w.__PCMS_SOURCE_DOCUMENT_1===request.checkpoint.document&&w.app?.data?.generator===g&&w.srcState===src&&w.modelTextEditor===model&&w.outputTemplateEditor===html&&g.name===request.slug&&'public_'+(g.publicId??w.generatorPublicId)===request.remoteId&&g.isPrivate===(request.listing==='UNLISTED')&&localStorage.getItem('app-storage')===storage&&localStorage.getItem('sessionTokenLastChangeTime')===change;
  const solo=()=>{const room=w.yjsProvider,doc=w.yDoc,peers=w.yjsAwareness?.getStates?.();return w.editorCollabInitialSyncIsPending===false&&!w.__collabRoomFailed&&!w.collabEditKeyIsIncorrect&&(!room?!w.yjsProviderRoomName:room.wsconnected===true&&room.synced===true&&room.roomname===w.yjsProviderRoomName&&peers instanceof Map&&peers.size===1&&peers.has(doc?.clientID));};
  const idle=()=>{const visible=e=>!!e&&!e.hidden&&getComputedStyle(e).display!=='none';return !visible(document.getElementById('aiAgentStopBtn'))&&!(visible(document.getElementById('aiAgentQueueRowEl'))&&document.getElementById('aiAgentQueueRowEl').children.length)&&!w.__pendingCheckpointNote;};
  ensure(contextSame()&&checkpointSame()&&solo()&&idle()&&w.__saveInFlight===false&&menu.saveState==='saved'&&w.saveCheckpointManager.isDivergenceBlocked()===false&&src.hasPending()===false&&(await src.isDirty())===false&&src.conflictPaths().length===0,'EDITOR_UNVERIFIED');
  const names=()=>{const l=src.list();return (l instanceof Map?[...l.keys()]:Array.isArray(l)?l:Object.keys(l)).sort();},bytesOf=async value=>typeof value==='string'?encode.encode(value):value instanceof Blob?new Uint8Array(await value.arrayBuffer()):value instanceof ArrayBuffer?new Uint8Array(value):value;
  const current=async()=>{const files=[];for(const [path,value]of [['main.pjs',model.getValue()],['index.html',html.getValue()]])files.push({path,bytes:encode.encode(value).length,sha256:await hash(encode.encode(value))});for(const path of names()){const b=await bytesOf(await src.readFile(path));files.push({path:'src/'+path,bytes:b.length,sha256:await hash(b)});}return files.sort((a,b)=>a.path<b.path?-1:1);};
  const equivalent=(a,b)=>JSON.stringify(a.map(f=>[f.path,f.bytes,f.sha256]).sort())===JSON.stringify(b.map(f=>[f.path,f.bytes,f.sha256]).sort());
  ensure(equivalent(await current(),request.baseFiles),'SOURCE_EDITOR_BASE_CHANGED');
  const candidate=[];for(const f of request.files){ensure(typeof f.path==='string'&&/^(?:main\.pjs$|index\.html$|src\/)/.test(f.path)&&!f.path.includes('\\')&&!f.path.includes('\0')&&f.path.split('/').every(s=>s&&s!=='.'&&s!=='..'),'SOURCE_PATH_UNSUPPORTED');const b=Uint8Array.from(atob(f.base64),c=>c.charCodeAt(0));ensure(await hash(b)===f.sha256&&b.length===f.bytes,'SOURCE_CANDIDATE_CHANGED');if(f.path.startsWith('src/')&&src._internals.validatePath(f.path.slice(4))!==null){failurePath=f.path;fail('SOURCE_NATIVE_PATH_UNSUPPORTED');}candidate.push({...f,data:b});}
  ensure(new Set(candidate.map(f=>f.path)).size===candidate.length&&candidate.some(f=>f.path==='main.pjs')&&candidate.some(f=>f.path==='index.html'),'SOURCE_SET_INCOMPLETE');
  const text=path=>new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(candidate.find(f=>f.path===path).data),pjs=text('main.pjs'),template=text('index.html');
  ensure(pjs.isWellFormed()&&template.isWellFormed(),'SOURCE_TEXT_UNSUPPORTED');
  // Preserve undo history. A read-only UI fence lasts only this native save.
  for(const editor of [model,html]){const doc=editor.getDoc?.();ensure(typeof doc?.replaceRange==='function'&&typeof doc.lastLine==='function'&&typeof doc.getLine==='function'&&typeof doc.iterLinkedDocs==='function'&&typeof editor.setOption==='function'&&typeof editor.getOption==='function','SOURCE_EDITOR_CONTRACT');const docs=[doc];doc.iterLinkedDocs(d=>docs.push(d));ensure(docs.every(d=>d.isClean?.()===true),'EDITOR_DIRTY');for(const d of docs)if(d!==doc)linked.push({doc:d,value:d.getValue(),clean:true});options.push([editor,editor.getOption('readOnly')]);}
  const workspace=typeof w.aiAgentWorkspaceSnapshot==='function'?await w.aiAgentWorkspaceSnapshot():null;ensure(!workspace?.unavailable&&!workspace?.preferWorkspace?.modelText&&!workspace?.preferWorkspace?.outputTemplate,'EDITOR_AI_PENDING');
  ensure(contextSame()&&checkpointSame()&&solo()&&idle()&&w.__saveInFlight===false&&equivalent(await current(),request.baseFiles),'SOURCE_FINAL_GATE_CHANGED');
  w.__PCMS_SOURCE_SAVE_ACTIVE_1=request.operationId;
  for(const [e]of options)e.setOption('readOnly','nocursor');
  const stop=e=>{e.preventDefault();e.stopImmediatePropagation();};for(const name of ['beforeinput','drop','paste','click']){document.addEventListener(name,stop,true);listeners.push([name,stop]);}
  fetchOriginal=w.fetch;confirmOriginal=w.confirm;saveOriginal=w.app.saveGenerator;
  const nativeFetch=fetchOriginal.bind(w),expected=new Map(candidate.filter(f=>f.path.startsWith('src/')).map(f=>[f.path.slice(4),f]));
  // No retry/force escalation, even if native stale or CAPTCHA handling loops.
  w.fetch=async function(input,init){const url=new URL(typeof input==='string'?input:input.url,location.href);if(url.origin==='https://perchance.org'&&url.pathname==='/api/save'){
    ensure(dispatched===0,'SOURCE_REPEATED_SAVE_BLOCKED');ensure(linked.every(x=>x.doc.getValue()===x.value&&x.doc.isClean()===true),'EDITOR_DIRTY');ensure(contextSame()&&checkpointSame()&&solo()&&idle(),'SOURCE_FINAL_GATE_CHANGED');
    ensure(equivalent(await current(),candidate),'SOURCE_STAGED_CHANGED');const b=JSON.parse(init?.body);ensure(b.forceSaveDespiteStaleness===undefined&&b.editKey===undefined&&b.collabEditKey===undefined&&b.lastKnownSaveTime===request.checkpoint.time&&b.lastKnownSaveCount===request.checkpoint.saveCount,'SOURCE_PRECONDITION_CHANGED');
    ensure(b.email===user.email&&b.sessionToken===user.sessionToken&&b.generator?.name===request.slug&&b.generator.isPrivate===g.isPrivate&&b.generator.modelText===pjs&&b.generator.outputTemplate===template&&!Object.hasOwn(b.generator,'srcManifest')&&b.srcManifest&&typeof b.srcManifest==='object'&&!Array.isArray(b.srcManifest),'SOURCE_WIRE_CONTRACT');
    ensure(JSON.stringify(Object.keys(b.srcManifest).sort())===JSON.stringify([...expected.keys()].sort()),'SOURCE_MANIFEST_CHANGED');
    ensure(equivalent(await current(),candidate)&&contextSame()&&checkpointSame()&&solo()&&idle(),'SOURCE_STAGED_CHANGED');
    for(const [path,f]of expected){const entry=b.srcManifest[path],working=src._internals.working?.[path];ensure(entry&&entry.size===f.bytes&&typeof entry.key==='string'&&entry.key===working?.key,'SOURCE_MANIFEST_CHANGED');}
    dispatched++;const response=await nativeFetch(input,init);try{const data=await response.clone().json();if(['saved','stale'].includes(data?.status)&&Number.isSafeInteger(data.time)&&Number.isSafeInteger(data.saveCount)&&/^[a-f0-9]{64}$/.test(data.sourceRevision??''))ack={status:data.status,time:data.time,saveCount:data.saveCount,sourceRevision:data.sourceRevision};else code='SOURCE_RESPONSE_SCHEMA';}catch{code='SOURCE_RESPONSE_UNKNOWN';}return response;
   }return nativeFetch(input,init);};
  // Deny native escalation only inside this guarded call; restore in finally.
  w.confirm=()=>false;w.app.saveGenerator=()=>false;
  for(const [editor,value]of [[model,pjs],[html,template]]){if(editor.getValue()!==value){const d=editor.getDoc(),last=d.lastLine();d.replaceRange(value,{line:0,ch:0},{line:last,ch:d.getLine(last).length},'pcms-source');staged=true;}}
  for(const path of names())if(!expected.has(path)){await src.deleteFile(path);staged=true;}
  for(const [path,f]of expected){const old=request.baseFiles.find(b=>b.path===f.path);if(old?.sha256!==f.sha256){await src.writeFile(path,f.data);staged=true;}}
  ensure(contextSame()&&checkpointSame()&&solo()&&idle()&&equivalent(await current(),candidate),'SOURCE_STAGED_CHANGED');menu.setSaveState('unsaved');
  await saveOriginal.call(w.app);
  if(ack?.status==='stale')return hold('SOURCE_STALE',{dispatched,staged,ack});
  if(!ack||ack.status!=='saved'||code)return hold(code??(dispatched===0?'SOURCE_NATIVE_PREPARATION_FAILED':'SOURCE_SAVE_UNKNOWN'),{dispatched,staged,ack});
  ensure(ack.saveCount===request.checkpoint.saveCount+1&&ack.time>=request.checkpoint.time,'SOURCE_RESPONSE_SCHEMA');
  return {ok:true,source:'PERCHANCE_NATIVE_SAVE_1',operationId:request.operationId,dispatched,staged,ack};
 }catch(error){return hold(error.code??'SOURCE_SAVE_UNKNOWN',{dispatched,staged,ack,...failurePath?{path:failurePath}:{}});}
 finally{
  if(fetchOriginal)w.fetch=fetchOriginal;if(confirmOriginal)w.confirm=confirmOriginal;
  for(const [name,fn]of listeners)document.removeEventListener(name,fn,true);
  for(const [editor,value]of options)try{editor.setOption('readOnly',value);}catch{}
  if(saveOriginal&&w.app?.saveGenerator!==saveOriginal)w.app.saveGenerator=saveOriginal;if(w.__PCMS_SOURCE_SAVE_ACTIVE_1===request?.operationId)delete w.__PCMS_SOURCE_SAVE_ACTIVE_1;
 }
}
