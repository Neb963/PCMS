import {openModulePage} from './module-page.mjs';
const titles = {home:'Home',generators:'Generators',accounts:'Accounts',refresher:'Refresher',work:'Work',other:'Other',settings:'Settings'};
const notes = {
  home:'Account and generator operations are not implemented yet.',
  generators:'Generator management is not implemented yet.', accounts:'Account management is not implemented yet.',
  refresher:'Refresher is not implemented yet.', work:'Work is kept when this dashboard closes.',
  other:'No module pages are installed.', settings:'Module and connection settings are not implemented yet.'
};
const messages = {
  DONOR_STARTING:'PersonaMonkey is starting. Protected work stays blocked.',
  CLEAN_PROFILE_REQUIRED:'Use a dedicated clean Firefox profile. Existing PersonaMonkey data was not adopted.',
  DONOR_BOOTSTRAP_FAILED:'PersonaMonkey could not start. Restart this clean profile. Work stays blocked.',
  DONOR_SECURITY_UNAVAILABLE:'Firefox privacy or proxy control is unavailable. Check this profile’s extension permissions.',
  BRIDGE_MISSING:'The PersonaMonkey route bridge is not available. Use the existing bridge setup before account work.',
  BRIDGE_UNKNOWN:'The route bridge did not return a status. Work stays blocked.',
  BRIDGE_INCOMPATIBLE:'The route bridge is incompatible. Check the existing bridge installation.',
  USERSCRIPTS_PERMISSION_REQUIRED:'Firefox has not granted the userscript permission. Module setup will provide that action.',
  HOST_ONLY:'The host is available. Account and provider work are not implemented in this build.',
  STATUS_UNAVAILABLE:'Startup status is unavailable. Restart the clean profile to check again.'
};
function route() {
  const primary=location.hash.slice(1).split('/')[0];
  const key=primary==='module'?'module':primary in titles?primary:'home';
  document.getElementById('heading').textContent = titles[key]??'Module';
  document.getElementById('page-note').textContent = notes[key]??'';
  void renderRecords(key);
  for (const link of document.querySelectorAll('nav a')) {
    if (link.hash === '#'+key) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }
}
function show(status) {
  document.getElementById('status').textContent = messages[status.code] || messages.STATUS_UNAVAILABLE;
  document.body.dataset.startup = status.code;
  const list = document.getElementById('details'); list.replaceChildren();
  for (const [label,value] of [['Admission',status.admission],['Startup code',status.code],['Donor ready',status.donorReady],['Privacy safe',status.privacySafe],['Bridge',status.bridge],['Userscript permission',status.userScriptsPermission],['Shell error',status.shellFailure || 'None']]) {
    const dt=document.createElement('dt'),dd=document.createElement('dd');
    dt.textContent=label; dd.textContent=String(value ?? 'Unknown'); list.append(dt,dd);
  }
}
window.addEventListener('hashchange',route);
let received=false;
const port=browser.runtime.connect({name:'pcms-host-status'});
const timeout=setTimeout(()=>{if(!received)show({code:'STATUS_UNAVAILABLE',admission:'BLOCKED'});port.disconnect();},12000);
port.onMessage.addListener(status=>{received=true;clearTimeout(timeout);show(status);port.disconnect();});
port.onDisconnect.addListener(()=>{clearTimeout(timeout);if(!received)show({code:'STATUS_UNAVAILABLE',admission:'BLOCKED'});});

let disposeModule=null;
let view={journalFilter:'',route:'home',scroll:0,workSearch:'',workState:''},pageCursor=null,nextCursor=null;
let corePort=null;const requests=new Map();
function connection(){if(corePort)return corePort;const port=browser.runtime.connect({name:'pcms-core-rpc'});corePort=port;
 port.onMessage.addListener(({rpcId,response})=>{const request=requests.get(rpcId);if(request){requests.delete(rpcId);request(response);}});
 port.onDisconnect.addListener(()=>{if(corePort===port)corePort=null;for(const resolve of requests.values())resolve({ok:false,code:'CORE_UNAVAILABLE'});requests.clear();});return port;}
