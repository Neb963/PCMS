"""P15 B: actual protected Discover -> scoped Core Git writer -> catalog.
Independent remote history is disposable bare Git; no external forwarding.
"""
from installed_packages import *
from installed_accounts import add,settle,login
from installed_lifecycle import permission_choice
from installed_journal import set_input
from installed_git_catalog import connections
from installed_git_writer import work
from installed_discover import SlugProvider,discover,choose,activate,top,AVAILABLE
from account_fixture import Fixture
import account_fixture
from git_write_https_fixture import GitWriteFixture
from git_https_fixture import TOKEN
MARKER=b'Format: PCMS-1\nVersion: v1\nAction: DEVELOP\nStatus: NOT_READY\n'
class Provider(SlugProvider):
 def do_GET(self):
  if self.headers.get('Host','').split(':')[0]=='perchance.org' and self.path in ['/lost-name','/existing-sentinel']:
   f=self.server.fixture
   with f.lock:f.slug_reads.append({'path':self.path,'routeId':self.route,'at':time.time()})
   return self.send(('<!doctype html><meta charset="utf-8"><title>Disposable slug fixture</title>'+AVAILABLE).encode(),'text/html; charset=utf-8')
  return super().do_GET()
account_fixture.Provider=Provider
def session15(binary,profile):
 r=call('POST','/session',{'capabilities':{'alwaysMatch':{'browserName':'firefox','acceptInsecureCerts':False,'moz:firefoxOptions':{'binary':str(binary),'args':['-headless','-no-remote','-profile',str(profile)],'prefs':{'xpinstall.signatures.required':False,'extensions.autoDisableScopes':0,'network.dns.localDomains':'api.mullvad.net,api.github.com'}}}}});return r['sessionId'],r['capabilities']
def state(sid):
 return asyncjs(sid,"""const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore();let cursor=null,jobs=[];do{const p=await c.list({table:'jobs',cursor});for(const j of p.rows)if(j.moduleId==='pcms-discover')jobs.push(await c.read('jobs',j.id));cursor=p.cursor;}while(cursor);const view=await c.view('module:pcms-discover:check-slugs');c.close();return {jobs,view};""")
def writes(remote):return [r for r in remote.requests() if r['method']!='GET']
def import_batch(sid,text,owner):
 set_input(sid,'#discover-input',text);choose(sid,'#discover-account',owner);activate(sid,'#discover-import');wait(lambda:script(sid,"return document.getElementById('discover-state').textContent.startsWith('IMPORTED')"));activate(sid,'#discover-start')
