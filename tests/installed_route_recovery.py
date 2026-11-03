"""R03 installed negative gates: disposable native/SOCKS/HTTPS services only.

No clock or proof-cache edits. Browser restart invalidates the real donor proof.
The existing native host and all nonfixture network targets remain untouched.
"""
from installed_accounts import *
from installed_journal import journal,inspect as journal_state,read_zip
import account_fixture
from visual_capture import state_matrix

BaseProvider=account_fixture.Provider
class RouteProvider(BaseProvider):
 def do_GET(self):
  f=self.server.fixture;host=self.headers.get('Host','').split(':')[0]
  with f.lock:bad=self.route==f.bad_dns_route
  if bad and host.endswith('.dnsleak.am.i.mullvad.net'):
   with f.lock:f.rejected_dns.append({'routeId':self.route,'host':host})
   return self.send([{'ip':'9.9.9.9','mullvad_dns':False}])
  return super().do_GET()

class RouteFixture(Fixture):
 def __init__(self,root):
  self.bridge_down=False;self.bad_dns_route=None;self.rejected_dns=[]
  super().__init__(root)
 def native(self,message):
  with self.lock:down=self.bridge_down
  if down and message.get('command') in ['status','prepare_exit']:
   with self.lock:self.calls.append({'command':message['command'],'routeId':message.get('route_id'),'fixtureOutage':True})
   return {'ok':False,'error':'FIXTURE_BRIDGE_DOWN','ready':False,'interface_up':False,'base_route_bound':False,'base_proxy_reachable':False}
  return super().native(message)

account_fixture.Provider=RouteProvider

def tuple_of(a):
 return {k:a[k] for k in ['personaUid','containerId','routeId','expectedPrincipal','exitAddresses']}

def renew_ready(sid,id,previous):
 a=account(sid,id);flow=a.get('flow') or {};job=a.get('work') or {};proof=a.get('protection') or {}
 return a if (a['state']=='READY' and flow.get('purpose')=='RENEW' and flow.get('jobId')!=previous and job.get('id')==flow.get('jobId') and job['state']=='COMPLETE' and proof.get('state')=='VERIFIED' and a['routeObservedAt']>=flow['startedAt'] and proof.get('observedAt',0)>=flow['startedAt']) else None

def visible(sid,selector):
 return wait(lambda:script(sid,"const e=document.querySelector(arguments[0]);return !!e&&!e.hidden&&!e.disabled;",[selector]))

