// Fixed, read-only DOM recipe. Native loading/count/paging declarations are
// required; unknown layouts never become a complete or empty measurement.
export async function renderedDirectory(operation={}){
 const bad=(code,loading=false)=>({ok:false,code,loading}),u=new URL(location.href);
 if(u.protocol!=='https:'||u.pathname!=='/generators'||!(/^(?:[a-f0-9]{32}\.)?perchance\.org$/.test(u.hostname))||u.hash.startsWith('#edit'))return bad('DIRECTORY_TARGET_CHANGED');
 const marker=Symbol.for('pcms.directory.document.1');if(!globalThis[marker])Object.defineProperty(globalThis,marker,{value:{id:crypto.randomUUID(),receipts:new Map()},writable:false,configurable:false});const state=globalThis[marker];
 const visible=e=>{for(let n=e;n&&n.nodeType===1;n=n.parentElement){const s=getComputedStyle(n);if(n.hidden||n.getAttribute('aria-hidden')==='true'||s.display==='none'||s.visibility==='hidden')return false;}return e.getClientRects().length>0;};
 const sample=()=>{
  if(/^(?:just a moment|checking your browser|access denied)/i.test(document.title)||document.querySelector('#challenge-form,#cf-challenge-running'))return {packet:bad('DIRECTORY_CHALLENGE')};
  const roots=[...new Set(document.querySelectorAll('#generatorList,#generatorsList,#generators-list,[data-generator-directory],[aria-label="Recently updated generators"],[aria-label="Recently Updated Generators"]'))].filter(visible);
  if(roots.length!==1)return {packet:bad(roots.length?'DIRECTORY_LAYOUT_AMBIGUOUS':'DIRECTORY_LAYOUT_UNKNOWN',document.readyState!=='complete')};
  const root=roots[0],selector='[data-generator-name],[data-generator],.generator-card,.generator-item,[role="listitem"],li',all=[...root.querySelectorAll(selector)].filter(e=>visible(e)&&!e.parentElement?.closest(selector)?.matches(selector));
  // Only outer rows under the selected list are candidates. Navigation,
  // comments, thumbnails and repeated title links are never extra entries.
  const rows=[...root.querySelectorAll(selector)].filter(e=>visible(e)&&![...root.querySelectorAll(selector)].some(p=>p!==e&&p.contains(e))),entries=[],sizes=new Set();
  const slug=href=>{try{const x=new URL(href,location.href);return x.protocol==='https:'&&x.hostname==='perchance.org'&&!x.search&&!x.hash&&/^\/[a-z0-9][a-z0-9-]{0,99}$/.test(x.pathname)&&!['generators','plugins','templates','resources','login','settings','search'].includes(x.pathname.slice(1))?x.href:null;}catch{return null;}};
  for(let i=0;i<rows.length;i++){const row=rows[i],primary=[...row.querySelectorAll('a[data-generator-link],a.generator-link,.generator-title a,h2 a,h3 a')],links=(primary.length?primary:[...row.querySelectorAll('a[href]')]).map(a=>slug(a.href)).filter(Boolean),unique=[...new Set(links)];if(unique.length!==1)return {packet:bad('DIRECTORY_ROW_UNVERIFIED')};const declared=row.getAttribute('data-generator-name')??row.getAttribute('data-generator');if(declared&&new URL(unique[0]).pathname.slice(1)!==declared)return {packet:bad('DIRECTORY_ROW_CHANGED')};const setsize=row.getAttribute('aria-setsize');if(setsize!==null)sizes.add(Number(setsize));entries.push({href:unique[0],position:Number(row.getAttribute('aria-posinset')??i+1),pinned:row.getAttribute('data-pinned')==='true'||row.classList.contains('pinned')});}
  const totalText=root.getAttribute('data-total-displayed')??root.getAttribute('aria-rowcount'),total=totalText!==null?Number(totalText):sizes.size===1?[...sizes][0]:NaN;
  if(!Number.isSafeInteger(total)||total<0||entries.some(e=>!Number.isSafeInteger(e.position)||e.position<1||e.position>total))return {packet:bad('DIRECTORY_COMPLETION_UNVERIFIED')};
  const scope=root.parentElement??root,controls={};
  for(const [name,sel]of [['FIRST','button[aria-label="First page"],a[rel="first"]'],['NEXT','button[aria-label="Next page"],a[rel="next"]'],['MORE','button[aria-label="Load more generators"],button[data-directory-more]']]){const matches=[...scope.querySelectorAll(sel)].filter(e=>visible(e)&&!e.disabled&&e.getAttribute('aria-disabled')!=='true'&&(!e.getAttribute('aria-controls')||e.getAttribute('aria-controls')===root.id));if(matches.length>1)return {packet:bad('DIRECTORY_PAGER_AMBIGUOUS')};controls[name]=matches[0]??null;}
  const busy=root.getAttribute('aria-busy'),loading=busy==='true'||[...scope.querySelectorAll('[data-directory-loading],[role="progressbar"]')].some(visible),loaded=busy==='false'&&!loading;
  const filterContext=[...scope.querySelectorAll('[data-directory-filter],select[aria-controls],input[type="search"][aria-controls]')].map(e=>({name:e.name||e.id||e.getAttribute('aria-label')||e.tagName,value:e.type==='checkbox'?e.checked:e.value??null}));
  const revision=root.getAttribute('data-revision')??root.getAttribute('data-snapshot-id')??null,context=JSON.stringify([state.id,revision,filterContext,u.search]),signature=JSON.stringify([context,total,entries,root.scrollTop,!!controls.NEXT,!!controls.MORE]);
  const packet={ok:true,source:'PERCHANCE_RENDERED_DIRECTORY_1',url:location.href,context,revision,total,entries,loaded,filterContext,canFirst:!!controls.FIRST,canNext:!!controls.NEXT,canMore:!!controls.MORE,canScroll:root.scrollHeight>root.clientHeight&&root.scrollTop+root.clientHeight<root.scrollHeight-1,signature,observedAt:Date.now(),documentId:state.id};
  return {packet,controls,root};
 };
 if(operation.action&&operation.action!=='READ'){
  const prior=state.receipts.get(operation.operationId);if(prior)return prior;
  if(operation.reconcile)return bad('DIRECTORY_ADVANCE_UNKNOWN');
  const before=sample();if(!before.packet.ok)return before.packet;if(before.packet.signature!==operation.signature)return {ok:false,code:'DIRECTORY_CHANGED_BEFORE_ADVANCE',noDispatch:true};
  const receipt={ok:false,code:'DIRECTORY_ADVANCE_PENDING',loading:true};state.receipts.set(operation.operationId,receipt);
  if(operation.action==='SCROLL'){if(!before.packet.canScroll){state.receipts.delete(operation.operationId);return {ok:false,code:'DIRECTORY_NO_SCROLL',noDispatch:true};}before.root.scrollTop=Math.min(before.root.scrollHeight,before.root.scrollTop+Math.max(1,before.root.clientHeight));}
  else{const button=before.controls[operation.action];if(!button){state.receipts.delete(operation.operationId);return {ok:false,code:'DIRECTORY_PAGER_CHANGED',noDispatch:true};}button.click();}
  const done={ok:true,advanced:true,documentId:state.id,operationId:operation.operationId};state.receipts.set(operation.operationId,done);return done;
 }
 let one=sample();if(!one.packet.ok)return one.packet;if(!one.packet.loaded)return { ...one.packet,ok:false,code:'DIRECTORY_LOADING',loading:true };
 await new Promise(resolve=>setTimeout(resolve,250));const two=sample();if(!two.packet.ok)return two.packet;if(one.packet.signature!==two.packet.signature||!two.packet.loaded)return bad('DIRECTORY_UNSETTLED',true);return two.packet;
}
