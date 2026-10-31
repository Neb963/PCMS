"""P14 B: actual packaged Discover/one protected rendered checking tab,
saved batch, real Firefox restart and independently reopened Downloads bytes.
No external service/socket forwarding or provider/Git mutation.
"""
import account_fixture
from account_fixture import Fixture,Provider
from installed_accounts import account_session,add,settle,login,page as account_page
from installed_lifecycle import permission_choice
from installed_journal import set_input
from installed_packages import *
AVAILABLE='(⊙.⊙) sorry, we cannot find a generator with that name! create one?'
RESERVED='(⊙.⊙) sorry, this is a reserved name - had to do this because a few users where "name-squatting" on lots of common words and not actually using them ¯\\_(⊙_ʖ⊙)_/¯'
ORIGINAL=' Free_Name \nfree name\n!!\nreserved-name\nframed-name\nchanged-name\nlast-name'
class SlugProvider(Provider):
 def do_GET(self):
  if self.headers.get('Host','').split(':')[0]!='perchance.org' or self.path=='/':return super().do_GET()
  if self.path=='/favicon.ico':return self.send(b'',kind='image/x-icon',status=404)
  f=self.server.fixture;path=self.path
  with f.lock:f.slug_reads.append({'path':path,'routeId':self.route,'at':time.time()})
  if path in ['/free-name','/last-name']:body=AVAILABLE.replace('create one?','<a href="/must-not-follow">create one?</a>')
  elif path=='/reserved-name':body=RESERVED
  elif path=='/framed-name':body='<h1>Generator shell</h1><iframe id="outputIframe" src="/fixture-output/framed-name"></iframe>'
  elif path=='/fixture-output/framed-name':body='<p id="rendered-output">Independent framed generator result ☃</p>'
  elif path=='/changed-name':body=AVAILABLE.replace('!','.')
  else:body='<p>No recognized fixture content</p>'
  self.send(('<!doctype html><meta charset="utf-8"><title>Disposable slug fixture</title>'+body).encode(),'text/html; charset=utf-8')
account_fixture.Provider=SlugProvider
def inspect(sid):
 return asyncjs(sid,"""const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore();let cursor=null,jobs=[];do{const p=await c.list({table:'jobs',cursor});for(const row of p.rows)if(row.moduleId==='pcms-discover')jobs.push(await c.read('jobs',row.id));cursor=p.cursor;}while(cursor);const observer=await c.view('discover-observer'),view=await c.view('module:pcms-discover:check-slugs'),journal=await c.read('modules','pcms-journal');c.close();return {jobs,observer,view,journalEnabled:journal.enabled};""")
def top(sid):call('POST',f'/session/{sid}/frame',{'id':None})
def discover(sid):
 top(sid);click(sid,'nav a[href="#generators"]');wait(lambda:script(sid,"return !!document.getElementById('check-slugs')"));click(sid,'#check-slugs');wait(lambda:script(sid,"return !!document.querySelector('iframe.module-frame')"));frame(sid);wait(lambda:script(sid,"return !!document.getElementById('discover-import')&&document.getElementById('discover-account').options.length>1"))
def activate(sid,selector):
 element=call('POST',f'/session/{sid}/element',{'using':'css selector','value':selector})['element-6066-11e4-a52e-4f735466cecf']
 call('POST',f'/session/{sid}/element/'+element+'/value',{'text':'\ue007'})
def choose(sid,selector,value):
 e=call('POST',f'/session/{sid}/element',{'using':'css selector','value':selector})['element-6066-11e4-a52e-4f735466cecf'];script(sid,"const e=document.querySelector(arguments[0]);e.value=arguments[1];e.dispatchEvent(new Event('change',{bubbles:true}));",[selector,value])
