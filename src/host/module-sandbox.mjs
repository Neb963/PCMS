// This script runs only in the opaque manifest sandbox. It has no extension API.
let channel=null,mode=null,module=null,sequence=0;const pending=new Map();
const send=message=>parent.postMessage({channel,...message},'*');
function rpc(operation,args={}) {
 const requestId=channel+':'+(++sequence);
 return new Promise((resolve,reject)=>{pending.set(requestId,{resolve,reject});send({type:'RPC',requestId,operation,args});});
}
const api=Object.freeze({
 defineModule(value){if(mode!=='background'||module)throw Error('MODULE_DEFINITION_INVALID');if(!['start','runStep','reconcile','stop'].every(k=>typeof value?.[k]==='function'))throw Error('MODULE_DEFINITION_INVALID');module=value;},
 query:args=>rpc('query',args),action:args=>rpc('action',args),saveView:value=>rpc('saveView',{value}),getView:()=>rpc('getView')
});
addEventListener('message',async event=>{
 if(event.source!==parent)return;
 const m=event.data;if(!m||typeof m!=='object')return;
 if(m.type==='INIT'&&!channel){
  channel=m.channel;mode=m.mode;
  try {
   if(mode==='page'){document.body.innerHTML=m.html;const style=document.createElement('style');style.textContent=m.css;document.head.append(style);}
   new Function('PCMS','"use strict";\n'+m.script)(api);
   if(mode==='background'){if(!module)throw Error('MODULE_DEFINITION_INVALID');await module.start(m.settings??{},api);}
   send({type:'READY'});
  }catch{send({type:'FAILED',code:'MODULE_START_FAILED'});}return;
 }
 if(m.channel!==channel)return;
 if(m.type==='RPC_RESULT'){
  const waiter=pending.get(m.requestId);if(!waiter)return;pending.delete(m.requestId);
  if(m.ok)waiter.resolve(m.result);else waiter.reject(Error(m.code));return;
 }
 if(m.type==='STEP'&&mode==='background'){
  try{const result=await module[m.reconcile?'reconcile':'runStep'](m.job,api);send({type:'STEP_RESULT',callId:m.callId,result});}
  catch{send({type:'STEP_FAILED',callId:m.callId,code:'MODULE_STEP_FAILED'});}return;
 }
 if(m.type==='STOP'){
  try{if(module)await module.stop(api);send({type:'STOPPED',callId:m.callId,receipt:{generation:m.generation,instance:channel,disposedResources:0,unresolvedEffectIds:[]}});}catch{send({type:'STOP_FAILED',callId:m.callId});}
 }
});
