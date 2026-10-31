"""P11 B: visible lifecycle controls, real container/session deletion and
process-restart cleanup recovery. Protocol/provider fixtures only.
"""
from installed_accounts import *

def visible(sid,selector):return wait(lambda:script(sid,"const b=document.querySelector(arguments[0]);return b&&!b.hidden&&!b.disabled",[selector]))
def local(sid,id):
 return asyncjs(sid,"""const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),a=await c.read('accounts',arguments[0]),g=await c.read('generators','remote-sentinel'),f=g?await c.verifySource(g.sourceId):[];const secret=await c.credentials.get('account-local'),git=await c.credentials.get('git-fixture'),other=await c.credentials.get('other-local');const bytes=[];for(const x of f)bytes.push({path:x.path,bytes:[...await c.bytes(x.blobId)]});c.close();return {exists:!!a,generator:g,bytes,accountSecretPresent:secret!==null,gitSecretPresent:git!==null,otherSecretPresent:other!==null};""",[id])

def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve();identity=json.loads((xpi.parent/'identity.json').read_text());assert not identity['dirty'];assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
 receipt={'tier':'B/donor-site-native-protocol-fixtures','source':identity['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]};assert receipt['xpiSha256']==identity['xpiSha256']
 with tempfile.TemporaryDirectory(prefix='pcms-account-lifecycle-') as tmp:
  root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();home=root/'home';home.mkdir();fixture=Fixture(root);fixture.start_catalog();fixture.install_bridge(home,root);remote_before=fixture.receipt()['remoteInventory']
  env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'};log=open(OUT/'driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None
  try:
   wait(driver_ready,15);sid,caps=account_session(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'));assert int(caps['browserVersion'].split('.')[0])>=155 and caps['acceptInsecureCerts'] is False
   context(sid,'chrome');script(sid,"Components.classes['@mozilla.org/security/x509certdb;1'].getService(Components.interfaces.nsIX509CertDB).addCertFromBase64(arguments[0],'C,,');return true;",[base64.b64encode(fixture.ca).decode()]);prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];receipt['sandbox']=prefs;context(sid,'content')
   assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid)
   settings(sid);wait(lambda:script(sid,"return !!document.getElementById('allow-userscripts')"));click(sid,'#allow-userscripts');permission_choice(sid,True);wait(lambda:script(sid,"return !document.getElementById('allow-userscripts')"))
   first=add(sid,'Lifecycle fixture');settle(sid,first,'LOGIN_REQUIRED');login(sid,first,'lifecycle@fixture.test');visible(sid,'#account-confirm');click(sid,'#account-confirm');ready=settle(sid,first,'READY');old_identity=ready['identityObservedAt'];old_tab=ready['tabId'];container=ready['containerId'];uid=ready['personaUid']
   second=add(sid,'Other usable fixture');settle(sid,second,'LOGIN_REQUIRED');login(sid,second,'other@fixture.test');visible(sid,'#account-confirm');click(sid,'#account-confirm');settle(sid,second,'READY')
   asyncjs(sid,"""const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),source=await c.source([{path:'main.pjs',bytes:new TextEncoder().encode('local previous-good\\n')},{path:'src/bytes.bin',bytes:new Uint8Array([0,255,42])}]);await c.mutate([{table:'generators',id:'remote-sentinel',value:{generatorId:'remote-sentinel',slug:'remote-sentinel',accountId:arguments[0],remoteId:'remote-stable-id',sourceId:source.manifestId,state:'MANAGED'},refs:source.refs}],{step:'FIXTURE_GENERATOR_HISTORY',result:'COMPLETE'});await c.credentials.set('account-local','disposable-local',arguments[0]);await c.credentials.set('other-local','disposable-other',arguments[1]);await c.credentials.set('git-fixture','disposable-git');c.close();return true;""",[first,second]);saved=local(sid,first)
   page(sid,first);visible(sid,'#account-archive');click(sid,'#account-archive');wait(lambda:account(sid,first)['state']=='ARCHIVED');archived=account(sid,first);assert archived['expectedPrincipal']==ready['expectedPrincipal'] and archived['exitAddresses']==ready['exitAddresses'] and archived['tabId']==old_tab
   # Independent actual browser context/tabs, rather than UI status strings.
   assert asyncjs(sid,"return !!(await browser.contextualIdentities.get(arguments[0]))&&(await browser.tabs.get(arguments[1])).cookieStoreId===arguments[0];",[container,old_tab]);assert fixture.receipt()['remoteInventory']==remote_before
   visible(sid,'#account-generators');click(sid,'#account-generators');wait(lambda:'remote-sentinel' in script(sid,"return document.getElementById('account-related-list')?.textContent||''"));click(sid,'#records a[href="#accounts/'+first+'"]');visible(sid,'#account-work');click(sid,'#account-work');wait(lambda:script(sid,"return !!document.getElementById('account-related-list')"));page(sid,first)
   visible(sid,'#account-reactivate');click(sid,'#account-reactivate');fresh=settle(sid,first,'READY');assert fresh['identityObservedAt']>old_identity and fresh['personaUid']==uid and fresh['tabId']==old_tab
   receipt['checks'].append('real-Archive/preserved-session-tabs/binding-reservations/fresh-Reactivate/exact-count-links')
   visible(sid,'#account-remove');click(sid,'#account-remove');visible(sid,'#account-remove-cancel');click(sid,'#account-remove-cancel');assert account(sid,first)['state']=='READY' and local(sid,first)==saved
   # Fail only the final local cleanup transaction, after actual container
   # deletion. No product flag or packaged test bypass is introduced.
   asyncjs(sid,"""const bg=await browser.runtime.getBackgroundPage(),p=bg.IDBObjectStore.prototype,original=p.add;p.add=function(row){if(this.name==='events'&&row.step==='REMOVE_ACCOUNT_DATA'){p.add=original;throw new DOMException('disposable cleanup interruption','QuotaExceededError');}return original.call(this,row);};return true;""")
   click(sid,'#account-remove');visible(sid,'#account-remove-confirm');click(sid,'#account-remove-confirm');partial=wait(lambda:next((a for a in inspect(sid)['accounts'] if a['id']==first and a['flow']['stage']=='REMOVE_DATA' and a['work']['state']=='HELD'),None),45);removal_job=partial['flow']['jobId'];assert partial['admission']=='REMOVING'
   assert asyncjs(sid,"return !(await browser.contextualIdentities.query({})).some(c=>c.cookieStoreId===arguments[0])&&!(await browser.tabs.query({})).some(t=>t.cookieStoreId===arguments[0]);",[container]);assert fixture.receipt()['remoteInventory']==remote_before
   prior=stop(sid,profile);sid=None;sid,_=account_session(binary,profile);assert not prior.intersection(pids(profile));toolbar(sid);dashboard(sid);page(sid);wait(lambda:all(a['id']!=first for a in inspect(sid)['accounts']),45)
   after=local(sid,first);assert not after['exists'] and not after['accountSecretPresent'] and after['gitSecretPresent'] and after['otherSecretPresent'];assert after['generator']['holdCode']=='OWNER_MISSING' and after['generator']['accountId']==first and after['generator']['remoteId']=='remote-stable-id';assert after['bytes']==saved['bytes']
   complete=asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),j=await c.read('jobs',arguments[0]);c.close();return j;",[removal_job]);assert complete['state']=='COMPLETE';assert fixture.receipt()['remoteInventory']==remote_before and fixture.receipt()['unexpected']==[]
   page(sid,second);visible(sid,'#account-open');prior_open=account(sid,second)['flow']['jobId'];click(sid,'#account-open');dashboard(sid);wait(lambda:account(sid,second)['flow']['jobId']!=prior_open);settle(sid,second,'READY');assert account(sid,second)['principalLabel']=='other@fixture.test'
   receipt['checks'].append('real-Remove-cancel/one-local-confirmation/actual-container-session-tabs-removed/cleanup-quota/process-restart/same-removal-job/no-second-confirmation/owner-missing-history/source-exact/Git-other-secrets-preserved/remote-inventory-source-unchanged/other-account-usable')
   page(sid);set_input(sid,'#account-search','Other usable');wait(lambda:script(sid,"return document.querySelectorAll('#account-list a').length===1"));click(sid,'nav a[href="#home"]');page(sid);assert script(sid,"return document.getElementById('account-search').value")=='Other usable';receipt['result']='PASS';receipt['fixture']=fixture.receipt();(OUT/'account-lifecycle.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')))
  except Exception as error:
   receipt['error']=str(error)
   if sid:
    try:dashboard(sid);receipt['state']=inspect(sid);(OUT/'account-lifecycle-failure.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')))
    except Exception:pass
   receipt['fixture']=fixture.receipt();raise
  finally:
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();fixture.close();(OUT/'installed-account-lifecycle.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
