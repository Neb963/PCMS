"""P10 B: production Accounts UI/sandbox/Core/donor/native protocol and an
attributable authenticated SOCKS/HTTPS fixture. No external provider/service.
"""
from installed_lifecycle import permission_choice
from installed_journal import set_input
from installed_packages import *
from account_fixture import Fixture

def account_session(binary,profile):
 r=call('POST','/session',{'capabilities':{'alwaysMatch':{'browserName':'firefox','acceptInsecureCerts':False,'moz:firefoxOptions':{'binary':str(binary),'args':['-headless','-no-remote','-profile',str(profile)],'prefs':{'xpinstall.signatures.required':False,'extensions.autoDisableScopes':0,'network.dns.localDomains':'api.mullvad.net'}}}}});return r['sessionId'],r['capabilities']
def inspect(sid):
 return asyncjs(sid,"""const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore();let cursor=null,accounts=[];do{const p=await c.list({table:'accounts',cursor});for(const row of p.rows){const a=await c.read('accounts',row.id);accounts.push({...a,work:a.flow?.jobId?await c.read('jobs',a.flow.jobId):null});}cursor=p.cursor;}while(cursor);const status=await c.queue.status();c.close();return {accounts,status};""")
def account(sid,id):return next(a for a in inspect(sid)['accounts'] if a['id']==id)
def page(sid,id=None):
 click(sid,'nav a[href="#accounts"]');wait(lambda:script(sid,"return !!document.getElementById('add-account')"))
 if id:
  wait(lambda:script(sid,"return !!document.querySelector('#account-list a[href=\"#accounts/'+arguments[0]+'\"]')",[id]));click(sid,'#account-list a[href="#accounts/'+id+'"]');wait(lambda:script(sid,"return !!document.getElementById('account-state')"))
def add(sid,label):
 page(sid);before={a['id'] for a in inspect(sid)['accounts']};set_input(sid,'#account-label',label);click(sid,'#add-account');a=wait(lambda:next((a for a in inspect(sid)['accounts'] if a['id'] not in before),None));wait(lambda:script(sid,"return !!document.getElementById('account-state')"));return a['id']
def settle(sid,id,state,code=None):
 return wait(lambda:next((a for a in inspect(sid)['accounts'] if a['id']==id and a['state']==state and (code is None or a.get('holdCode')==code) and (state=='HELD' or a['work']['state']=='COMPLETE')),None),75)
def login(sid,id,email):
 a=account(sid,id);found=None
 for handle in call('GET',f'/session/{sid}/window/handles'):
  call('POST',f'/session/{sid}/window',{'handle':handle})
  if script(sid,"return location.origin")=='https://perchance.org':
   # The session's route-specific fixture gets a distinct owned tab. Browser
   # tabs API supplies its window handle-independent exact tab identity.
   context(sid,'chrome');tabid=script(sid,"return gBrowser.selectedBrowser.browsingContext?.currentWindowGlobal?.documentPrincipal?.originAttributes?.userContextId");context(sid,'content')
   if str(tabid)==a['containerId'].rsplit('-',1)[-1]:found=handle;break
 assert found,'EXACT_PROTECTED_LOGIN_TAB_MISSING';wait(lambda:script(sid,"return !!document.getElementById('fixture-signin')"),30);set_input(sid,'#fixture-email',email);click(sid,'#fixture-signin');wait(lambda:email in script(sid,"return document.getElementById('fixture-result').textContent"));dashboard(sid);page(sid,id)
def double_confirm(sid):
 e=call('POST',f'/session/{sid}/element',{'using':'css selector','value':'#account-confirm'})['element-6066-11e4-a52e-4f735466cecf'];call('POST',f'/session/{sid}/actions',{'actions':[{'type':'pointer','id':'mouse','parameters':{'pointerType':'mouse'},'actions':[{'type':'pointerMove','duration':0,'origin':{'element-6066-11e4-a52e-4f735466cecf':e},'x':0,'y':0},{'type':'pointerDown','button':0},{'type':'pointerUp','button':0},{'type':'pause','duration':25},{'type':'pointerDown','button':0},{'type':'pointerUp','button':0}]}]})

