"""P32 B/DSK: production disk archive/File UI, actual fresh Personas,
process interruptions, inactive generation and verified donor rollback.
Only synthetic disposable provider/bridge data; archives never leave tmpdir.
"""
from installed_backup_export import read_archive,setup_model,request_export,completed,file_receipt
from installed_backup_sessions import backup_page,coverage,manage,inspect_paused
from installed_accounts import account_session,add,settle,login,account
from installed_lifecycle import permission_choice
from installed_packages import *
from account_fixture import Fixture

def restore(sid):
 return asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),r=await c.status(),s=await c.restore.read(),j=s?.jobId?await c.read('jobs',s.jobId):null;c.close();return {root:r,control:s,job:j?{id:j.id,state:j.state,recovery:j.recovery,effect:j.effect,effects:j.effects}:null};")
def select_archive(sid,path):
 e=call('POST',f'/session/{sid}/element',{'using':'css selector','value':'#backup-restore-file'})['element-6066-11e4-a52e-4f735466cecf']
 call('POST',f'/session/{sid}/element/{e}/value',{'text':str(path)})
 click(sid,'#backup-restore-preview')
 return wait(lambda:next((v for v in [restore(sid)['control']] if v and v['state']=='PREVIEW'),None),120)
def confirm(sid):
 wait(lambda:script(sid,"return !document.getElementById('backup-restore-confirmed').disabled"),15)
 click(sid,'#backup-restore-confirmed');wait(lambda:script(sid,"return !document.getElementById('backup-restore-confirm').disabled"));click(sid,'#backup-restore-confirm')
 return wait(lambda:next((v for v in [restore(sid)['control']] if v and v.get('confirmedAt')),None),30)
def check_restore(sid):
 wait(lambda:script(sid,"return !document.getElementById('backup-restore-check').disabled"),20);click(sid,'#backup-restore-check')
def staged(sid):
 def inspect():
  v=restore(sid)
  if v['control']['state']=='STAGED':return v
  if v['job']['state'] in ['HELD','FAILED']:raise AssertionError(('RESTORE_HELD',v['control']['state'],v['control'].get('code'),v['job'].get('recovery')))
 return wait(inspect,180)
def donor_state(sid):
 return asyncjs(sid,"const s=(await browser.storage.local.get('state')).state;delete s.__stateMeta;return s;")
def census(sid):return asyncjs(sid,"return (await browser.contextualIdentities.query({})).map(c=>c.cookieStoreId);")
def arm_stop(sid,phase):
 # Pause the next actual donor storage read only after the preceding durable
 # control checkpoint. The native allocation/commit has already happened.
 return asyncjs(sid,"""const bg=await browser.runtime.getBackgroundPage(),put=bg.IDBObjectStore.prototype.put,get=bg.browser.storage.local.get;bg.__P32_POINT=false;bg.__P32_BLOCKED=false;const phase=arguments[0];bg.IDBObjectStore.prototype.put=function(row){const r=put.call(this,row);if(this.name==='meta'&&row.key==='restore-control'&&row.state===phase)bg.__P32_POINT=true;return r;};bg.browser.storage.local.get=function(...args){if(bg.__P32_POINT){bg.__P32_BLOCKED=true;return new Promise(()=>{});}return get.apply(this,args);};return true;""",[phase])
def unrelated(sid,label):
 return asyncjs(sid,"const c=await browser.contextualIdentities.create({name:arguments[0],color:'purple',icon:'circle'});await browser.cookies.set({storeId:c.cookieStoreId,url:'https://example.org/',name:'sentinel',value:'unrelated-exact',secure:true});return c.cookieStoreId;",[label])
def assert_unrelated(sid,id):
 assert asyncjs(sid,"return (await browser.contextualIdentities.query({})).some(c=>c.cookieStoreId===arguments[0])&&(await browser.cookies.getAll({storeId:arguments[0]})).some(c=>c.name==='sentinel'&&c.value==='unrelated-exact');",[id])
