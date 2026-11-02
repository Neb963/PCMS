// Short local UI fence for retiring only an extension-owned, clean worker.
// No source, undo, chat or save state is changed. A failed operation releases it.
export function refreshEditorFence({action,operationId}) {
 const w=window,key='__PCMS_REFRESH_RETIRE_1',old=w[key];
 if(action==='RELEASE'){if(old?.operationId===operationId){old.release();delete w[key];}return {ok:true};}
 if(old)return {ok:old.operationId===operationId};
 const editors=[w.modelTextEditor,w.outputTemplateEditor];
 if(editors.some(e=>typeof e?.getDoc!=='function'||typeof e.setOption!=='function'||typeof e.getOption!=='function'||!e.isClean?.())||w.__saveInFlight!==false)return {ok:false};
 const options=editors.map(e=>[e,e.getOption('readOnly')]),stop=e=>{if(e.isTrusted){e.preventDefault();e.stopImmediatePropagation();}};
 for(const [e]of options)e.setOption('readOnly','nocursor');
 const names=['beforeinput','drop','paste','click','keydown'];for(const n of names)document.addEventListener(n,stop,true);
 const release=()=>{for(const [e,v]of options)e.setOption('readOnly',v);for(const n of names)document.removeEventListener(n,stop,true);};
 w[key]={operationId,release};return {ok:true};
}
