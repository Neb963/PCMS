// Packaged isolated-world editor chrome. No authority token or source content.
(()=>{
 if(window.__PCMS_FINISH_CONTROL_1)return;window.__PCMS_FINISH_CONTROL_1=true;
 let root=null,button=null,checkbox=null,status=null,busy=false,refreshing=false,context=null,stopped=false;
 const remove=()=>{root?.remove();root=button=checkbox=status=null;context=null;};const dispose=()=>{stopped=true;clearInterval(timer);remove();delete window.__PCMS_FINISH_CONTROL_1;};
 const rpc=async(operation,extra={})=>browser.runtime.sendMessage({channel:'pcms-editor',operation,...extra});
 async function refresh(){if(stopped||busy||refreshing)return;refreshing=true;if(location.origin!=='https://perchance.org'||location.hash!=='#edit'){dispose();return;}
  try{const r=await rpc('editor.context');if(!r?.ok||!r.result?.available){dispose();return;}context=r.result;
   if(!root){root=document.createElement('aside');root.id='pcms-editor-finish';root.setAttribute('aria-label','PCMS completion');root.style.cssText='position:fixed;top:12px;right:12px;z-index:2147483647;padding:12px;background:#182331;color:white;border:2px solid #91caff;border-radius:8px;font:14px sans-serif;max-width:360px';
    const title=document.createElement('strong');title.textContent='PCMS';const label=document.createElement('label');checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.id='pcms-finish-ready';label.append(checkbox,document.createTextNode(' I inspected this same chat. The result is ready to review and accept; native AI success is Unknown.'));
    button=document.createElement('button');button.id='pcms-finish-publish';button.textContent='Finish and publish';status=document.createElement('p');status.id='pcms-finish-state';status.setAttribute('role','status');root.append(title,label,button,status);document.body.appendChild(root);
    button.addEventListener('click',async event=>{if(!event.isTrusted||busy||!context)return;if(context.needsAttestation&&!checkbox.checked){status.textContent='Confirm that this same result is ready to review and accept.';return;}busy=true;button.disabled=true;status.textContent='Capturing the exact reviewed source…';let r;try{r=await rpc('editor.finish',{jobId:context.jobId,confirmReady:checkbox.checked});}catch{r={ok:false,code:'ACCEPTANCE_RESPONSE_UNKNOWN'};}busy=false;if(!root)return;status.textContent=r?.ok?r.result.message??r.result.state:r?.code??'Completion could not be recorded.';button.disabled=false;await refresh();});
   }
   checkbox.parentElement.hidden=!context.needsAttestation;checkbox.disabled=!!context.accepted;button.disabled=!!context.accepted;status.textContent=context.message;
  }catch{dispose();}finally{refreshing=false;}
 }
 window.addEventListener('pagehide',dispose,{once:true});const timer=setInterval(()=>void refresh(),1000);void refresh();
})();
