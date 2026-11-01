"""P33 B/DSK: real production File/restore, fresh contexts and checked cut.
Only disposable local provider/bridge/session fixtures; archives stay in tmpdir.
"""
from installed_restore import restore,select_archive,confirm,check_restore,census,initialize,allow,unrelated,assert_unrelated
from installed_backup_export import setup_model,request_export,completed,file_receipt,read_archive
from installed_backup_sessions import backup_page,manage,configure_auth,inspect_paused
from installed_accounts import account_session,add,settle,login,account,page
from installed_packages import *
import account_fixture as af

OriginalProvider=af.Provider
class RestoreProvider(OriginalProvider):
 def send(self,value,kind='application/json',status=200):
  if kind=='text/html' and isinstance(value,bytes):
   value=b"""<script>const first={app:JSON.parse(localStorage.getItem('app-storage')),guard:localStorage.getItem('sessionTokenLastChangeTime')};fetch('/fixture/first',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(first)});</script>"""+value
  return super().send(value,kind,status)
 def do_POST(self):
  f=self.server.fixture
  if self.path=='/fixture/first':
   body=self.body()
   with f.lock:f.first.setdefault(self.route,[]).append(body)
   return self.send({'ok':True})
  if self.path=='/api/getGeneratorsByUser':
   body=self.body()
   with f.lock:
    valid=not f.reject and any(body.get('email')==a['email'] and body.get('sessionToken')==a['sessionToken'] for a in f.logins.values());f.reads.append({'routeId':self.route,'valid':bool(valid)})
   return self.send({'status':'success','generators':[{'name':'remote-sentinel','isPrivate':True}],'generatorFolderMap':{}} if valid else {'status':'session-token-error'})
  return super().do_POST()
af.Provider=RestoreProvider

def complete(sid):
 def inspect():
  v=restore(sid);c=v['control']
  if c['state']=='COMPLETE':return v
  if v['job']['state'] in ['HELD','FAILED']:raise AssertionError(('RESTORE_HELD',c['state'],c.get('code'),v['job'].get('recovery')))
 return wait(inspect,240)

