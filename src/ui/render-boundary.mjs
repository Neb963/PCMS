const exceptions={TypeError:'TYPE_ERROR',RangeError:'RANGE_ERROR',InvalidStateError:'INVALID_STATE_ERROR',QuotaExceededError:'QUOTA_EXCEEDED_ERROR',AbortError:'ABORT_ERROR'};
// One page-render boundary, without task/effect authority. A failed renderer
// cannot declare readiness or replace the view from a later navigation.
export async function renderBoundary({mount,area,target,page,isCurrent,node,render,report,retry,reveal=()=>{}}){
 if(!isCurrent())return false;
 mount.setAttribute('aria-busy','true');delete mount.dataset.routeReady;
 let complete=false;
 try{await render();complete=true;return true;}
 catch(error){
  if(isCurrent()){
   mount.dataset.renderError='UI_RENDER_FAILED';
   const alert=node('p','This page could not be displayed. Reload this view; if it persists, export the Journal.'),button=node('button','Reload view');alert.setAttribute('role','alert');button.addEventListener('click',()=>void retry());area.replaceChildren(alert,button);
  }
  try{const r=await report({page,exceptionType:Object.hasOwn(exceptions,error?.name)?exceptions[error.name]:'OTHER_ERROR'});if(r?.ok===false)throw Error('RECORD_UNAVAILABLE');}
  catch{if(isCurrent())area.append(node('p','Diagnostic recording is unavailable. The page is still incomplete.'));}
  return false;
 }finally{
  if(isCurrent()){
   mount.setAttribute('aria-busy','false');
   if(complete){mount.dataset.routeReady=target;delete mount.dataset.renderError;}else delete mount.dataset.routeReady;
   reveal();
  }
 }
}