def inspect_staged(sid,source_id,model,baseline,previous_dataset):
 return asyncjs(sid,"""const {openCore,sha256,req}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),s=await c.restore.read(),r=await c.status(),m=s.mappings.find(m=>m.accountId===arguments[0]);if(!m)throw Error('MAPPING_MISSING');const blob=await c.readBlob(arguments[1],{dataset:s.newDataset}),digest=await sha256(new Uint8Array(await blob.arrayBuffer())),db=await new Promise((resolve,reject)=>{const q=indexedDB.open('pcms-core');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);}),t=db.transaction(['accounts','generators','jobs','modules','views'],'readonly'),get=(table,id)=>req(t.objectStore(table).get([s.newDataset,id])),a=await get('accounts',arguments[0]),g=await get('generators','backup-source'),j=await get('jobs','possible-save'),modules=await req(t.objectStore('modules').index('dataset').getAll(IDBKeyRange.only(s.newDataset))),draft=await get('views','fixture-draft');db.close();const native=(await browser.storage.local.get('state')).state,p=native.profiles[m.destinationContainerId];c.close();return {active:r.dataset,hold:r.restoreHold?.id===s.id,destination:m.destinationContainerId,fresh:m.allocationReceipt.fresh&&!m.baseline.includes(m.destinationContainerId),baseline:m.baseline,sourceContainer:m.sourceContainerId,digest,bytes:blob.size,accountHeld:a.state==='HELD'&&!a.tabId,source:g.sourceManifest===arguments[2]&&g.previousGood===arguments[3],jobHeld:j.state==='HELD'&&j.effect.boundary==='POSSIBLE'&&!j.lease,modules:modules.length,enabled:modules.filter(m=>m.enabled).length,draft:draft.draft==='retained human draft 雪',native:p.personaUid===m.personaUid&&p.pcmsAccountId===m.accountId&&p.routeId==='__block__'&&p.killSwitch&&p.blockLocalNetwork};""",[source_id,model['binary'],model['current'],model['old']])
def rollback(sid,old_state,old_dataset,unrelated_id):
 wait(lambda:script(sid,"return !document.getElementById('backup-restore-rollback').disabled"),20);click(sid,'#backup-restore-rollback')
 def done():
  v=restore(sid)
  if v['control']['state']=='ROLLED_BACK':return v
  if v['job']['state'] in ['HELD','FAILED'] and v['control'].get('wantRollback') and v['control'].get('code'):raise AssertionError(('ROLLBACK_HELD',v['control']['state'],v['control'].get('code')))
 v=wait(done,120);assert v['root']['dataset']==old_dataset and not v['root'].get('restoreHold');assert donor_state(sid)==old_state,'ORIGINAL_NATIVE_BINDINGS_NOT_RESTORED';assert_unrelated(sid,unrelated_id)
def initialize(sid,fixture,disk):
 context(sid,'chrome');script(sid,"Components.classes['@mozilla.org/security/x509certdb;1'].getService(Components.interfaces.nsIX509CertDB).addCertFromBase64(arguments[0],'C,,');Services.prefs.setStringPref('browser.download.dir',arguments[1]);Services.prefs.setIntPref('browser.download.folderList',2);Services.prefs.setBoolPref('browser.download.useDownloadDir',true);return true;",[base64.b64encode(fixture.ca).decode(),str(disk)])
 prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];context(sid,'content');return prefs
def allow(sid):
 settings(sid);wait(lambda:script(sid,"return !!document.getElementById('allow-userscripts')"));click(sid,'#allow-userscripts');permission_choice(sid,True);wait(lambda:script(sid,"return !document.getElementById('allow-userscripts')"))