def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve();identity=json.loads((xpi.parent/'identity.json').read_text());assert not identity['dirty'];assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
 receipt={'tier':'B/DSK-production-restore-activation','source':identity['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]};assert receipt['xpiSha256']==identity['xpiSha256']
 with tempfile.TemporaryDirectory(prefix='pcms-restore-active-') as tmp:
  root=pathlib.Path(tmp);profile=root/'source';profile.mkdir();home=root/'home';home.mkdir();disk=root/'downloads';disk.mkdir();fixture=af.Fixture(root);fixture.first={};fixture.reject=False;fixture.start_catalog();fixture.install_bridge(home,root)
  env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'};log=open(OUT/'driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None
  try:
   wait(driver_ready,15);sid,caps=account_session(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'));assert int(caps['browserVersion'].split('.')[0])>=155 and caps['acceptInsecureCerts'] is False;receipt['sandbox']=initialize(sid,fixture,disk)
   assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid);allow(sid)
   source_id=add(sid,'Portable synthetic restore');settle(sid,source_id,'LOGIN_REQUIRED');login(sid,source_id,'restore@fixture.test');click(sid,'#account-confirm');settle(sid,source_id,'READY');a=account(sid,source_id)
   token='synthetic-portable-'+chr(0)+'雪';configure_auth(sid,source_id,token)
   with fixture.lock:fixture.logins[a['routeId']]['sessionToken']=token
   model=setup_model(sid,[source_id]);manage(sid,'pcms-journal','DISABLE');click(sid,'#pause-core');wait(lambda:inspect_paused(sid));backup_page(sid);export=request_export(sid);assert completed(sid,export['jobId'])['state']=='COMPLETE';f=file_receipt(sid,export['jobId']);path=disk/f['filename'];manifest,values,blobs=read_archive(path);archive_hash=hashlib.sha256(path.read_bytes()).hexdigest()
   # This synthetic Possible write has no independent completion receipt.
   # The real same-profile restore must stop before touching native bindings.
   baseline=census(sid);before=restore(sid)['root']['dataset'];select_archive(sid,path);confirm(sid);wait(lambda:restore(sid)['control'].get('code')=='RESTORE_PREVIOUS_WRITE_UNRESOLVED',30);assert census(sid)==baseline and restore(sid)['root']['dataset']==before
   receipt['checks'].append('actual-production-disk-archive/CRC-all-entry-hashes/same-profile-unresolved-write-held-before-native-change/no-false-resolution')
   for rejected in [False,True]:
    prior=stop(sid,profile);sid=None;profile=root/('rejected' if rejected else 'fresh');profile.mkdir();fixture.reject=rejected;sid,_=account_session(binary,profile);assert not prior.intersection(pids(profile));initialize(sid,fixture,disk);assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid);allow(sid);backup_page(sid)
    unrelated_id=unrelated(sid,'Unrelated restore sentinel');baseline=census(sid);before=restore(sid)['root']['dataset'];select_archive(sid,path);confirm(sid);v=complete(sid);c=v['control'];p=c['participants'][0];mapping=c['mappings'][0]
    assert v['root']['dataset']==c['newDataset'] and v['root']['dataset']!=before and v['root']['paused'] and not v['root'].get('restoreHold');assert mapping['allocationReceipt']['fresh'] and mapping['destinationContainerId'] not in baseline and len(census(sid))==len(baseline)+1;assert p['local']['state']=='IMPORTED' and p['route']['state']=='VALIDATED' and p['login']['state']==('HELD' if rejected else 'VALIDATED')
    aa=account(sid,source_id);assert aa['containerId']==mapping['destinationContainerId'] and aa['state']==('LOGIN_REQUIRED' if rejected else 'READY') and aa['flow']['stage']==aa['state']
    actual=asyncjs(sid,"""const {openCore,sha256}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),r=await c.status(),control=await c.restore.read(),a=await c.read('accounts',arguments[0]),g=await c.read('generators','backup-source'),j=await c.read('jobs','possible-save'),draft=await c.view('fixture-draft'),modules=await c.list({table:'modules'}),bytes=await c.bytes(arguments[1]),cookies=await browser.cookies.getAll({storeId:a.containerId}),regs=await browser.userScripts.getScripts();c.close();return {digest:await sha256(bytes),bytes:bytes.length,draft:draft.draft,source:g.sourceManifest===arguments[2]&&g.previousGood===arguments[3],job:j.state==='HELD'&&j.effect.operationId==='possible-original'&&j.effect.boundary==='POSSIBLE'&&j.runtimeInvalidated&&!j.lease,cookie:cookies.some(v=>v.name==='backup-cookie'&&v.value==='synthetic-cookie-sentinel'&&v.httpOnly&&v.secure&&v.sameSite==='strict'),modules:modules.rows.length,enabled:modules.rows.filter(m=>m.enabled).length,registrations:regs.filter(s=>s.id.startsWith('pcms-restore-')).length};""",[source_id,model['binary'],model['current'],model['old']])
    assert actual=={'digest':model['binary'],'bytes':1048601,'draft':'retained human draft 雪','source':True,'job':True,'cookie':True,'modules':7,'enabled':6,'registrations':0},actual
    with fixture.lock:first=fixture.first[p['routeId']][-1]
    assert first['app']['user']['sessionToken']==token and first['guard'] is not None
    assert_unrelated(sid,unrelated_id);wait(lambda:'Extension data restored' in script(sid,"return document.getElementById('backup-restore-state').textContent"),20);assert 'sessionToken' not in script(sid,"return document.getElementById('records').textContent")
    receipt['checks'].append(('rejected' if rejected else 'valid')+'-session/real-File-Confirm/fresh-map/early-first-site-script-exact-NUL-auth/actual-cookie-attributes/active-binary-history-draft/packages-disable-Pause/possible-source-job-held/registration-removed/unrelated-preserved/separate-login-route-work-report')
    if rejected:
     fixture.reject=False;click(sid,'#pause-core');wait(lambda:not inspect_paused(sid));page(sid,source_id);login(sid,source_id,'restore@fixture.test');click(sid,'#account-confirm')
     wait(lambda:account(sid,source_id)['state']=='READY' and account(sid,source_id)['flow']['stage']=='READY',75);assert account(sid,source_id)['containerId']==mapping['destinationContainerId'];receipt['checks'].append('actual-rejected-session/Complete-login/Confirm/same-mapped-Persona/fresh-independent-identity/no-automatic-source-replay')
   assert hashlib.sha256(path.read_bytes()).hexdigest()==archive_hash and fixture.receipt()['unexpected']==[];receipt['result']='PASS'
  except Exception as error:
   receipt['error']=str(error)
   if sid:
    try:
     v=restore(sid);receipt['diagnostic']={'state':v['control']['state'] if v['control'] else None,'code':v['control'].get('code') if v['control'] else None,'job':v['job']}
    except Exception:pass
   print(json.dumps(receipt),flush=True);raise
  finally:
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();fixture.close();(OUT/'installed-restore-activation.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
