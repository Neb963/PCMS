"""P36 B: packaged protected observer, real lazy DOM, durable Unknown/restart.
All HTTPS/native/SOCKS services are disposable fixtures, never live providers.
"""
from installed_refresh_clock import state,page,clock_cut,pause,settings_clock
from installed_source_save import Provider as SourceProvider,configure,editor,dashboard,stored,SLUG
from installed_source import completed_source
from installed_accounts import add,settle,login,account,account_session
from installed_lifecycle import permission_choice
from installed_backup_sessions import manage
from installed_journal import close_dashboard
from installed_packages import *
from account_fixture import Fixture
import account_fixture
FRAME='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.perchance.org'
ORDER=['pinned-other',SLUG]+['other-%03d'%i for i in range(1,59)]+['owned-middle']+['other-%03d'%i for i in range(59,109)]+['owned-tail']+['last-%03d'%i for i in range(13)]+[SLUG]
assert len(ORDER)==126 and ORDER.index('owned-middle')==60 and ORDER.index('owned-tail')==111
class Provider(SourceProvider):
 def do_GET(self):
  f=self.server.fixture;host=self.headers.get('Host','').split(':')[0]
  if host=='perchance.org' and self.path=='/generators':
   return self.send(('<!doctype html><title>Native directory</title><a href="/owned-absent">Unrelated navigation</a><iframe title="Recently updated" src="https://'+FRAME+'/generators"></iframe>').encode(),'text/html')
  if host==FRAME and self.path=='/generators':
   js=r"""
let visible=40,last='',mode='',revision='fixture-filtered-1';const inventory=['owned-absent','filter-excluded',...ORDER];let items=inventory.filter(s=>!['owned-absent','filter-excluded'].includes(s));
const root=document.getElementById('generatorList'),more=document.getElementById('more');
function draw(){
 root.setAttribute('aria-busy',mode==='complete'?'false':'true');root.setAttribute('data-revision',revision);root.setAttribute('data-total-displayed',String(items.length));root.replaceChildren();
 for(let i=0;i<Math.min(visible,items.length);i++){const li=document.createElement('li');li.setAttribute('aria-posinset',String(i+1));li.setAttribute('aria-setsize',String(items.length));li.setAttribute('data-generator-name',items[i]);if(i<2)li.setAttribute('data-pinned','true');const h=document.createElement('h2'),link=document.createElement('a'),again=document.createElement('a');link.href='https://perchance.org/'+items[i];link.textContent=items[i];again.href=link.href;again.textContent='thumbnail';h.append(link,again);li.append(h);root.append(li);}
 more.hidden=visible>=items.length;
}
document.getElementById('native-filter').addEventListener('change',e=>{items=e.target.value==='all'?inventory:inventory.filter(s=>!['owned-absent','filter-excluded'].includes(s));visible=40;draw();});
more.addEventListener('click',()=>{visible+=40;fetch('/fixture/directory-advance',{method:'POST',body:JSON.stringify({visible})});draw();});
async function update(){try{const data=await (await fetch('/fixture/directory-state')).json();if(data.mode!==mode){mode=data.mode;draw();}}finally{setTimeout(update,500);}}
draw();update();
""".replace('ORDER',json.dumps(ORDER))
   return self.send(('<!doctype html><title>Rendered directory fixture</title><nav><a href="https://perchance.org/owned-absent">Navigation decoy</a></nav><label>Native filter<select id="native-filter" data-directory-filter name="listing"><option value="public">public</option><option value="all">all</option></select></label><ul id="generatorList" aria-busy="true"></ul><button id="more" aria-label="Load more generators" aria-controls="generatorList">Load more</button><script>'+js+'</script>').encode(),'text/html')
  if host==FRAME and self.path=='/fixture/directory-state':
   with f.lock:f.directory_reads.append({'route':self.route,'mode':f.directory_mode});return self.send({'mode':f.directory_mode})
  return super().do_GET()
 def do_POST(self):
  if self.path=='/fixture/directory-advance':
   with self.server.fixture.lock:self.server.fixture.directory_advances.append(self.body())
   return self.send({'ok':True})
  return super().do_POST()