def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve();identity=json.loads((xpi.parent/'identity.json').read_text());assert not identity['dirty'];assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
 receipt={'tier':'B/DSK-production-staged-restore','source':identity['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]};assert receipt['xpiSha256']==identity['xpiSha256']
 with tempfile.TemporaryDirectory(prefix='pcms-restore-') as tmp:
  root=pathlib.Path(tmp);profile=root/'same';profile.mkdir();home=root/'home';home.mkdir();disk=root/'downloads';disk.mkdir();fixture=Fixture(root);fixture.start_catalog();fixture.install_bridge(home,root)
  env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'};log=open(OUT/'driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None
  try:
   wait(driver_ready,15);sid,caps=account_session(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'));assert int(caps['browserVersion'].split('.')[0])>=155 and caps['acceptInsecureCerts'] is False;receipt['sandbox']=initialize(sid,fixture,disk)
   assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid);allow(sid)
   source_id=add(sid,'Restore source');settle(sid,source_id,'LOGIN_REQUIRED');login(sid,source_id,'restore@fixture.test');click(sid,'#account-confirm');settle(sid,source_id,'READY')
   model=setup_model(sid,[source_id]);manage(sid,'pcms-journal','DISABLE');click(sid,'#pause-core');wait(lambda:inspect_paused(sid));backup_page(sid);export=request_export(sid);assert completed(sid,export['jobId'])['state']=='COMPLETE';f=file_receipt(sid,export['jobId']);path=disk/f['filename'];read_archive(path);archive_hash=hashlib.sha256(path.read_bytes()).hexdigest();assert archive_hash==f['sha256']
   receipt['checks'].append('actual-production-Back-up-now/Core-Downloads/disk-CRC-all-entry-hashes/credential-inclusive-file-kept-only-in-disposable-tmpdir')
   # A real protected-origin human editor is inspected and preserved. Only
   # an explicit user Save in this controlled document allows us to close it.
   editor=asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),a=await c.read('accounts',arguments[0]);c.close();return (await browser.tabs.create({cookieStoreId:a.containerId,url:'https://perchance.org/human-review#edit',active:false})).id;",[source_id])
   wait(lambda:asyncjs(sid,"return (await browser.tabs.get(arguments[0])).status==='complete';",[editor]))
   asyncjs(sid,"await browser.scripting.executeScript({target:{tabId:arguments[0]},world:'ISOLATED',func:()=>{document.body.innerHTML='<textarea id=\"restore-human\"></textarea><button id=\"restore-human-save\">Save fixture draft</button>';document.getElementById('restore-human-save').onclick=()=>localStorage.setItem('fixture-human-saved',document.getElementById('restore-human').value);}});return true;",[editor])
   for h in call('GET',f'/session/{sid}/window/handles'):
    call('POST',f'/session/{sid}/window',{'handle':h})
    if script(sid,"return location.href")=='https://perchance.org/human-review#edit':break
   type_text(sid,'#restore-human','Human exact unsaved draft 雪');dashboard(sid);backup_page(sid);baseline=census(sid);old_dataset=restore(sid)['root']['dataset'];preview=select_archive(sid,path);assert preview['summary']['credentialInclusive'] and preview['summary']['records']['accounts']==1
   confirm(sid);wait(lambda:restore(sid)['control'].get('code')=='RESTORE_EDITOR_INSPECTION_REQUIRED',30);assert census(sid)==baseline and restore(sid)['root']['dataset']==old_dataset
   wait(lambda:script(sid,"return !!document.querySelector('[data-restore-inspect]')"));click(sid,'[data-restore-inspect]')
   for h in call('GET',f'/session/{sid}/window/handles'):
    call('POST',f'/session/{sid}/window',{'handle':h})
    if script(sid,"return location.href")=='https://perchance.org/human-review#edit':break
   assert script(sid,"return document.getElementById('restore-human').value")=='Human exact unsaved draft 雪';click(sid,'#restore-human-save');assert script(sid,"return localStorage.getItem('fixture-human-saved')")=='Human exact unsaved draft 雪';call('DELETE',f'/session/{sid}/window');dashboard(sid);backup_page(sid)
   receipt['checks'].append('actual-human-editor-gate/no-container-allocation/exact-context-Inspect/unsaved-text-preserved/explicit-human-Save-and-close')
   for label,phase in [('same','DONOR_PLAN'),('fresh','DONOR_STORAGE')]:
    if label=='fresh':
     prior=stop(sid,profile);sid=None;profile=root/'fresh';profile.mkdir();sid,caps2=account_session(binary,profile);assert not prior.intersection(pids(profile));initialize(sid,fixture,disk);assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid);allow(sid);backup_page(sid);old_dataset=restore(sid)['root']['dataset'];preview=select_archive(sid,path)
    unrelated_id=unrelated(sid,'Unrelated '+label);baseline=census(sid);old_state=donor_state(sid);arm_stop(sid,phase)
    if label=='same':check_restore(sid)
    else:confirm(sid)
    wait(lambda:asyncjs(sid,"return (await browser.runtime.getBackgroundPage()).__P32_BLOCKED;"),100);interrupted=restore(sid);assert interrupted['control']['state']==phase;maps=interrupted['control']['mappings'];assert len(maps)==1 and maps[0]['destinationContainerId'] not in baseline;assert interrupted['root']['dataset']==old_dataset and interrupted['root']['restoreHold'];assert len(census(sid))==len(baseline)+1
    if label=='fresh':
     actual=donor_state(sid);assert actual['profiles'][maps[0]['destinationContainerId']]['personaUid']==maps[0]['personaUid']
    prior=stop(sid,profile);sid=None;sid,_=account_session(binary,profile);assert not prior.intersection(pids(profile));toolbar(sid);dashboard(sid);backup_page(sid);reopened=restore(sid);assert reopened['control']['mappings']==maps and reopened['root']['dataset']==old_dataset
    if reopened['job']['state'] in ['HELD','FAILED']:check_restore(sid)
    v=staged(sid);assert v['control']['code']=='RESTORE_AUTH_IMPORT_PENDING';result=inspect_staged(sid,source_id,model,baseline,old_dataset);assert result['active']==old_dataset and result['hold'] and result['fresh'] and result['bytes']==1048601 and result['digest']==model['binary'] and result['accountHeld'] and result['source'] and result['jobHeld'] and result['modules']==7 and result['draft'] and result['native'],result;assert census(sid).count(maps[0]['destinationContainerId'])==1 and len(census(sid))==len(baseline)+1;assert_unrelated(sid,unrelated_id)
    assert script(sid,"return document.getElementById('backup-export').disabled");assert 'are staged' in script(sid,"return document.getElementById('backup-restore-state').textContent");assert 'sessionToken' not in script(sid,"return document.getElementById('records').textContent")
    rollback(sid,old_state,old_dataset,unrelated_id);assert len(census(sid))==len(baseline)+1
    if label=='same':
     assert account(sid,source_id)['state']=='HELD' and account(sid,source_id)['holdCode']=='RESTORE_ROLLBACK_ROUTE_RECHECK'
     assert asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),v=await c.view('fixture-draft');c.close();return v.draft;")=='retained human draft 雪'
    receipt['checks'].append(label+'-profile/real-File-and-Confirm/actual-fresh-blocked-Persona/'+phase+'-process-stop/durable-map-and-prior-cut/cold-resume/no-duplicate/verified-inactive-source-binary-history-draft-jobs-module-rows/actual-rollback/original-native-binding-readback/unrelated-cookie-preserved')
   assert hashlib.sha256(path.read_bytes()).hexdigest()==archive_hash and fixture.receipt()['unexpected']==[];receipt['result']='PASS'
  except Exception as error:
   receipt['error']=str(error)
   if sid:
    try:
     v=restore(sid);receipt['diagnostic']={'state':v['control']['state'] if v['control'] else None,'code':v['control'].get('code') if v['control'] else None,'job':v['job']}
    except Exception:pass
    try:(OUT/'restore-failure.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')))
    except Exception:pass
   print(json.dumps(receipt),flush=True);raise
  finally:
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();fixture.close();(OUT/'installed-restore.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
