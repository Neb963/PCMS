"""P38 B: automatic controller -> real queue/protected native save -> moving DOM.
All service, account, route and source effects are disposable local fixtures.
"""
from installed_refresh_markers import *
from installed_refresh_markers import Provider as MarkerProvider
from installed_directory import directory_cut,observer_tabs
import threading

class MovingProvider(MarkerProvider):
 def do_POST(self):
  f=self.server.fixture
  if self.path=='/api/save' and len(f.save_requests)==1:
   f.second_wait.set();assert f.second_release.wait(30),'CLOSED_DASHBOARD_FIXTURE_NOT_RELEASED'
  return super().do_POST()
 def do_GET(self):
  f=self.server.fixture;host=self.headers.get('Host','').split(':')[0]
  if host==FRAME and self.path=='/generators':
   js=r"""
const root=document.getElementById('generatorList');
async function update(){try{const d=await(await fetch('/fixture/moving')).json();
 if(root.dataset.revision!==d.revision){root.dataset.revision=d.revision;root.dataset.totalDisplayed=String(d.order.length);root.replaceChildren();
 for(let i=0;i<d.order.length;i++){const s=d.order[i],li=document.createElement('li'),h=document.createElement('h2'),a=document.createElement('a');li.dataset.generatorName=s;li.setAttribute('aria-posinset',i+1);li.setAttribute('aria-setsize',d.order.length);if(i===0)li.dataset.pinned='true';a.href='https://perchance.org/'+s;a.textContent=s;h.append(a);li.append(h);root.append(li);}root.setAttribute('aria-busy','false');}
 }finally{setTimeout(update,500);}}update();
"""
   return self.send(('<!doctype html><title>Moving rendered fixture</title><ul id="generatorList" aria-busy="true"></ul><script>'+js+'</script>').encode(),'text/html')
  if host==FRAME and self.path=='/fixture/moving':
   with f.lock:
    count=len(f.save_requests);other=['other-%03d'%i for i in range(180)]
    order=['pinned-other']+other[:120] if not count else ['pinned-other']+(['new-%03d'%i for i in range(48)] if f.pressure and count==1 else [])+[SLUG]+other
    order=order[:121];f.directory_reads.append({'saveCount':count,'pressure':f.pressure,'order':order});return self.send({'order':order,'revision':str(count)+'-'+str(f.pressure)})
  return super().do_GET()

account_fixture.Provider=MovingProvider
def worker_tabs(sid):
 return asyncjs(sid,"const out=[];for(const t of await browser.tabs.query({})){const tag=await browser.sessions.getTabValue(t.id,'pcmsRefreshEditor');if(tag)out.push({id:t.id,tag,url:t.url,container:t.cookieStoreId});}return out;")