account_fixture.Provider=Provider
def visibility(sid):return state(sid)['visibility']
def directory_cut(sid):
 return asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),v=await c.view('refresher-directory');c.close();return v;")
def measured(sid):
 v=visibility(sid);return v if v['fresh'] and v['size']==125 else None
def check(sid):
 page(sid);wait(lambda:script(sid,"return !document.getElementById('directory-check').disabled"));click(sid,'#directory-check')
def observer_tabs(sid):
 return asyncjs(sid,"const out=[];for(const t of await browser.tabs.query({})){const tag=await browser.sessions.getTabValue(t.id,'pcmsDirectory');if(tag)out.push({id:t.id,tag,url:t.url,container:t.cookieStoreId});}return out;")


def native_filter(sid,value):
 page(sid);click(sid,'#directory-open')
 selected=None
 for handle in call('GET',f'/session/{sid}/window/handles'):
  call('POST',f'/session/{sid}/window',{'handle':handle})
  if script(sid,"return location.href")=='https://perchance.org/generators':selected=handle;break
 assert selected,'DIRECTORY_VISIBLE_CONTROL_DID_NOT_FOCUS_OBSERVER'
 frame=call('POST',f'/session/{sid}/element',{'using':'css selector','value':'iframe'})['element-6066-11e4-a52e-4f735466cecf'];call('POST',f'/session/{sid}/frame',{'id':{'element-6066-11e4-a52e-4f735466cecf':frame}})
 click(sid,'#native-filter option[value="'+value+'"]');assert script(sid,"return document.getElementById('native-filter').value")==value
 call('POST',f'/session/{sid}/frame',{'id':None});dashboard(sid);page(sid);check(sid)

