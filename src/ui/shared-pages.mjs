import {rememberPage,restorePage} from './continuity.mjs';
// Shared shell surfaces. Every action goes through the existing packaged Core.
export function sharedPages({core,node,view,persist,document,window=globalThis.window}) {
 async function home(area) {
  const counts=node('div'),attention=node('section'),current=node('section'),visibility=node('a','Directory visibility: Not measured');counts.className='counts';attention.id='home-attention';current.id='home-current';visibility.id='home-directory';visibility.href='#refresher';
  area.append(counts,visibility,attention,current);let signature='';
  const load=async()=>{
   const [r,d]=await Promise.all([core('ui.home'),core('directory.status')]);if(!area.isConnected)return;
   if(d.ok){const v=d.result,c=v.counts;visibility.textContent=v.fresh?'Directory measured · Top 50: '+c.top50+' · Top 100: '+c.top100+' · Full list: '+c.full+' · '+v.size+' displayed':v.state==='NOT_MEASURED'?'Directory visibility: Not measured':'Directory visibility: Unknown · last satisfactory '+(v.observedAt?new Date(v.observedAt).toLocaleString():'Not measured');}
   if(!r.ok){attention.textContent='Work status is unavailable: '+r.code;return;}
   const s=r.result,key=JSON.stringify({...s,sequence:undefined});if(key===signature)return;signature=key;const focus=area.contains(document.activeElement)?rememberPage(document,window):null;counts.replaceChildren();for(const [text,name,path]of [['Accounts','accounts','accounts'],['Generators','generators','generators']]){const a=node('a',s.counts[name]+' '+text);a.dataset.count=name;a.href='#'+path;counts.append(a);}
   const show=(section,title,rows,total)=>{section.replaceChildren(node('h2',title));const list=node('ul');for(const p of rows){const li=node('li'),a=node('a',p.label+' · '+(p.code??p.state)+(p.count>1?' · '+p.count+' jobs':'')+(p.reviewed?' · Reviewed; unresolved':''));a.href=p.href;li.append(a);if(p.signature&&!p.reviewed){const b=node('button','Mark reviewed');b.dataset.review=p.key;b.addEventListener('click',async()=>{b.disabled=true;const r=await core('ui.review',{key:p.key,signature:p.signature,requestId:crypto.randomUUID()});if(!r.ok){li.append(node('p','Review was not saved: '+r.code));b.disabled=false;}else await load();});li.append(b);}list.append(li);}if(!rows.length)list.append(node('li','None.'));const all=node('a','View all'+(total?' ('+total+')':''));all.href='#work';section.append(list,all);};
   show(attention,'Needs attention',s.attention,s.attentionTotal);show(current,'Current work',s.current,s.currentTotal);if(focus)restorePage(focus,document,window);
  };await load();return load;
 }
 async function settings(area) {
  const input=node('input'),label=node('label','Find a setting'),list=node('ul');input.id='settings-search';label.htmlFor=input.id;input.value=view.settingsSearch??'';area.append(label,input,list);
  const draw=()=>{list.replaceChildren();for(const [name,id]of [['Connections','connections'],['Modules','modules'],['Refresher','refresher'],['Journal','journal'],['Backup','backup'],['Advanced','advanced']])if(name.toLowerCase().includes(input.value.toLowerCase())){const li=node('li'),a=node('a',name);a.href='#settings/'+id;li.append(a);list.append(li);}if(!list.children.length)list.append(node('li','No matching settings.'));};
  input.addEventListener('input',()=>{view.settingsSearch=input.value;void persist();draw();});draw();
 }
 async function advanced(area) {
  const r=await core('ui.diagnostics');area.append(node('h2','Advanced'),node('p','Read-only Core status. Account, source and work recovery stays with the affected item.'));
  if(!r.ok){area.append(node('p','Diagnostics unavailable: '+r.code));return;}
  const dl=node('dl');for(const [name,value]of Object.entries(r.result))dl.append(node('dt',name),node('dd',String(value)));const journal=node('a','Open Journal');journal.href='#settings/journal';area.append(dl,journal);
 }
 async function search() {
  const input=document.getElementById('global-search'),form=document.getElementById('global-search-form'),list=document.getElementById('global-results'),next=document.getElementById('global-next'),status=document.getElementById('global-search-status');input.value=view.globalSearch??'';let cursor=view.globalCursor??null,nextCursor=null,serial=0,timer;
  const load=async()=>{const order=++serial;next.disabled=true;status.textContent='Searching…';const r=await core('ui.search',{query:input.value,cursor});if(order!==serial)return;list.replaceChildren();if(!r.ok){if(r.code==='STALE_CURSOR'&&cursor){cursor=null;view.globalCursor=null;void persist();return load();}status.textContent='Search unavailable: '+r.code;return;}for(const p of r.result.rows){const li=node('li'),a=node('a',p.type+' · '+p.label+' · '+p.status);a.href=p.href;li.append(a,node('span',' '+p.detail));list.append(li);}nextCursor=r.result.cursor;next.hidden=!nextCursor;next.disabled=false;status.textContent=input.value?(r.result.rows.length?'Matching accounts, generators, folders and work.':'No matching items.'):'Search accounts, generators, folders and work.';};
  form.addEventListener('submit',e=>{e.preventDefault();clearTimeout(timer);cursor=null;view.globalCursor=null;view.globalSearch=input.value;void persist();void load();});input.addEventListener('input',()=>{clearTimeout(timer);cursor=null;view.globalSearch=input.value;view.globalCursor=null;void persist();timer=setTimeout(()=>void load(),250);});next.addEventListener('click',()=>{cursor=nextCursor;view.globalCursor=cursor;void persist();void load();});if(input.value)await load();
 }
 return {home,settings,advanced,search};
}