def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve();identity=json.loads((xpi.parent/'identity.json').read_text());assert not identity['dirty'];assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
 receipt={'tier':'B/donor-site-native-protocol-fixtures','source':identity['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]};assert receipt['xpiSha256']==identity['xpiSha256']
 with tempfile.TemporaryDirectory(prefix='pcms-accounts-') as tmp:
  root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();home=root/'home';home.mkdir();fixture=Fixture(root);fixture.start_catalog()
  env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'};log=open(OUT/'driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None
  try:
   wait(driver_ready,15);sid,caps=account_session(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'));assert int(caps['browserVersion'].split('.')[0])>=155 and caps['acceptInsecureCerts'] is False
   context(sid,'chrome');script(sid,"Components.classes['@mozilla.org/security/x509certdb;1'].getService(Components.interfaces.nsIX509CertDB).addCertFromBase64(arguments[0],'C,,');return true;",[base64.b64encode(fixture.ca).decode()]);prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];receipt['sandbox']=prefs;context(sid,'content')
   assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid);status(sid,'BRIDGE_MISSING')
   first=add(sid,'First fixture account');settle(sid,first,'HELD','USERSCRIPTS_PERMISSION_REQUIRED');assert not account(sid,first).get('personaUid') and fixture.receipt()['nativeCalls']==[]
   settings(sid);wait(lambda:script(sid,"return !!document.getElementById('allow-userscripts')"));click(sid,'#allow-userscripts');permission_choice(sid,True);wait(lambda:script(sid,"return !document.getElementById('allow-userscripts')"));page(sid,first);click(sid,'#account-repair');settle(sid,first,'HELD','MULLVAD_LOCAL_SERVICE_UNAVAILABLE');assert not account(sid,first).get('personaUid')
   receipt['checks'].append('real-Add/persist-before-setup/native-permission-control/missing-bridge/exact-account-holds/no-Persona')
   fixture.install_bridge(home,root);click(sid,'#account-repair');prepared=wait(lambda:next((a for a in inspect(sid)['accounts'] if a['id']==first and a.get('personaUid') and a['flow']['stage'] in ['SELECT','CREATE_ROUTE']),None),30);uid=prepared['personaUid'];click(sid,'#pause-core');wait(lambda:inspect(sid)['status']['paused']);prior=stop(sid,profile);sid=None;sid,_=account_session(binary,profile);assert not prior.intersection(pids(profile));toolbar(sid);dashboard(sid);page(sid,first);assert inspect(sid)['status']['paused'] and account(sid,first)['personaUid']==uid;click(sid,'#pause-core');settle(sid,first,'LOGIN_REQUIRED');assert account(sid,first)['personaUid']==uid and not account(sid,first).get('expectedPrincipal') and fixture.receipt()['reads']==[]
   receipt['checks'].append('actual-Pause-after-blocked-Persona/real-process-restart/same-enrollment-UID/actual-Resume/protected-login/not-Ready-before-Confirm')
   second=add(sid,'Second fixture account');settle(sid,second,'LOGIN_REQUIRED');assert account(sid,second)['personaUid']!=uid;login(sid,first,'first@fixture.test');original_tab=account(sid,first)['tabId'];wrong_tab=account(sid,second)['tabId']
   asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),a=await c.read('accounts',arguments[0]);await c.mutate([{table:'accounts',id:a.id,expectedRev:a.rev,refs:a.refs,value:{...a,tabId:arguments[1]}}],{step:'FIXTURE_WRONG_CONTEXT',result:'COMPLETE'});c.close();return true;",[first,wrong_tab]);click(sid,'#account-confirm');settle(sid,first,'HELD','ACCOUNT_CONTEXT_CHANGED');assert not account(sid,first).get('expectedPrincipal') and account(sid,second)['state']=='LOGIN_REQUIRED'
   asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),a=await c.read('accounts',arguments[0]);await c.mutate([{table:'accounts',id:a.id,expectedRev:a.rev,refs:a.refs,value:{...a,tabId:arguments[1]}}],{step:'FIXTURE_RESTORE_CONTEXT',result:'COMPLETE'});c.close();return true;",[first,original_tab]);wait(lambda:script(sid,"return !document.getElementById('account-confirm').disabled"));double_confirm(sid);ready=settle(sid,first,'READY');assert ready['routeObservedAt']>=ready['confirmedAt'] and ready['identityObservedAt']>=ready['confirmedAt'];assert len(fixture.receipt()['reads'])==1 and fixture.receipt()['reads'][0]['valid'];assert ready['principalLabel']=='first@fixture.test';assert 'disposable-session-' not in json.dumps(inspect(sid));before_open=ready['flow']['jobId'];wait(lambda:script(sid,"const b=document.getElementById('account-open');return b&&!b.hidden&&!b.disabled"));click(sid,'#account-open');dashboard(sid);wait(lambda:account(sid,first)['flow']['jobId']!=before_open);settle(sid,first,'READY');dashboard(sid);page(sid,first);assert account(sid,first)['tabId']==original_tab
   receipt['checks'].append('real-human-fixture-login/wrong-container-Confirm-rejected/other-account-usable/rapid-visible-double-Confirm/one-authenticated-read/post-Confirm-times/secret-safe-Core/exact-Open-Perchance')
   fixture.delay_next=True;third=add(sid,'Interrupted native fixture');unknown=wait(lambda:next((a for a in inspect(sid)['accounts'] if a['id']==third and a['flow']['stage']=='VERIFY' and ((a.get('work') or {}).get('effect') or {}).get('boundary')=='POSSIBLE' and any(x['command']=='prepare_exit' and x['routeId']==a.get('routeId') for x in fixture.receipt()['nativeCalls'])),None),45);route=unknown['routeId'];job=unknown['flow']['jobId'];third_uid=unknown['personaUid'];prior=stop(sid,profile);sid=None;sid,_=account_session(binary,profile);assert not prior.intersection(pids(profile));toolbar(sid);dashboard(sid);page(sid,third);settle(sid,third,'LOGIN_REQUIRED');after=account(sid,third);assert after['flow']['jobId']==job and after['personaUid']==third_uid;assert len([x for x in fixture.receipt()['nativeCalls'] if x['command']=='prepare_exit' and x['routeId']==route])==1;assert fixture.receipt()['unexpected']==[] and fixture.receipt()['catalogRequests']
   receipt['checks'].append('real-native-prepare-lost-response/process-restart/authenticated-same-operation-readback/one-native-prepare/same-Persona/no-external-provider-or-route-mutation')
   set_input(sid,'#account-search','Second fixture');wait(lambda:script(sid,"return document.querySelectorAll('#account-list a').length===1&&document.querySelector('#account-list a').textContent.includes('Second fixture')"));click(sid,'nav a[href="#home"]');page(sid);assert script(sid,"return document.getElementById('account-search').value")=='Second fixture';receipt['checks'].append('real-search-and-navigation/filter-draft-preserved');receipt['fixture']=fixture.receipt();receipt['result']='PASS';(OUT/'accounts.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')))
  except Exception as error:
   receipt['error']=str(error)
   if sid:
    try:receipt['state']=inspect(sid)
    except Exception:
     try:context(sid,'content');toolbar(sid);dashboard(sid);receipt['stateAfterDiagnosticReopen']=inspect(sid)
     except Exception:pass
    try:(OUT/'accounts-failure.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')))
    except Exception:pass
   receipt['fixture']=fixture.receipt();raise
  finally:
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();fixture.close();(OUT/'installed-accounts.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