def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve();identity=json.loads((xpi.parent/'identity.json').read_text())
 assert not identity['dirty'] and not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
 receipt={'tier':'B/P38/adaptive-controller','source':identity['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]};assert receipt['xpiSha256']==identity['xpiSha256']
 with tempfile.TemporaryDirectory(prefix='pcms-p38-') as tmp:
  root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();home=root/'home';home.mkdir();provider=Fixture(root,extra_hosts=['user.uploads.dev',FRAME]);expected=configure(provider);expected['main.pjs']=b'output\r\n  Hello [animal]\r\nanimal\r\n  cat\r\n  dog';provider.generator['modelText']=expected['main.pjs'].decode();provider.directory_mode='complete';provider.directory_reads=[];provider.directory_advances=[];provider.pressure=False;provider.second_wait=threading.Event();provider.second_release=threading.Event();provider.generator['isPrivate']=False;provider.start_catalog();provider.install_bridge(home,root)
  env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'};log=open(OUT/'driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None
  try:
   wait(driver_ready,15);sid,caps=account_session(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'));assert int(caps['browserVersion'].split('.')[0])>=155 and caps['acceptInsecureCerts'] is False
   context(sid,'chrome');script(sid,"Components.classes['@mozilla.org/security/x509certdb;1'].getService(Components.interfaces.nsIX509CertDB).addCertFromBase64(arguments[0],'C,,');return true;",[base64.b64encode(provider.ca).decode()]);prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];receipt['sandbox']=prefs;context(sid,'content')
   assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid);settings(sid);wait(lambda:script(sid,"return !!document.getElementById('allow-userscripts')"));click(sid,'#allow-userscripts');permission_choice(sid,True);wait(lambda:script(sid,"return !document.getElementById('allow-userscripts')"))
   owner=add(sid,'Clock owner');settle(sid,owner,'LOGIN_REQUIRED');login(sid,owner,'source@fixture.test');click(sid,'#account-confirm');settle(sid,owner,'READY');settings_clock(sid,1,1);asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),a=await c.read('accounts',arguments[0]);await c.mutate([{table:'generators',id:'existing-sentinel',value:{slug:'existing-sentinel',remoteId:'public_source-stable-18',accountId:a.id,ownerPrincipal:a.expectedPrincipal,creatorState:'OWNED',listing:'PUBLIC',state:'OWNED'}}],{step:'FIXTURE_PREVIOUS_OWNED',result:'COMPLETE'});c.close();location.hash='#generators/existing-sentinel';return true;",[owner]);wait(lambda:script(sid,"return !!document.getElementById('source-open')&&!document.getElementById('source-open').disabled"));click(sid,'#source-open');editor_handle=editor(sid);dashboard(sid);script(sid,"location.hash='#generators/existing-sentinel'");wait(lambda:script(sid,"return !!document.getElementById('source-inspect')&&!document.getElementById('source-inspect').disabled"));click(sid,'#source-inspect');source=wait(lambda:completed_source(sid),90);assert source['generator']['sourceState']=='VERIFIED' and source['generator']['listing']=='PUBLIC';assert {p:base64.b64decode(v) for p,v in source['bytes'].items()}==expected
   page(sid);pause(sid,'Pause Refresher');asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),g=await c.read('generators','existing-sentinel');await c.mutate([{table:'generators',id:g.id,expectedRev:g.rev,refs:g.refs,value:{...g,poolMember:true,pool:{schema:1,member:true,sourceManifest:g.sourceManifest,addedAt:Date.now()},refreshCycle:{schema:1,cycleId:crypto.randomUUID(),phase:'PENDING',activeUsedMs:0}}}],{step:'FIXTURE_QUALIFIED_P22_POOL',result:'COMPLETE'});c.close();return true;");page(sid)
   asyncjs(sid,"const a=(await browser.runtime.sendMessage({channel:'pcms-core',operation:'accounts.get',id:arguments[0]})).result;for(const t of await browser.tabs.query({cookieStoreId:a.containerId})){if(t.url==='https://perchance.org/existing-sentinel#edit')await browser.tabs.remove(t.id);}return true;",[owner])
   assert worker_tabs(sid)==[];assert len(provider.save_requests)==0
   pause(sid,'Resume Refresher');one=verified(sid,1);marker=one['g']['refreshMarker']['id'];assert_bytes(provider,expected,marker,1);assert one['j']['refresh']['automatic'] is True;assert one['j']['refresh']['context']['phase']=='READY';workers=worker_tabs(sid);assert len(workers)==1 and workers[0]['tag']['accountId']==owner and len(observer_tabs(sid))==1
   cycle=one['j']['refresh']['cycleId'];wait(lambda:state(sid)['controller']['last'],90);assert state(sid)['controller']['last']['position']==2;assert state(sid)['visibility']['counts']=={'top50':1,'top100':1,'full':1};assert len(provider.save_requests)==1
   receipt['checks'].append('automatic-positive-demand/no-manual-Refresh-click/closed-original-editor/one-protected-automatic-worker/one-directory-observer/both-markers/full-independent-bytes/public/previous-good/separate-measured-position2')
   click(sid,'#pause-core');wait(lambda:state(sid)['pcmsPaused']);provider.pressure=True;pause(sid,'Pause Refresher');pause(sid,'Resume Refresher');assert state(sid)['pcmsPaused'];settings_clock(sid,2,3);page(sid);assert state(sid)['rows'][0]['cycle']['activeDurationMs']==3600000 and state(sid)['rows'][0]['cycle']['cycleId']==cycle
   time.sleep(2);assert len(provider.save_requests)==1;click(sid,'#pause-core');wait(lambda:not state(sid)['pcmsPaused']);check(sid)
   wait(lambda:directory_cut(sid)['lastGood']['displayedSlugs'].index(SLUG)==49,90)
   # Actual background work after dashboard closure, with measured competitor movement.
   assert provider.second_wait.wait(100),'AUTOMATIC_SECOND_SAVE_NOT_DISPATCHED';closed_at=int(time.time()*1000);close_dashboard(sid);provider.second_release.set();wait(lambda:len(provider.save_requests)>=2,45);assert len(provider.save_requests)==2;assert_bytes(provider,expected,marker,2)
   handles=call('GET',f'/session/{sid}/window/handles');call('POST',f'/session/{sid}/window',{'handle':handles[0]});toolbar(sid);dashboard(sid);page(sid);two=verified(sid,2);assert two['j']['refresh']['cycleId']==cycle and two['g']['previousGood']==one['g']['sourceManifest'];assert len(worker_tabs(sid))==1 and worker_tabs(sid)[0]['id']==workers[0]['id'];wait(lambda:state(sid)['controller']['last'] and state(sid)['controller']['last']['savedAt']>=closed_at,90)
   actual=state(sid)['controller']['last'];assert actual['position']==2 and actual['prediction'][0]>0;time.sleep(3);assert len(provider.save_requests)==2
   receipt['checks'].append('actual-global-and-module-Pause/Resume-cannot-override-global/Settings-next-cycle-durations/retained-cycle/measured-48-entry-downward-pressure/automatic-repeat-visible-endangered-target/dashboard-closed/full-source-readback/worker-reused/no-speculative-third-save')
   click(sid,'#pause-core');wait(lambda:state(sid)['pcmsPaused']);before=clock_cut(sid) if 'clock_cut' in globals() else asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),v=await c.view('refresher-clock');c.close();return v;");old=hard_stop(sid,profile);sid=None
   sid,_=account_session(binary,profile);assert not old.intersection(pids(profile));toolbar(sid);dashboard(sid);page(sid);assert state(sid)['pcmsPaused'] and len(provider.save_requests)==2;after=state(sid)['rows'][0]['cycle'];assert after['cycleId']==cycle and after['activeUsedMs']==before['cycles'][SLUG]['activeUsedMs'];assert len(worker_tabs(sid))<=1
   receipt['checks'].append('real-Firefox-process-restart/durable-global-Pause/same-cycle-and-earned-budget/no-catch-up-save/zero-or-one-owned-worker-until-route-revalidation')
   receipt['controller']=state(sid)['controller'];receipt['result']='PASS'
  except Exception as error:
   receipt['error']=str(error)
   if sid:
    try:toolbar(sid);dashboard(sid);page(sid);receipt['status']=state(sid);receipt['cut']=refresh_cut(sid);receipt['directory']=directory_cut(sid);receipt['body']=script(sid,"return document.body.innerText")
    except Exception:pass
   print(json.dumps(receipt),flush=True);raise
  finally:
   provider.release_ack.set();provider.second_release.set()
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();provider.close();(OUT/'installed-refresh-controller.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
