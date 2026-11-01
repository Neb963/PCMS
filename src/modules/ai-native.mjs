// Fixed native UI adapter, never an AI transport/client. The document-local
// receipt proves only this click/transition; losing it requires inspection.
export async function nativeAi(request){
 const w=window,hold=(code,noDispatch=false)=>({ok:false,code,noDispatch});let clicked=false;
 try{
  const hash=async text=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(v=>v.toString(16).padStart(2,'0')).join('');
  if(location.origin!=='https://perchance.org'||location.pathname!=='/'+request.slug||location.hash!=='#edit'||location.search)return hold('AI_TARGET_CHANGED',true);
  const g=w.app?.data?.generator,src=w.srcState,user=JSON.parse(localStorage.getItem('app-storage')??'null')?.user;
  if(!w.__editorReady||w.userOwnsThisGenerator!==true||g?.name!==request.slug||'public_'+(g.publicId??w.generatorPublicId)!==request.remoteId||g.isPrivate!==true||user?.loggedIn!==true||await hash(user.email.trim().toLowerCase())!==request.principalFingerprint)return hold('AI_OWNER_CHANGED',true);
  const get=id=>document.getElementById(id),input=get('aiAgentInputEl'),send=get('aiAgentSendBtn'),fresh=get('aiAgentNewChatBtn'),stop=get('aiAgentStopBtn'),messages=get('aiAgentMsgsEl'),queue=get('aiAgentQueueRowEl'),wall=get('aiAgentWallEl'),attachments=get('aiAgentAttachChipsEl');
  if(input?.tagName!=='TEXTAREA'||send?.tagName!=='BUTTON'||fresh?.tagName!=='BUTTON'||stop?.tagName!=='BUTTON'||!messages||!queue||!wall||!attachments||typeof src?.getDraftChatSid!=='function')return hold('AI_NATIVE_CONTRACT',true);
  const visible=e=>!e.hidden&&getComputedStyle(e).display!=='none',idle=()=>!visible(stop)&&!visible(wall)&&!(visible(queue)&&queue.children.length)&&!attachments.children.length;
  if(!w.__PCMS_AI_DOCUMENT_1)Object.defineProperty(w,'__PCMS_AI_DOCUMENT_1',{value:crypto.randomUUID()});
  if(request.document&&request.document!==w.__PCMS_AI_DOCUMENT_1)return hold('AI_DOCUMENT_CHANGED',true);
  if(!w.__PCMS_AI_RECEIPTS_1)Object.defineProperty(w,'__PCMS_AI_RECEIPTS_1',{value:new Map()});
  const receipts=w.__PCMS_AI_RECEIPTS_1,previous=receipts.get(request.operationId),sid=()=>src.getDraftChatSid(),digest=async()=>sid()?hash('PCMS_AI_SESSION_1:'+request.nonce+':'+sid()):null;
  const observation=async()=>{const r=receipts.get(request.operationId);if(r?.action==='SEND'&&!r.complete&&sid()&&input.value===''){r.complete=true;r.chatDigest=await digest();}return {ok:true,source:'PERCHANCE_NATIVE_AI_1',document:w.__PCMS_AI_DOCUMENT_1,chatDigest:await digest(),idle:idle(),queueEmpty:!queue.children.length,receipt:r??null};};
  if(request.action==='OBSERVE')return observation();
  if(previous)return previous.complete?observation():hold('AI_EFFECT_UNKNOWN');
  if(!['NEW_CHAT','SEND'].includes(request.action)||!idle()||w.__saveInFlight!==false||w.__pendingCheckpointNote)return hold('AI_NOT_IDLE',true);
  const room=w.yjsProvider,peers=w.yjsAwareness?.getStates?.();if(w.editorCollabInitialSyncIsPending!==false||w.__collabRoomFailed||w.collabEditKeyIsIncorrect||(!room?!!w.yjsProviderRoomName:room.wsconnected!==true||room.synced!==true||room.roomname!==w.yjsProviderRoomName||!(peers instanceof Map)||peers.size!==1||!peers.has(w.yDoc?.clientID)))return hold('AI_COLLABORATION_UNVERIFIED',true);
  if(request.action==='NEW_CHAT'){
   if(fresh.disabled)return hold('AI_NEW_CHAT_UNAVAILABLE',true);
   const beforeSid=sid(),beforeNode=messages.firstChild;
   receipts.set(request.operationId,{action:'NEW_CHAT',complete:false});clicked=true;fresh.click();
   await new Promise(resolve=>setTimeout(resolve,0));
   const greeting='👋 I can edit the code and test it live. Ask me to build, change or test something.';
   if(sid()||!idle()||messages.textContent.trim()!==greeting||messages.firstChild===beforeNode||!beforeSid)return hold('AI_FRESH_CHAT_UNVERIFIED');
   receipts.set(request.operationId,{action:'NEW_CHAT',complete:true,fresh:true});return observation();
  }
  const reset=receipts.get(request.newChatOperationId);
  if(!reset?.complete||!reset.fresh||sid()||send.disabled)return hold('AI_FRESH_CHAT_LOST',true);
  // Captured native send() trims and may prefix SW notices. Do not knowingly
  // dispatch altered text, or normalize CRLF through a textarea silently.
  if(typeof request.text!=='string'||request.text!==request.text.trim()||!request.text)return hold('AI_NATIVE_PROMPT_TRANSFORMATION',true);
  if(!navigator.serviceWorker)return hold('AI_SERVICE_WORKER_REQUIRED',true);
  if(await hash(request.text)!==request.promptHash)return hold('AI_PROMPT_HASH',true);
  input.value=request.text;input.dispatchEvent(new Event('input',{bubbles:true}));
  if(input.value!==request.text||await hash(input.value)!==request.promptHash||!idle()||sid()||send.disabled)return hold('AI_INPUT_CHANGED',true);
  receipts.set(request.operationId,{action:'SEND',complete:false,promptHash:request.promptHash,exactInput:true});clicked=true;send.click();
  await new Promise(resolve=>setTimeout(resolve,0));
  return observation();
 }catch{return hold(clicked?'AI_EFFECT_UNKNOWN':'AI_NATIVE_CONTRACT',!clicked);}
}
