// Packaged dashboard host. Supplied UI stays in its opaque iframe.
export async function openModulePage({core,moduleId,pageId,container,onError}) {
 const response=await core('module.open',{id:moduleId,pageId});if(!response.ok)throw Error(response.code);
 const descriptor=response.result,iframe=document.createElement('iframe');iframe.title=descriptor.title;iframe.className='module-frame';iframe.setAttribute('sandbox','allow-scripts');iframe.src=browser.runtime.getURL('host/module-runner.html');
 const channel=descriptor.token;let ready=false,disposed=false;
 const listener=async event=>{
  if(disposed||event.source!==iframe.contentWindow||event.data?.channel!==channel)return;
  const m=event.data;
  if(m.type==='READY'){ready=true;return;}
  if(m.type==='FAILED'){onError('MODULE_START_FAILED');return;}
  if(m.type==='RPC'){
   const response=await core('module.rpc',{token:descriptor.token,message:{operation:m.operation,args:m.args,requestId:m.requestId}});
   if(!disposed)iframe.contentWindow.postMessage({channel,type:'RPC_RESULT',requestId:m.requestId,...response},'*');
  }
 };
 window.addEventListener('message',listener);
 iframe.onload=()=>iframe.contentWindow.postMessage({type:'INIT',channel,mode:'page',script:descriptor.script,html:descriptor.html,css:descriptor.css},'*');container.append(iframe);
 const timeout=setTimeout(()=>{if(!ready&&!disposed)onError('MODULE_START_TIMEOUT');},10000);
 return ()=>{disposed=true;clearTimeout(timeout);window.removeEventListener('message',listener);iframe.remove();};
}