def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve();identity=json.loads((xpi.parent/'identity.json').read_text());assert not identity['dirty'];assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k);receipt={'tier':'B/P36/rendered-directory','source':identity['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]};assert receipt['xpiSha256']==identity['xpiSha256']
 with tempfile.TemporaryDirectory(prefix='pcms-p36-') as tmp:
  root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();home=root/'home';home.mkdir();provider=Fixture(root,extra_hosts=['user.uploads.dev',FRAME]);expected=configure(provider);provider.directory_mode='complete';provider.directory_reads=[];provider.directory_advances=[];provider.generator['isPrivate']=False;original=json.loads(json.dumps(provider.generator));provider.start_catalog();provider.install_bridge(home,root);env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'};log=open(OUT/'driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None
  try:
   wait(driver_ready,15);sid,caps=account_session(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'));assert int(caps['browserVersion'].split('.')[0])>=155 and caps['acceptInsecureCerts'] is False;context(sid,'chrome');script(sid,"Components.classes['@mozilla.org/security/x509certdb;1'].getService(Components.interfaces.nsIX509CertDB).addCertFromBase64(arguments[0],'C,,');return true;",[base64.b64encode(provider.ca).decode()]);prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];receipt['sandbox']=prefs;context(sid,'content');assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid);settings(sid);wait(lambda:script(sid,"return !!document.getElementById('allow-userscripts')"));click(sid,'#allow-userscripts');permission_choice(sid,True);wait(lambda:script(sid,"return !document.getElementById('allow-userscripts')"));initial=state(sid);assert initial['settings']['activeHours']==24 and initial['settings']['sleepHours']==72
   owner=add(sid,'Clock owner');settle(sid,owner,'LOGIN_REQUIRED');login(sid,owner,'source@fixture.test');click(sid,'#account-confirm');settle(sid,owner,'READY');settings_clock(sid,1/120,1/60);asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),a=await c.read('accounts',arguments[0]);await c.mutate([{table:'generators',id:'existing-sentinel',value:{slug:'existing-sentinel',remoteId:'public_source-stable-18',accountId:a.id,ownerPrincipal:a.expectedPrincipal,creatorState:'OWNED',listing:'PUBLIC',state:'OWNED'}}],{step:'FIXTURE_PREVIOUS_OWNED',result:'COMPLETE'});c.close();location.hash='#generators/existing-sentinel';return true;",[owner]);wait(lambda:script(sid,"return !!document.getElementById('source-open')&&!document.getElementById('source-open').disabled"));click(sid,'#source-open');editor_handle=editor(sid);dashboard(sid);script(sid,"location.hash='#generators/existing-sentinel'");wait(lambda:script(sid,"return !!document.getElementById('source-inspect')&&!document.getElementById('source-inspect').disabled"));click(sid,'#source-inspect');source=wait(lambda:completed_source(sid),90);assert source['generator']['sourceState']=='VERIFIED' and source['generator']['listing']=='PUBLIC';assert {p:base64.b64decode(v) for p,v in source['bytes'].items()}==expected
   asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),g=await c.read('generators','existing-sentinel');await c.mutate([{table:'generators',id:g.id,expectedRev:g.rev,refs:g.refs,value:{...g,poolMember:true,pool:{schema:1,member:true,sourceManifest:g.sourceManifest,addedAt:Date.now()},refreshCycle:{schema:1,cycleId:crypto.randomUUID(),phase:'PENDING',activeUsedMs:0}}}],{step:'FIXTURE_QUALIFIED_P22_POOL',result:'COMPLETE'});c.close();return true;");page(sid)
   # Three confirmed owned records outside the Active pool still count.
   asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),a=await c.read('accounts',arguments[0]);await c.mutate(['owned-middle','owned-tail','owned-absent'].map(slug=>({table:'generators',id:slug,value:{slug,accountId:a.id,remoteId:'public_'+slug,ownerPrincipal:a.expectedPrincipal,creatorState:'OWNED',listing:'PUBLIC'}})),{step:'FIXTURE_CONFIRMED_OWNED',result:'COMPLETE'});c.close();return true;",[owner])
   check(sid);click(sid,'#directory-check');v=wait(lambda:measured(sid),100);assert v['counts']=={'top50':1,'top100':2,'full':3},v
   assert v['positions'][SLUG]['position']==2 and v['positions']['owned-middle']['position']==61 and v['positions']['owned-tail']['position']==112 and v['positions']['owned-absent']['state']=='NOT_SEEN',v
   assert v['filterContext']==[{'name':'listing','value':'public'}];assert len(observer_tabs(sid))==1 and provider.directory_advances==[{'visible':80},{'visible':120},{'visible':160}],provider.directory_advances
   wait(lambda:'125 displayed' in script(sid,"return document.getElementById('directory-summary').textContent"));click(sid,'nav a[href="#home"]');wait(lambda:'Top 50: 1' in script(sid,"return (document.getElementById('home-directory')?.textContent??'')"))
   assert state(sid)['counts']['pool']==1 and provider.save_requests==[] and provider.uploads==[] and provider.generator==original
   receipt['checks'].append('actual-protected-required-iframe/one-owned-observer/native-lazy-More-clicks-once/independent-125-order/pins-first-duplicate/navigation-exclusion/all-owned-three-band-counts-distinct-from-one-pool/Home-UI')
   page(sid);cut=directory_cut(sid);assert cut['lastGood']['displayedSlugs']==ORDER[:-1] and cut['lastGood']['renderedRows']==126
   native_filter(sid,'all');all_v=wait(lambda:visibility(sid) if visibility(sid)['fresh'] and visibility(sid)['size']==127 else None,100);assert all_v['counts']=={'top50':2,'top100':3,'full':4} and all_v['positions']['owned-absent']['position']==1 and all_v['positions'][SLUG]['position']==4,all_v
   native_filter(sid,'public');wait(lambda:measured(sid),100);assert len(observer_tabs(sid))==1;assert provider.directory_advances==[{'visible':80},{'visible':120},{'visible':160}]*3,provider.directory_advances
   receipt['checks'].append('actual-Open-protected-directory-handler/native-select-filter-changes-complete-order/127-versus125/independent-three-band-counts2-3-4-versus1-2-3/filtered-owned-absence/one-observer-retained')
   # Real native loading failure cannot turn any row into confirmed absence.
   provider.directory_mode='incomplete';time.sleep(1);check(sid);unknown=wait(lambda:visibility(sid) if visibility(sid)['state']=='UNKNOWN' else None,45);assert unknown['lastGoodSize']==125 and unknown['counts'] is None and unknown['positions']['owned-absent']['state']=='UNKNOWN' and unknown['positions'][SLUG]['lastGoodPosition']==2,unknown
   wait(lambda:'Directory Unknown' in script(sid,"return document.getElementById('directory-summary').textContent"));assert directory_cut(sid)['lastGood']['displayedSlugs']==cut['lastGood']['displayedSlugs'] and directory_cut(sid)['lastGood']['size']==125
   wait(lambda:not state(sid)['counts']['available'],45);before=clock_cut(sid);assert before['cycles'][SLUG]['activeUsedMs']>=0
   receipt['checks'].append('native-incomplete-keeps-full-last-good/Unknown-never-false-absence/last-good-age-and-counts/clock-eligibility-withheld/source-unchanged')
   # Reconstruct the observer with the dashboard closed; no duplicate tab.
   close_dashboard(sid);context(sid,'chrome');terminated=asyncjs(sid,"const {ExtensionParent}=ChromeUtils.importESModule('resource://gre/modules/ExtensionParent.sys.mjs');const e=ExtensionParent.GlobalManager.getExtension(arguments[0]),old=e.backgroundContext;await e.terminateBackground({disableResetIdleForTest:true});return {oldClosed:old.unloaded===true||e.backgroundContext!==old};",[ID]);assert terminated['oldClosed'];context(sid,'content');time.sleep(3);toolbar(sid);dashboard(sid);page(sid);assert visibility(sid)['lastGoodSize']==125 and not visibility(sid)['fresh'];assert len(observer_tabs(sid))==1
   # Donor route proof is deliberately invalidated by the real context closure.
   script(sid,"location.hash='#accounts/'+arguments[0]",[owner]);wait(lambda:script(sid,"return !!document.getElementById('account-open')&&!document.getElementById('account-open').disabled"));click(sid,'#account-open');dashboard(sid);settle(sid,owner,'READY');provider.directory_mode='complete';time.sleep(1);check(sid);wait(lambda:measured(sid),100)
   before=directory_cut(sid);close_at=int(time.time()*1000);close_dashboard(sid);time.sleep(65);reopened=int(time.time()*1000);toolbar(sid);dashboard(sid);page(sid)
   events=asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),p=await c.list({table:'events',filters:{targetId:'refresher-directory'},limit:200});c.close();return p.rows.filter(e=>e.step==='SAVE_VIEW'&&e.time>arguments[0]&&e.time<arguments[1]).map(e=>({sequence:e.sequence,time:e.time}));",[close_at,reopened]);assert events,('NO_CLOSED_DASHBOARD_MEASUREMENT',events);receipt['closedDashboardEvents']=events;assert len(observer_tabs(sid))==1
   prior=stop(sid,profile);sid=None;sid,_=account_session(binary,profile);assert not prior.intersection(pids(profile));toolbar(sid);dashboard(sid);page(sid);cold=visibility(sid);assert cold['lastGoodSize']==125 and cold['positions'][SLUG]['lastGoodPosition']==2;assert len(observer_tabs(sid))<=1
   check(sid);wait(lambda:visibility(sid)['state']=='UNKNOWN',70);assert visibility(sid)['lastGoodSize']==125
   script(sid,"location.hash='#accounts/'+arguments[0]",[owner]);wait(lambda:script(sid,"return !!document.getElementById('account-open')&&!document.getElementById('account-open').disabled"));click(sid,'#account-open');dashboard(sid);settle(sid,owner,'READY');check(sid);wait(lambda:measured(sid),100);assert len(observer_tabs(sid))==1
   assert stored(provider)==expected and provider.save_requests==[] and provider.uploads==[] and provider.unexpected==[]
   receipt['checks'].append('real-event-page-close/route-proof-held-and-Accounts-Open-reverified/one-observer-reused/immutable-closed-dashboard-measurement/actual-Firefox-restart/last-good-restored-without-replaying-page-actions/no-provider-or-source-write')
   receipt['visibility']=visibility(sid);receipt['result']='PASS'
  except Exception as error:
   receipt['error']=str(error)
   if sid:
    try:toolbar(sid);dashboard(sid);receipt['status']=state(sid);receipt['directory']=directory_cut(sid);receipt['body']=script(sid,"return document.body.innerText")
    except Exception:pass
   print(json.dumps(receipt),flush=True);raise
  finally:
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();provider.close();(OUT/'installed-directory.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