def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve();identity=json.loads((xpi.parent/'identity.json').read_text());assert not identity['dirty'];assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
 receipt={'tier':'B/rendered-protected-HTTPS-fixture/independent-Downloads-bytes','source':identity['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]};assert receipt['xpiSha256']==identity['xpiSha256']
 with tempfile.TemporaryDirectory(prefix='pcms-discover-') as tmp:
  root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();home=root/'home';home.mkdir();fixture=Fixture(root);fixture.slug_reads=[];fixture.start_catalog();fixture.install_bridge(home,root)
  env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'};log=open(OUT/'driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None
  try:
   wait(driver_ready,15);sid,caps=account_session(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'));assert int(caps['browserVersion'].split('.')[0])>=155 and caps['acceptInsecureCerts'] is False
   context(sid,'chrome');script(sid,"Components.classes['@mozilla.org/security/x509certdb;1'].getService(Components.interfaces.nsIX509CertDB).addCertFromBase64(arguments[0],'C,,');return true;",[base64.b64encode(fixture.ca).decode()]);prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];receipt['sandbox']=prefs;context(sid,'content')
   assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid)
   settings(sid);wait(lambda:script(sid,"return !!document.getElementById('allow-userscripts')"));click(sid,'#allow-userscripts');permission_choice(sid,True);wait(lambda:script(sid,"return !document.getElementById('allow-userscripts')"))
   owner=add(sid,'Discover fixture account');settle(sid,owner,'LOGIN_REQUIRED');login(sid,owner,'discover@fixture.test');click(sid,'#account-confirm');a=settle(sid,owner,'READY');login_tab=a['tabId']
   settings(sid);wait(lambda:script(sid,"return !!document.querySelector('section[data-module=\"pcms-journal\"] button[data-lifecycle=\"DISABLE\"]')"));click(sid,'section[data-module="pcms-journal"] button[data-lifecycle="DISABLE"]');wait(lambda:script(sid,"return !!document.querySelector('section[data-module=\"pcms-journal\"] button[data-lifecycle=\"ENABLE\"]')"));click(sid,'#pause-core')
   discover(sid);set_input(sid,'#discover-input',ORIGINAL);choose(sid,'#discover-account',owner);activate(sid,'#discover-import');wait(lambda:script(sid,"return document.getElementById('discover-state').textContent.startsWith('IMPORTED')"));assert len(script(sid,"return [...document.querySelectorAll('#discover-rows li')].map(e=>e.textContent)"))==7
   wait(lambda:script(sid,"const b=document.getElementById('discover-start');return b&&!b.disabled"));script(sid,"document.addEventListener('click',e=>document.body.dataset.lastClick=e.target.id+':'+e.isTrusted,true);");activate(sid,'#discover-start');wait(lambda:script(sid,"return document.getElementById('discover-state').textContent.startsWith('RUNNING')"));time.sleep(1);assert fixture.slug_reads==[]
   activate(sid,'#discover-pause');wait(lambda:script(sid,"return document.getElementById('discover-state').textContent.startsWith('PAUSED')"));activate(sid,'#discover-resume');top(sid);click(sid,'#pause-core');frame(sid)
   wait(lambda:any(r['path']=='/free-name' for r in fixture.slug_reads));wait(lambda:'Available' in script(sid,"return document.getElementById('discover-rows').textContent"));activate(sid,'#discover-pause');wait(lambda:script(sid,"return document.getElementById('discover-state').textContent.startsWith('PAUSED')"));before=list(fixture.slug_reads);time.sleep(2.2);assert fixture.slug_reads==before
   activate(sid,'#discover-rows li button');wait(lambda:script(sid,"return document.getElementById('discover-selected').textContent.includes('Free_Name')"));activate(sid,'#discover-resume');top(sid)
   state=inspect(sid);batch=next(j for j in state['jobs'] if j['kind']=='DISCOVER_BATCH');job_id=batch['id'];assert state['observer']['tabId']!=login_tab and state['observer']['accountId']==owner
   # Close the actual dashboard. Fixture progress must continue without a UI.
   call('DELETE',f'/session/{sid}/window');wait(lambda:any(r['path']=='/changed-name' for r in fixture.slug_reads),30);time.sleep(2.2);assert not any(r['path']=='/last-name' for r in fixture.slug_reads)
   toolbar(sid);dashboard(sid);discover(sid);wait(lambda:script(sid,"return document.getElementById('discover-state').textContent.startsWith('UNKNOWN')"));top(sid);state=inspect(sid);batch=next(j for j in state['jobs'] if j['id']==job_id);assert [r['result'] for r in batch['discover']['rows'] if r['state']=='CHECKED']==['Available','Taken','Taken','Unknown'];assert all(r['checkedAt'] for r in batch['discover']['rows'] if r['state']=='CHECKED')
   receipt['checks'].append('actual-Import/retained-rejections-collisions/exact-visible-link-and-reserved-message/framed-output/one-protected-checking-tab/sequential-interval/global-Pause/batch-Pause/closed-dashboard-progress/Unknown-stops')
   before=list(fixture.slug_reads);settings(sid);wait(lambda:script(sid,"return !!document.querySelector('section[data-module=\"pcms-discover\"] button[data-lifecycle=\"DISABLE\"]')"));click(sid,'section[data-module="pcms-discover"] button[data-lifecycle="DISABLE"]');wait(lambda:script(sid,"return !!document.querySelector('section[data-module=\"pcms-discover\"] button[data-lifecycle=\"ENABLE\"]')"));assert fixture.slug_reads==before
   click(sid,'section[data-module="pcms-discover"] button[data-lifecycle="ENABLE"]');wait(lambda:script(sid,"return !!document.querySelector('section[data-module=\"pcms-discover\"] button[data-lifecycle=\"DISABLE\"]')"));discover(sid);wait(lambda:script(sid,"return document.getElementById('discover-state').textContent.startsWith('UNKNOWN')"));top(sid);assert fixture.slug_reads==before;receipt['checks'].append('actual-Discover-Disable/Enable/page-stop/passive-observer-park/results-and-hold-preserved/no-hidden-check')
   prior=stop(sid,profile);sid=None;sid,_=account_session(binary,profile);assert not prior.intersection(pids(profile));toolbar(sid);dashboard(sid);discover(sid)
   assert script(sid,"return document.getElementById('discover-input').value")==ORIGINAL;assert script(sid,"return document.getElementById('discover-account').value")==owner;assert script(sid,"return document.getElementById('discover-selected').textContent").startswith('Selected input 1');assert script(sid,"return document.getElementById('discover-state').textContent").startswith('UNKNOWN');time.sleep(1);assert fixture.slug_reads==before
   activate(sid,'#discover-resume');wait(lambda:script(sid,"return document.getElementById('discover-state').textContent.startsWith('COMPLETE')"),30);assert len([r for r in fixture.slug_reads if r['path']=='/free-name'])==1 and len([r for r in fixture.slug_reads if r['path']=='/changed-name'])==1 and len([r for r in fixture.slug_reads if r['path']=='/last-name'])==1
   activate(sid,'#discover-export');wait(lambda:'COMPLETE' in script(sid,"return document.getElementById('discover-export-state').textContent"),30);activate(sid,'#discover-check');top(sid);state=inspect(sid);assert state['journalEnabled'] is False
   export=next(j for j in state['jobs'] if j['kind']=='DISCOVER_EXPORT');file=asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),f=await c.read('files',arguments[0]);c.close();return f;",[export['id']]);assert file['state']=='COMPLETE';path=pathlib.Path(file['absolutePath']);raw=path.read_bytes();assert len(raw)==file['bytes'] and hashlib.sha256(raw).hexdigest()==file['sha256']
   with zipfile.ZipFile(path) as z:
    results=json.loads(z.read('results.json'));manifest=json.loads(z.read('manifest.json'));csv=z.read('results.csv');assert hashlib.sha256(z.read('results.json')).hexdigest()==manifest['jsonSha256'];assert hashlib.sha256(csv).hexdigest()==manifest['csvSha256'];assert results['original']==ORIGINAL and len(results['rows'])==7;assert [r['result'] for r in results['rows'] if r['state']=='CHECKED']==['Available','Taken','Taken','Unknown','Available'];assert results['rows'][1]['duplicateOf']==0 and results['rows'][2]['state']=='REJECTED'
   assert all(b['at']-a['at']>=1.8 for a,b in zip([r for r in fixture.slug_reads if r['path'] not in ['/fixture-output/framed-name']],[r for r in fixture.slug_reads if r['path'] not in ['/fixture-output/framed-name']][1:]));assert fixture.receipt()['unexpected']==[];assert set(fixture.receipt()['remoteInventory'])=={'remote-sentinel'}
   receipt['checks'].append('real-process-restart/saved-input-account-batch-row/no-completed-recheck/explicit-Resume/actual-Export-and-check/Journal-disabled/independent-ZIP-JSON-CSV-hashes-and-results/no-provider-or-Git-mutation')
   receipt['slugReads']=fixture.slug_reads;receipt['file']={k:file[k] for k in ['bytes','sha256','state']};receipt['result']='PASS'
  except Exception as error:
   receipt['error']=str(error);receipt['slugReads']=fixture.slug_reads
   if sid:
    try:receipt['page'] = script(sid,"return {text:document.body.innerText,start:document.getElementById('discover-start')?.disabled,feedback:document.getElementById('discover-feedback')?.textContent,lastClick:document.body.dataset.lastClick};")
    except Exception:pass
    try:top(sid);receipt['state']=inspect(sid)
    except Exception:pass
   print(json.dumps(receipt),flush=True);raise
  finally:
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();fixture.close();(OUT/'installed-discover.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