def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve();identity=json.loads((xpi.parent/'identity.json').read_text());assert not identity['dirty'];assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
 receipt={'tier':'B/DSK-R03-native-outage-DNS-isolation-and-principal','source':identity['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]};assert receipt['xpiSha256']==identity['xpiSha256']
 with tempfile.TemporaryDirectory(prefix='pcms-route-negative-') as tmp:
  root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();home=root/'home';home.mkdir();disk=root/'downloads';disk.mkdir();fixture=RouteFixture(root);fixture.start_catalog();fixture.install_bridge(home,root);remote_before=fixture.receipt()['remoteInventory']
  env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'};log=open(OUT/'route-recovery-driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None
  try:
   wait(driver_ready,15);sid,caps=account_session(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'));assert int(caps['browserVersion'].split('.')[0])>=155 and caps['acceptInsecureCerts'] is False
   context(sid,'chrome');script(sid,"Components.classes['@mozilla.org/security/x509certdb;1'].getService(Components.interfaces.nsIX509CertDB).addCertFromBase64(arguments[0],'C,,');Services.prefs.setStringPref('browser.download.dir',arguments[1]);Services.prefs.setIntPref('browser.download.folderList',2);Services.prefs.setBoolPref('browser.download.useDownloadDir',true);return true;",[base64.b64encode(fixture.ca).decode(),str(disk)]);prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];receipt['sandbox']=prefs;context(sid,'content')
   assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid);settings(sid);visible(sid,'#allow-userscripts');click(sid,'#allow-userscripts');permission_choice(sid,True);wait(lambda:script(sid,"return !document.getElementById('allow-userscripts')"))
   owners=[];original={}
   for n in [1,2]:
    id=add(sid,'Route negative '+str(n));settle(sid,id,'LOGIN_REQUIRED');login(sid,id,'route-'+str(n)+'@fixture.test');visible(sid,'#account-confirm');click(sid,'#account-confirm');a=settle(sid,id,'READY');owners.append(id);original[id]=tuple_of(a)
   assert len({v['containerId'] for v in original.values()})==2 and len({v['routeId'] for v in original.values()})==2 and len({json.dumps(v['exitAddresses']) for v in original.values()})==2
   containers=asyncjs(sid,"return (await browser.contextualIdentities.query({})).map(c=>c.cookieStoreId).sort();")
   previous={id:account(sid,id)['flow']['jobId'] for id in owners};old=stop(sid,profile);sid=None
   with fixture.lock:fixture.bridge_down=True
   sid,_=account_session(binary,profile);assert not old.intersection(pids(profile));toolbar(sid);dashboard(sid);page(sid)
   held=wait(lambda:(lambda rows:rows if len(rows)==2 else None)([a for a in inspect(sid)['accounts'] if a['id'] in owners and a['state']=='HELD' and a.get('holdCode') and a['flow']['purpose']=='RENEW']),100)
   assert all(tuple_of(a)==original[a['id']] for a in held);receipt['nativeOutageCodes']=sorted({a['holdCode'] for a in held});assert all(a.get('protection',{}).get('state')!='VERIFIED' for a in held)
   with fixture.lock:fixture.bridge_down=False
   # No Repair/Verify/Open click: the original automatic protection workflow
   # must wake from its real bounded deadline and recover both identities.
   recovered={id:wait(lambda id=id:renew_ready(sid,id,previous[id]),180) for id in owners};assert all(tuple_of(a)==original[id] for id,a in recovered.items())
   assert asyncjs(sid,"return (await browser.contextualIdentities.query({})).map(c=>c.cookieStoreId).sort();")==containers
   receipt['checks'].append('two-real-UI-enrollments/post-Confirm-distinct-principals-containers-exits/real-process-restart/native-outage/fail-closed-typed-holds/automatic-deadline-recovery/no-Repair-Verify-click/no-new-Persona-or-route')
   previous={id:account(sid,id)['flow']['jobId'] for id in owners};old=stop(sid,profile);sid=None
   with fixture.lock:fixture.bad_dns_route=original[owners[0]]['routeId']
   sid,_=account_session(binary,profile);assert not old.intersection(pids(profile));toolbar(sid);dashboard(sid);page(sid)
   dns=wait(lambda:(lambda a:a if a['state']=='HELD' and a.get('holdCode')=='DNS_LEAK_DETECTED' else None)(account(sid,owners[0])),100);assert tuple_of(dns)==original[owners[0]]
   good=wait(lambda:renew_ready(sid,owners[1],previous[owners[1]]),100);assert tuple_of(good)==original[owners[1]] and fixture.rejected_dns
   page(sid,owners[0]);wait(lambda:script(sid,"return document.getElementById('account-state')?.textContent.startsWith('Needs attention')"));state_matrix(sid,'account-dns-proof-held',receipt)
   with fixture.lock:fixture.bad_dns_route=None
   # A real DNS protection failure remains an explicit hold. Its contextual
   # Repair route action must prove the same binding afresh before admission;
   # restoring the fixture alone must not turn the failed proof into success.
   assert account(sid,owners[0])['holdCode']=='DNS_LEAK_DETECTED'
   page(sid,owners[0]);visible(sid,'#account-repair');click(sid,'#account-repair');dashboard(sid);repaired=settle(sid,owners[0],'READY');assert tuple_of(repaired)==original[owners[0]] and repaired['routeObservedAt']>dns['routeObservedAt']
   receipt['checks'].append('second-real-process-restart/one-route-DNS-rejection/other-account-verified/unchanged-tuple/explicit-DNS-hold/contextual-Repair-fresh-proof/no-Direct')
   login(sid,owners[0],'changed-principal@fixture.test');visible(sid,'#account-open');click(sid,'#account-open');dashboard(sid);changed=settle(sid,owners[0],'HELD','ACCOUNT_PRINCIPAL_CHANGED');assert tuple_of(changed)==original[owners[0]] and account(sid,owners[1])['state']=='READY'
   page(sid,owners[0]);wait(lambda:script(sid,"return document.getElementById('account-state')?.textContent.includes('differs from this account')"));state_matrix(sid,'account-changed-principal-held',receipt)
   assert fixture.receipt()['remoteInventory']==remote_before and fixture.receipt()['unexpected']==[]
   receipt['checks'].append('real-human-login-change/actual-Open-identity-check/principal-mismatch-held/no-silent-rebind/other-account-usable/remote-source-unchanged')
   journal(sid);before={f['id'] for f in journal_state(sid)['files']};click(sid,'#export-journal');export=wait(lambda:next((f for f in journal_state(sid)['files'] if f['id'] not in before and f['state']=='COMPLETE'),None),60);path=disk/export['filename'];manifest,events=read_zip(path);codes={e.get('code') for e in events};assert 'DNS_LEAK_DETECTED' in codes and 'ACCOUNT_PRINCIPAL_CHANGED' in codes and any(c in codes for c in receipt['nativeOutageCodes'])
   import zipfile
   with zipfile.ZipFile(path) as z:
    for name in z.namelist():
     raw=z.read(name);assert all(u['sessionToken'].encode() not in raw for u in fixture.logins.values())
   receipt['journal']={'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'first':manifest['first'],'last':manifest['last'],'faultCodes':sorted(c for c in codes if c)};receipt['checks'].append('default-Journal/actual-Export/independent-disk-CRC-range-hashes/original-native-DNS-principal-causes/no-session-token');receipt['result']='PASS'
  except Exception as error:
   receipt['error']=str(error)
   if sid:
    try:dashboard(sid);receipt['accounts']=inspect(sid);receipt['page']=script(sid,"return document.body.innerText")
    except Exception:pass
   raise
  finally:
   receipt['fixture']=fixture.receipt();receipt['dnsRejects']=fixture.rejected_dns
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();fixture.close();(OUT/'installed-route-recovery.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)

if __name__=='__main__':main()