const core=(operation,extra={})=>new Promise(resolve=>{const rpcId=crypto.randomUUID();requests.set(rpcId,resolve);try{connection().postMessage({channel:'pcms-core',rpcId,operation,...extra});}catch{requests.delete(rpcId);resolve({ok:false,code:'CORE_UNAVAILABLE'});}});
const errors={STORAGE_FULL:'Storage is full. Free space, then save again. Earlier data is kept.',STORAGE_UNAVAILABLE:'Storage is unavailable. Restart Firefox and check available space. Earlier data is kept.',TRANSACTION_ABORTED:'The save did not complete. Try again. Earlier data is kept.'};
function node(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
function failure(code){const n=node('p',errors[code]||'Core records are unavailable. Restart Firefox to check again.');n.setAttribute('role','alert');n.dataset.code=code;return n;}
async function persist(){
  view.route=location.hash.slice(1)||'home';view.scroll=window.scrollY;
  const result=await core('view.save',{value:view,requestId:crypto.randomUUID()});
  return result;
}
async function renderRecords(key){
 void queueStatus();
 const area=document.getElementById('records');if(disposeModule){disposeModule();disposeModule=null;}area.replaceChildren();
 if(key==='module'){await renderModule(area);return;}
 if(key==='other'){await renderOther(area);return;}
 if(key==='home'){
   const response=await core('counts');if(location.hash.slice(1)&&location.hash!=='#home')return;
   if(!response.ok){area.append(failure(response.code));return;}
   const counts=node('div');counts.className='counts';
   for(const [label,field,route] of [['Accounts','accounts','accounts'],['Generators','generators','generators'],['Jobs','jobs','work']]){const a=node('a',response.result[field]+' '+label);a.href='#'+route;a.dataset.count=field;counts.append(a);}
   area.append(counts,node('p','Directory visibility: Not measured'));
 }else if(key==='work'){await renderWork(area);
 }else if(key==='settings'){
   if(location.hash.split('/')[1]==='modules'){await renderModuleSettings(area);return;}
   const modulesLink=node('a','Modules');modulesLink.href='#settings/modules';area.append(modulesLink);
   const title=node('h2','Journal'),label=node('label','Filter recorded work'),input=node('input');input.id='journal-filter';input.value=view.journalFilter;label.htmlFor=input.id;
   const save=node('button','Save view');save.id='save-view';save.type='button';
   const progress=node('p');progress.id='view-result';progress.setAttribute('role','status');
   const list=node('ol');list.id='journal-events';const next=node('button','Next');next.id='next-events';next.type='button';
   const load=async()=>{const response=await core('events',{cursor:pageCursor,search:view.journalFilter});list.replaceChildren();if(!response.ok){list.append(failure(response.code));next.hidden=true;return;}nextCursor=response.result.cursor;next.hidden=!nextCursor;for(const event of response.result.rows){const text=[event.sequence,event.step,event.result,event.code,event.targetId].filter(Boolean).join(' · ');list.append(node('li',text));}};
   input.addEventListener('input',()=>{view.journalFilter=input.value;pageCursor=null;void load();});
   save.addEventListener('click',async()=>{save.disabled=true;progress.textContent='Saving…';const response=await persist();progress.replaceChildren(response.ok?node('span','Saved'):failure(response.code));save.disabled=false;if(response.ok)await load();});
   next.addEventListener('click',()=>{pageCursor=nextCursor;void load();});
   area.append(title,label,input,save,progress,list,next);await load();
 }
}
const initial=await core('view.get');
if(initial.ok&&initial.result){view=initial.result;if(!location.hash)location.hash='#'+view.route;}
await updateModuleNavigation();route();

async function queueStatus(){
 const response=await core('queue.status'),status=document.getElementById('queue-status'),button=document.getElementById('pause-core');
 status.textContent=response.ok?({RUNNING:'Running',PAUSED:'Paused',PAUSING:'Pausing',BLOCKED:'Work blocked'}[response.result.state]||'Unknown'):'Work status unknown';
 if(response.ok){button.hidden=false;button.textContent=response.result.paused?'Resume PCMS':'Pause PCMS';button.dataset.operation=response.result.paused?'queue.resume':'queue.pause';}
}
document.getElementById('pause-core').addEventListener('click',async event=>{
 const button=event.currentTarget;button.disabled=true;
 const response=await core(button.dataset.operation,{requestId:crypto.randomUUID()});button.disabled=false;
 if(!response.ok){document.getElementById('queue-status').replaceChildren(failure(response.code));return;}
 await queueStatus();if(location.hash.startsWith('#work'))await renderRecords('work');
});
async function renderWork(area){
 const id=location.hash.slice(1).split('/')[1];
 if(id){
  const response=await core('queue.get',{id});if(!response.ok){area.append(failure(response.code));return;}
  const job=response.result;if(!job){area.append(node('p','This job is unavailable.'));return;}
  const back=node('a','All work');back.href='#work';area.append(back,node('h2',job.kind+' · '+job.targetId));
  area.append(node('p',(job.recovery?.code==='OUTCOME_UNKNOWN'?'Unknown':job.state)+' · '+job.step));
  const details=node('dl');for(const [label,value] of [['Job',job.id],['Target',job.targetId],['Account',job.accountId||'None'],['Module',job.moduleId],['Recovery',job.recovery?.code||'None']])details.append(node('dt',label),node('dd',value));area.append(details);
  if(job.effect?.boundary==='POSSIBLE')area.append(node('p','The result needs readback. This operation will not run again while its result is unknown.'));
  if(job.batchId){const batch=await core('queue.batch',{id:job.batchId});if(batch.ok)area.append(node('p',Object.entries(batch.result).map(([k,v])=>v+' '+k).join(' · ')));}
  return;
 }
 const label=node('label','Find work'),input=node('input');input.id='work-search';input.value=view.workSearch??'';label.htmlFor=input.id;
 const select=node('select');select.id='work-state';select.setAttribute('aria-label','Work status');for(const [value,text] of [['','All work'],['HELD','Needs action'],['RUNNING','In progress'],['WAITING','Waiting'],['COMPLETE','Completed'],['FAILED','Failed']]){const option=node('option',text);option.value=value;select.append(option);}select.value=view.workState??'';
 const list=node('ul');list.id='work-list';const next=node('button','Next');next.type='button';let cursor=null,nextPage=null;
 const load=async()=>{const response=await core('queue.list',{cursor,search:view.workSearch??'',state:view.workState??''});list.replaceChildren();if(!response.ok){list.append(failure(response.code));return;}nextPage=response.result.cursor;next.hidden=!nextPage;
  for(const job of response.result.rows){const li=node('li'),a=node('a',job.kind+' · '+job.targetId+' · '+(job.recovery?.code==='OUTCOME_UNKNOWN'?'Unknown':job.state));a.href='#work/'+job.id;li.append(a);list.append(li);}if(!response.result.rows.length)list.append(node('li','No matching work.'));
 };
 input.addEventListener('input',()=>{view.workSearch=input.value;cursor=null;void persist();void load();});select.addEventListener('change',()=>{view.workState=select.value;cursor=null;void persist();void load();});
 next.addEventListener('click',()=>{cursor=nextPage;void load();});area.append(label,input,select,list,next);await load();
}

async function moduleRecords(){const response=await core('modules.list');return response.ok?response.result:[];}
const moduleURL=m=>'#module/'+m.id+'/'+m.pages[0].id;
async function updateModuleNavigation(){
 for(const link of document.querySelectorAll('[data-pinned-module]'))link.remove();
 const settings=document.querySelector('nav a[href="#settings"]');for(const module of await moduleRecords())if(module.enabled&&module.pinned&&module.pages.length){const a=node('a',module.name??module.id);a.href=moduleURL(module);a.dataset.pinnedModule=module.id;settings.before(a);}
}
async function renderOther(area){
 const modules=(await moduleRecords()).filter(m=>m.enabled&&!m.pinned&&m.pages.length),label=node('label','Find a module'),input=node('input'),list=node('ul');label.htmlFor='module-search';input.id='module-search';
 const draw=()=>{list.replaceChildren();for(const m of modules.filter(m=>(m.name??m.id).toLowerCase().includes(input.value.toLowerCase()))){const li=node('li'),a=node('a',m.name??m.id);a.href=moduleURL(m);li.append(a);list.append(li);}if(!list.children.length)list.append(node('li','No matching modules.'));};input.addEventListener('input',draw);area.append(label,input,list);draw();
}
async function renderModuleSettings(area){
 area.append(node('h2','Modules'));const selected=location.hash.split('/')[2];
 for(const module of await moduleRecords())if(!selected||selected===module.id){const section=node('section'),title=node('h3',module.name??module.id);section.append(title,node('p',(module.version??'Unknown version')+' · '+(module.enabled?'Enabled':'Disabled')));
  if(module.enabled&&module.pages.length){const label=node('label'),check=node('input');check.type='checkbox';check.checked=module.pinned;check.className='module-pin';check.dataset.module=module.id;label.append(check,document.createTextNode(' Show in primary navigation'));check.addEventListener('change',async()=>{const result=await core('module.pin',{id:module.id,pinned:check.checked});if(result.ok)await updateModuleNavigation();else{check.checked=!check.checked;section.append(failure(result.code));}});section.append(label);}
  area.append(section);
 }
}
async function renderModule(area){
 const [,moduleId,requestedPage]=location.hash.slice(1).split('/'),module=(await moduleRecords()).find(m=>m.id===moduleId),pageId=requestedPage??module?.pages[0]?.id;
 const error=()=>{area.replaceChildren(node('p','This module page could not open.'));const link=node('a','Open Modules');link.href='#settings/modules/'+moduleId;area.append(link);};
 if(!module?.enabled||!pageId){error();return;}
 document.getElementById('heading').textContent=module.name??moduleId;
 if(module.pages.length>1){const menu=node('div');menu.setAttribute('role','navigation');menu.setAttribute('aria-label',module.name+' pages');for(const page of module.pages){const a=node('a',page.title);a.href='#module/'+moduleId+'/'+page.id;menu.append(a,document.createTextNode(' '));}area.append(menu);}
 const container=node('div');area.append(container);
 try{disposeModule=await openModulePage({core,moduleId,pageId,container,onError:error});}catch{error();}
}