def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve();identity=json.loads((xpi.parent/'identity.json').read_text());assert not identity['dirty'];assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
 receipt={'tier':'B/actual-Discover-protected-rendered-caller/independent-bare-Git-HTTPS','source':identity['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]};assert receipt['xpiSha256']==identity['xpiSha256']
 with tempfile.TemporaryDirectory(prefix='pcms-discover-prep-') as tmp:
  root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();home=root/'home';home.mkdir();provider=Fixture(root);provider.slug_reads=[];provider.install_bridge(home,root);remote=GitWriteFixture(root);baseline=remote.snapshot();remote.controls(race=None,lose_applied_ref=False,hide_applied_commits=False,hold_blob_reply=True,release_blob_reply=False)
  (root/'fixture-socks-catalog.json').write_text(json.dumps([{'online':True,'hostname':'fixture-'+str(i),'ipv4_address':'10.124.0.'+str(i),'port':1080,'location':{'country':'Fixture','city':'Local'}} for i in range(1,9)]));remote.start()
  env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'};log=open(OUT/'driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None;lost_job=None
  try:
   wait(driver_ready,15);sid,caps=session15(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'));assert int(caps['browserVersion'].split('.')[0])>=155 and caps['acceptInsecureCerts'] is False
   context(sid,'chrome')
   for ca in [provider.ca,remote.ca]:script(sid,"Components.classes['@mozilla.org/security/x509certdb;1'].getService(Components.interfaces.nsIX509CertDB).addCertFromBase64(arguments[0],'C,,');return true;",[base64.b64encode(ca).decode()])
   prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];receipt['sandbox']=prefs;context(sid,'content')
   assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid);settings(sid);wait(lambda:script(sid,"return !!document.getElementById('allow-userscripts')"));click(sid,'#allow-userscripts');permission_choice(sid,True);wait(lambda:script(sid,"return !document.getElementById('allow-userscripts')"))
   owner=add(sid,'Preparation fixture account');settle(sid,owner,'LOGIN_REQUIRED');login(sid,owner,'prepare@fixture.test');click(sid,'#account-confirm');settle(sid,owner,'READY')
   connections(sid);set_input(sid,'#git-repository','fixture/catalog');set_input(sid,'#git-token',TOKEN);click(sid,'#git-save');wait(lambda:'Connection saved' in script(sid,"return document.getElementById('git-result').textContent"))
   discover(sid);import_batch(sid,'free-name\nreserved-name',owner);wait(lambda:any(r.get('heldReply') for r in remote.requests()),30)
   # The actual Pause closes child admission while the one admitted blob drains.
   activate(sid,'#discover-pause');remote.controls(release_blob_reply=True);wait(lambda:script(sid,"return document.getElementById('discover-state').textContent.startsWith('PAUSED')"),15);count=len(writes(remote));time.sleep(1.5);assert len(writes(remote))==count and not remote.snapshot()['operations']
   activate(sid,'#discover-resume');wait(lambda:'VERIFIED' in script(sid,"return document.querySelector('#discover-rows li .prep-status').textContent"),45);wait(lambda:script(sid,"const b=document.querySelector('#discover-rows li .prep-generator');return b&&!b.hidden"))
   top(sid);first_state=state(sid);first_batch=next(j for j in first_state['jobs'] if j['kind']=='DISCOVER_BATCH');first_job=next(j for j in first_state['jobs'] if j['kind']=='GIT_PREPARE');first_date=first_batch['discover']['rows'][0]['checkedAt'];first=remote.snapshot();assert len(first['operations'])==1;assert base64.b64decode(first['files']['generators/free-name/DEPLOYMENT.md']['bytes'])==MARKER;assert [p for p in first['files'] if p.startswith('generators/free-name/')]==['generators/free-name/DEPLOYMENT.md'];assert all(first['files'][p]==v for p,v in baseline['files'].items())
   frame(sid);activate(sid,'#discover-rows li .prep-generator');top(sid);wait(lambda:script(sid,"return location.hash.startsWith('#generators/git:314159:')&&!!document.getElementById('generator-detail')"));assert 'NOT_READY' in script(sid,"return document.getElementById('generator-detail').textContent")
   receipt['checks'].append('actual-Check-slugs/Available-auto-enqueue/exact-host-held-proof/real-batch-Pause-between-object-calls/one-attributed-commit/marker-only-defaults/unchanged-existing-source-root-instructions-binary-modes/actual-View-generator/catalog-row')
   remote.controls(lose_applied_ref=True,hide_lost_commit=True,hide_applied_commits=False,hiddenCommit=None);discover(sid);import_batch(sid,'lost-name\nexisting-sentinel\nreserved-name\nchanged-name',owner)
   wait(lambda:any(r.get('lost') for r in remote.requests()),45);top(sid);s=wait(lambda:next((j for j in state(sid)['jobs'] if j['kind']=='GIT_PREPARE' and j['input']['slug']=='lost-name' and (j.get('effect') or {}).get('boundary')=='POSSIBLE'),None));lost_job=s['id'];operation=s['effect']['operationId'];parent=s['discoverPreparation']['batchId'];date=s['discoverPreparation']['checkedAt'];write_count=len(writes(remote));assert len(remote.snapshot()['operations'])==2 and not (s.get('git') or {}).get('active',{}).get('receipt')
   # Wait for the other completed classifier rows; preserve Unknown, then restart.
   discover(sid);wait(lambda:script(sid,"return document.getElementById('discover-state').textContent.startsWith('UNKNOWN')"),30);top(sid);before_reads=list(provider.slug_reads);prior=stop(sid,profile);sid=None;sid,_=session15(binary,profile);assert not prior.intersection(pids(profile));toolbar(sid);dashboard(sid);work(sid,lost_job)
   # Hidden candidate bytes prevent premature verification. Check is read-only.
   click(sid,'#git-job-check');time.sleep(1);assert len(writes(remote))==write_count;check=next(j for j in state(sid)['jobs'] if j['id']==lost_job);assert not check['git']['active'].get('receipt');assert check['discoverPreparation']['checkedAt']==date
   remote.controls(hide_applied_commits=False);click(sid,'#git-job-check');wait(lambda:'verified' in script(sid,"return document.getElementById('git-job-result').textContent").lower(),30);discover(sid);wait(lambda:script(sid,"return document.querySelector('#discover-rows li .prep-status').textContent.includes('VERIFIED')"));wait(lambda:script(sid,"return [...document.querySelectorAll('#discover-rows li .prep-status')].some(e=>e.textContent.includes('folder already exists'))"),30);top(sid)
   final=remote.snapshot();s=state(sid);job=next(j for j in s['jobs'] if j['id']==lost_job);batch=next(j for j in s['jobs'] if j['id']==parent);assert batch['discover']['rows'][0]['result']=='Available' and batch['discover']['rows'][0]['checkedAt']==date;assert job['git']['active']['phase']=='COMPLETE' and len([e for e in job['effects'] if e['operationId']==operation])==1
   assert len(writes(remote))==write_count and len(final['operations'])==2;assert base64.b64decode(final['files']['generators/lost-name/DEPLOYMENT.md']['bytes'])==MARKER;assert [p for p in final['files'] if p.startswith('generators/lost-name/')]==['generators/lost-name/DEPLOYMENT.md'];assert all(final['files'][p]==v for p,v in baseline['files'].items());assert provider.slug_reads==before_reads;assert len([r for r in writes(remote) if r['method']=='PATCH'])==2 and all(r.get('force') is False for r in writes(remote) if r['method']=='PATCH');assert set(provider.receipt()['remoteInventory'])=={'remote-sentinel'} and provider.receipt()['unexpected']==[]
   receipt['checks'].append('second-Available/applied-ref-body-loss/no-early-verification/real-process-restart/same-operation-actual-Work-readback/no-new-writes/no-completed-classifier-recheck/existing-folder-preserved/Available-date-kept/no-provider-create')
   receipt['writes']=writes(remote);receipt['operations']=final['operations'];receipt['result']='PASS'
  except Exception as error:
   receipt['error']=str(error);receipt['writes']=writes(remote);receipt['slugReads']=provider.slug_reads
   if sid:
    try:receipt['page']=script(sid,"return document.body.innerText")
    except Exception:pass
    try:top(sid);receipt['state']=state(sid)
    except Exception:pass
   print(json.dumps(receipt),flush=True);raise
  finally:
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();remote.close();provider.close();receipt['fixtureDiagnostics']=remote.proc.stderr.read() if remote.proc and remote.proc.poll() is not None else '';(OUT/'installed-discover-preparation.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
