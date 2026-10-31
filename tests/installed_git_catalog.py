"""P12 B: real Connections/Generators and saved truncated Git traversal.
Fixed production HTTPS endpoint mapped only in this disposable profile.
"""
from installed_packages import *
from installed_journal import set_input,close_dashboard
from git_https_fixture import GitFixture,TOKEN

def git_session(binary,profile):
 r=call('POST','/session',{'capabilities':{'alwaysMatch':{'browserName':'firefox','acceptInsecureCerts':False,'moz:firefoxOptions':{'binary':str(binary),'args':['-headless','-no-remote','-profile',str(profile)],'prefs':{'xpinstall.signatures.required':False,'extensions.autoDisableScopes':0,'network.dns.localDomains':'api.github.com'}}}}});return r['sessionId'],r['capabilities']
def connections(sid):
 click(sid,'nav a[href="#settings"]');wait(lambda:script(sid,"return !!document.querySelector('#records a[href=\"#settings/connections\"]')"));click(sid,'#records a[href="#settings/connections"]');wait(lambda:script(sid,"return !!document.getElementById('git-save')"))
def generators(sid):click(sid,'nav a[href="#generators"]');wait(lambda:script(sid,"return !!document.getElementById('generator-list')"))
def inspect(sid):
 return asyncjs(sid,"""const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),state=await c.view('git-catalog');let cursor=null,rows=[];do{const p=await c.list({table:'generators',cursor});rows.push(...p.rows);cursor=p.cursor;}while(cursor);c.close();return {state,rows};""")
def rows(sid):return script(sid,"return [...document.querySelectorAll('#generator-list a')].map(a=>({id:a.hash.split('/')[1],text:a.textContent}))")
def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve();identity=json.loads((xpi.parent/'identity.json').read_text());assert not identity['dirty'];assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
 receipt={'tier':'B/independent-Git-HTTPS-fixture','source':identity['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]};assert receipt['xpiSha256']==identity['xpiSha256']
 with tempfile.TemporaryDirectory(prefix='pcms-git-catalog-') as tmp:
  root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();home=root/'home';home.mkdir();fixture=GitFixture(root);fixture.start();env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'};log=open(OUT/'driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None
  try:
   wait(driver_ready,15);sid,caps=git_session(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'));assert int(caps['browserVersion'].split('.')[0])>=155 and caps['acceptInsecureCerts'] is False
   context(sid,'chrome');script(sid,"Components.classes['@mozilla.org/security/x509certdb;1'].getService(Components.interfaces.nsIX509CertDB).addCertFromBase64(arguments[0],'C,,');return true;",[base64.b64encode(fixture.ca).decode()]);prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];receipt['sandbox']=prefs;context(sid,'content')
   assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid);connections(sid);set_input(sid,'#git-repository','fixture/catalog');set_input(sid,'#git-token','wrong-fixture-token');click(sid,'#git-save');wait(lambda:'denied read access' in script(sid,"return document.getElementById('git-result').textContent"));assert script(sid,"return document.getElementById('git-token').value")=='wrong-fixture-token';assert inspect(sid)['state'] is None
   set_input(sid,'#git-token',TOKEN);click(sid,'#git-save');wait(lambda:'Connection saved' in script(sid,"return document.getElementById('git-result').textContent"));assert script(sid,"return document.getElementById('git-token').value")=='';partial=wait(lambda:next((r for r in [inspect(sid)] if r['state'].get('scan') and 0<r['state']['scan']['cursor']<len(fixture.folders)),None),30);assert partial['rows']==[] and TOKEN not in json.dumps(partial);generators(sid);set_input(sid,'#catalog-search','folder-0060');prior=stop(sid,profile);sid=None;sid,_=git_session(binary,profile);assert not prior.intersection(pids(profile));toolbar(sid);dashboard(sid);generators(sid);assert script(sid,"return document.getElementById('catalog-search').value")=='folder-0060';close_dashboard(sid)
   wait(lambda:any(r['path']=='/git/blobs/'+fixture.last_marker and r['status']==200 for r in fixture.requests()),55);time.sleep(2);reopened=int(time.time()*1000);toolbar(sid);dashboard(sid);generators(sid);complete=wait(lambda:next((r for r in [inspect(sid)] if r['state']['scan'] is None),None),15);assert complete['state']['observedAt']<reopened and len(complete['rows'])==len(fixture.folders);assert {r['slug'] for r in complete['rows']}==set(fixture.folders);assert all(r.get('accountId') is None for r in complete['rows']);assert TOKEN not in json.dumps(complete)
   wait(lambda:len(rows(sid))==1 and 'folder-0060' in rows(sid)[0]['text']);set_input(sid,'#catalog-search','');wait(lambda:len(rows(sid))==50);first={r['id'] for r in rows(sid)};click(sid,'#catalog-next');wait(lambda:len(rows(sid))==13);assert len(first|{r['id'] for r in rows(sid)})==63
   click(sid,'#catalog-filter option[value="DECLARATION_ERROR"]');wait(lambda:len(rows(sid))==1 and 'invalid-one' in rows(sid)[0]['text']);click(sid,'#generator-list a');wait(lambda:'MARKER_VERSION' in script(sid,"return document.getElementById('generator-detail')?.textContent||''"));click(sid,'#records a[href="#generators"]');wait(lambda:len(rows(sid))==1);assert script(sid,"return document.getElementById('catalog-filter').value")=='DECLARATION_ERROR'
   connections(sid);assert script(sid,"return document.getElementById('git-token').value")=='';baseline=len(fixture.requests());click(sid,'#git-reconnect');wait(lambda:'Read access checked.'==script(sid,"return document.getElementById('git-result').textContent"));assert all(not r['path'].startswith(('/git/blobs/','/git/trees/')) for r in fixture.requests()[baseline:]);assert inspect(sid)['state']['head']==fixture.head
   fixture.fail(401);click(sid,'#git-reconnect');wait(lambda:'denied read access' in script(sid,"return document.getElementById('git-result').textContent"));assert inspect(sid)['rows']==complete['rows'];fixture.fail(None);click(sid,'#git-reconnect');wait(lambda:'Read access checked.'==script(sid,"return document.getElementById('git-result').textContent"))
   set_input(sid,'#git-repository','fixture/unsaved-draft');click(sid,'nav a[href="#home"]');connections(sid);assert script(sid,"return document.getElementById('git-repository').value")=='fixture/unsaved-draft';assert inspect(sid)['state']['connection']['repository']=='fixture/catalog'
   receipt['checks']=['real-Save/denied-token-input-preserved/token-not-returned','truncated-recursive-tree/saved-finite-cursor/no-partial-deletion/real-process-restart/closed-dashboard-completion-before-reopen','independent-63-folder-set/actual-later-page/search/filter/marker-error-details/retained-filter','real-Reconnect/unchanged-no-input-reads/auth-failure-keeps-catalog/repository-draft-kept/no-Git-writes'];receipt['requests']=fixture.requests();assert all(r['method']=='GET' for r in receipt['requests']);receipt['result']='PASS';(OUT/'git-catalog.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')))
  except Exception as error:
   receipt['error']=str(error);receipt['requests']=fixture.requests()
   if sid:
    try:dashboard(sid);receipt['state']=inspect(sid);(OUT/'git-catalog-failure.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')))
    except Exception:pass
   raise
  finally:
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();fixture.close();(OUT/'installed-git-catalog.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
