"""P29 B: real packaged immutable capture and checked Core/donor/session join.
Synthetic protected service/storage only; no external provider or live bridge.
"""
from installed_backup_sessions import backup_page,coverage,manage,configure_auth
from installed_accounts import account_session,add,settle,login,account,page as account_page
from installed_lifecycle import permission_choice
from installed_packages import *
from account_fixture import Fixture
import io,threading,account_fixture

class CaptureProvider(account_fixture.Provider):
 def do_GET(self):
  f=self.server.fixture
  if self.headers.get('Host','').split(':')[0]=='perchance.org' and self.path=='/' and f.hold_route==self.route:
   f.witness_waiting.set();f.release_witness.wait(10)
  return super().do_GET()
account_fixture.Provider=CaptureProvider

def current(sid):return coverage(sid)['capture']['current']
def prepare(sid,wait_done=True):
 before=(current(sid) or {}).get('jobId');click(sid,'#backup-capture');j=wait(lambda:next((s for s in [current(sid)] if s and s['jobId']!=before),None),30)
 return wait(lambda:next((s for s in [current(sid)] if s and s['jobId']==j['jobId'] and s['state'] in ['COMPLETE','INCOMPLETE']),None),180) if wait_done else j
def private_cut(sid,id):
 return asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),j=await c.read('jobs',arguments[0]),raw=await c.credentials.get(j.fullCapture.receipt.credentialId);c.close();return raw;",[id])
def inspect_job(sid,id):
 return asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),j=await c.read('jobs',arguments[0]);c.close();return {phase:j.fullCapture?.phase,cursor:j.fullCapture?.cursor,round:j.fullCapture?.round,state:j.state};",[id])
def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve();identity=json.loads((xpi.parent/'identity.json').read_text());assert not identity['dirty'];assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
 receipt={'tier':'B/installed-immutable-capture-and-protected-session-provenance','source':identity['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]};assert receipt['xpiSha256']==identity['xpiSha256']
 with tempfile.TemporaryDirectory(prefix='pcms-capture-') as tmp:
  root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();home=root/'home';home.mkdir();fixture=Fixture(root);fixture.hold_route=None;fixture.witness_waiting=threading.Event();fixture.release_witness=threading.Event();fixture.start_catalog();fixture.install_bridge(home,root)
  env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'};log=open(OUT/'driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None
  try:
   wait(driver_ready,15);sid,caps=account_session(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'));assert int(caps['browserVersion'].split('.')[0])>=155 and caps['acceptInsecureCerts'] is False;context(sid,'chrome')
   script(sid,"Components.classes['@mozilla.org/security/x509certdb;1'].getService(Components.interfaces.nsIX509CertDB).addCertFromBase64(arguments[0],'C,,');return true;",[base64.b64encode(fixture.ca).decode()]);prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];receipt['sandbox']=prefs;context(sid,'content')
   assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid);settings(sid);wait(lambda:script(sid,"return !!document.getElementById('allow-userscripts')"));click(sid,'#allow-userscripts');permission_choice(sid,True);wait(lambda:script(sid,"return !document.getElementById('allow-userscripts')"));ids=[]
   for label,email in [('First immutable capture','capture1@fixture.test'),('Second immutable capture','capture2@fixture.test')]:
    id=add(sid,label);settle(sid,id,'LOGIN_REQUIRED');login(sid,id,email);click(sid,'#account-confirm');settle(sid,id,'READY');ids.append(id)
   with zipfile.ZipFile(xpi) as outer:
    with zipfile.ZipFile(io.BytesIO(outer.read('bundled/pcms-accounts.zip'))) as package:payload={name:package.read(name) for name in package.namelist()}
   manifest=json.loads(payload['module.json']);manifest['version']='0.4.0';payload['module.json']=json.dumps(manifest).encode();update=root/'accounts-update.zip'
   with zipfile.ZipFile(update,'w',compression=zipfile.ZIP_DEFLATED) as package:
    for name,value in payload.items():package.writestr(name,value)
   settings(sid);select(sid,update);click(sid,'#install-module');wait(lambda:'Update staged.' in script(sid,"return document.getElementById('import-result').textContent"))
   model=asyncjs(sid,"""const {openCore}=await import(browser.runtime.getURL('core/records.mjs'));const c=await openCore(),old=await c.source([{path:'main.pjs',bytes:new TextEncoder().encode('previous exact 雪'+String.fromCharCode(13,10))},{path:'index.html',bytes:new TextEncoder().encode('<p>previous</p>')},{path:'src/binary.bin',bytes:Uint8Array.from({length:1048601},(_,i)=>i%251)}]),next=await c.source([{path:'main.pjs',bytes:new TextEncoder().encode('current source')},{path:'index.html',bytes:new TextEncoder().encode('<p>current</p>')}]);await c.mutate([{table:'generators',id:'captured-generator',value:{slug:'captured-generator',sourceManifest:next.manifestId,previousGood:old.manifestId,writerHold:{jobId:'retained-possible',reason:'FIXTURE'}},refs:[...old.refs,...next.refs]},{table:'jobs',id:'retained-possible',value:{moduleId:'pcms-deployer',generation:1,targetId:'captured-generator',kind:'FIXTURE_POSSIBLE',state:'HELD',recovery:{action:'INSPECT',code:'OUTCOME_UNKNOWN'},effect:{kind:'PERCHANCE_SAVE',operationId:'retained-operation',boundary:'POSSIBLE'},input:{pinned:'synthetic'}}}],{step:'FIXTURE_CAPTURE_SOURCE',result:'COMPLETE'});await c.releasePin(old.pinId);await c.releasePin(next.pinId);await c.credentials.set('fixture-credential','exact-secret-'+String.fromCharCode(0)+'雪');await c.saveView('fixture-draft',{draft:'retained human draft 雪'},crypto.randomUUID());await browser.storage.local.set({fixtureDonorOwned:{settings:'donor-settings-sentinel',credential:'donor-secret-sentinel',bytes:[0,255,3]}});const a=await c.read('accounts',arguments[0]);await browser.cookies.set({storeId:a.containerId,url:'https://perchance.org/',name:'capture-cookie',value:'private-cookie-sentinel',secure:true,httpOnly:true,sameSite:'strict'});let n=0;globalThis.__CAPTURE_OTHER_TIMER=setInterval(async()=>{const v=await openCore();try{await v.saveView('independent-work',{progress:++n},crypto.randomUUID());}finally{v.close();}},150);c.close();return {old:old.manifestId,current:next.manifestId,binary:old.files.find(f=>f.path==='src/binary.bin').blobId};""",ids)
   manage(sid,'pcms-journal','DISABLE');click(sid,'#pause-core');backup_page(sid);wait(lambda:script(sid,"return !!document.getElementById('backup-capture')"));first=prepare(sid);assert first['complete'],json.dumps(first);raw=private_cut(sid,first['jobId']);data=json.loads(raw);core=data['core'];external=data['external'];assert len(external['sessions'])==2 and len(external['witnesses'])==2;assert core['root']['revision']==first['receipt']['revision'] and core['root']['sequence']==first['receipt']['sequence'] and core['root']['paused'];assert next(v for v in core['views'] if v['key'][1]=='fixture-draft')['value']['draft']=='retained human draft 雪';assert next(c for c in core['credentials'] if c['key'][1]=='fixture-credential')['value']=='exact-secret-'+chr(0)+'雪';assert external['donor']['storage']['local']['fixtureDonorOwned']=={'settings':'donor-settings-sentinel','credential':'donor-secret-sentinel','bytes':[0,255,3]};assert next(m for m in core['records']['modules'] if m['id']=='pcms-accounts')['staged']['manifest']['version']=='0.4.0';assert len(core['records']['modules'])==7;assert next(j for j in core['records']['jobs'] if j['id']=='retained-possible')['effect']['boundary']=='POSSIBLE';g=next(g for g in core['records']['generators'] if g['id']=='captured-generator');assert g['previousGood']==model['old'] and g['sourceManifest']==model['current'] and g['writerHold']['jobId']=='retained-possible'
   binary_bytes=base64.b64decode(asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),b=await c.bytes(arguments[0]);c.close();let result='';for(let i=0;i<b.length;i+=8192)result+=String.fromCharCode(...b.slice(i,i+8192));return btoa(result);",[model['binary']]));expected=bytes(i%251 for i in range(1048601));assert binary_bytes==expected and hashlib.sha256(expected).hexdigest()==model['binary'];assert any(b['blobId']==model['binary'] and b['bytes']==len(expected) for b in core['blobs']);assert any(c['value']=='private-cookie-sentinel' for s in external['sessions'] for c in s['cookies']);assert first['receipt']['barrierMs']<=5000 and first['verifiedBytes']>=len(expected)
   progress=asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),v=await c.view('independent-work');await c.saveView('fixture-draft',{draft:'later live draft'},crypto.randomUUID());c.close();return v.progress;");assert progress>=2;assert private_cut(sid,first['jobId'])==raw;assert all(x not in json.dumps(coverage(sid))+script(sid,"return document.getElementById('records').textContent") for x in ['donor-secret-sentinel','private-cookie-sentinel','exact-secret-','sessionToken']);wait(lambda:'Capture ready' in script(sid,"return document.getElementById('backup-capture-state').textContent"));call('POST',f'/session/{sid}/window/rect',{'width':420,'height':900});(OUT/'immutable-capture.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')))
   receipt['checks'].append('actual-Prepare-capture/sandbox-Core-donor-join/two-independent-auth-documents/real-cookie-bytes/full-local-sync-donor-inventory/seven-active-and-staged-package-bytes/credential-draft-source-history/preserved-Possible-writer/independent-1MiB-binary-reopen/other-Core-progress/short-barrier/immutable-revision/secret-safe-narrow-UI/global-Pause/Journal-disabled/no-disk-success')
   ordered=[r['accountId'] for r in first['rows']];fixture.hold_route=account(sid,ordered[1])['routeId'];raced=prepare(sid,False);wait(lambda:fixture.witness_waiting.is_set(),30)
   witness=asyncjs(sid,"""let found;for(const t of await browser.tabs.query({})){const tag=await browser.sessions.getTabValue(t.id,'pcmsAuthCaptureWitness');if(tag?.captureId===arguments[0]&&tag.accountId===arguments[1]){found=t;break;}}if(!found)throw Error('WITNESS_FIXTURE_MISSING');await browser.scripting.executeScript({target:{tabId:found.id},world:'ISOLATED',func:()=>{if(!globalThis.__PCMS_AUTH_WATCH_1)throw Error('WATCH_NOT_INSTALLED');document.documentElement.dataset.fixtureCaptureWitness='selected';}});return found.id;""",[raced['jobId'],ordered[0]])
   matched=False
   for handle in call('GET',f'/session/{sid}/window/handles'):
    call('POST',f'/session/{sid}/window',{'handle':handle})
    if script(sid,"return document.documentElement.dataset.fixtureCaptureWitness")=='selected':matched=True;break
   assert matched;type_text(sid,'#fixture-email','retained human login draft');dashboard(sid);backup_page(sid)
   asyncjs(sid,"""const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),a=await c.read('accounts',arguments[0]);c.close();await browser.scripting.executeScript({target:{tabId:a.tabId},world:'ISOLATED',func:()=>{const old=localStorage.getItem('sessionTokenLastChangeTime');localStorage.setItem('sessionTokenLastChangeTime','changed-during-capture');localStorage.setItem('sessionTokenLastChangeTime',old);}});return true;""",[ordered[0]]);fixture.hold_route=None;fixture.release_witness.set()
   raced_done=wait(lambda:next((s for s in [current(sid)] if s and s['jobId']==raced['jobId'] and s['state'] in ['COMPLETE','INCOMPLETE']),None),180);assert raced_done['complete'] and raced_done['round']>=1,json.dumps(raced_done)
   assert asyncjs(sid,"const tab=await browser.tabs.get(arguments[0]),tag=await browser.sessions.getTabValue(tab.id,'pcmsAuthCaptureWitness'),rows=await browser.scripting.executeScript({target:{tabId:tab.id},world:'ISOLATED',func:()=>document.getElementById('fixture-email').value});return tag.role==='REVIEW'&&rows[0].result==='retained human login draft';",[witness]);receipt['checks'].append('actual-write-then-restore/native-sibling-storage-events/equal-bytes-not-sufficient/bounded-restaging/trusted-human-input-retained-in-parked-witness/no-editor-reuse')
   asyncjs(sid,"globalThis.__DONOR_ROTATION=setInterval(()=>browser.storage.local.set({fixtureDonorRotation:Math.random()}),5);return true;");changed=prepare(sid);asyncjs(sid,"clearInterval(globalThis.__DONOR_ROTATION);return true;");assert not changed['complete'] and changed['code']=='CAPTURE_DONOR_CHANGED',json.dumps(changed);assert coverage(sid)['capture']['lastGood']['jobId']==first['jobId'];assert private_cut(sid,first['jobId'])==raw
   receipt['checks'].append('actual-donor-storage-change/incomplete-cut/previous-complete-preserved/no-Pause-or-writer-release')
   interrupted=prepare(sid,False);wait(lambda:inspect_job(sid,interrupted['jobId'])['phase']=='STAGE' and inspect_job(sid,interrupted['jobId'])['cursor']>=1,30);asyncjs(sid,"clearInterval(globalThis.__CAPTURE_OTHER_TIMER);return true;");prior=stop(sid,profile);sid=None;sid,_=account_session(binary,profile);assert not prior.intersection(pids(profile));toolbar(sid);dashboard(sid);backup_page(sid);wait(lambda:current(sid)['jobId']==interrupted['jobId']);assert not current(sid)['complete']
   # Fresh account Open revalidates the protected contexts after real restart.
   for id in ids:
    account_page(sid,id);click(sid,'#account-open');settle(sid,id,'READY');dashboard(sid)
   backup_page(sid);pending=current(sid)
   if pending['state'] not in ['COMPLETE','INCOMPLETE']:
    click(sid,'#backup-capture-check');wait(lambda:current(sid)['state'] in ['COMPLETE','INCOMPLETE'],180)
   repaired=prepare(sid)
   if not repaired['complete'] and any(r.get('inspectionTabId') for r in repaired['rows']):
    for r in repaired['rows']:
     if not r.get('inspectionTabId'):continue
     selector='button[data-capture-inspect="'+r['accountId']+'"]';wait(lambda:script(sid,'return !!document.querySelector(arguments[0])',[selector]));click(sid,selector);assert asyncjs(sid,"return (await browser.tabs.get(arguments[0])).active;",[r['inspectionTabId']]);context(sid,'chrome');script(sid,"Services.wm.getMostRecentWindow('navigator:browser').gBrowser.removeCurrentTab();return true;");context(sid,'content');dashboard(sid);backup_page(sid)
    repaired=prepare(sid)
   assert repaired['complete'],json.dumps(repaired);assert fixture.receipt()['unexpected']==[]
   receipt['checks'].append('actual-process-interruption/staged-data-retained/lost-provenance-never-promoted/fresh-Accounts-Open/actual-Check-and-Prepare-recovery/previous-snapshot-preserved/no-provider-write');receipt['coreBarrierMs']=repaired['receipt']['barrierMs'];receipt['verifiedBytes']=repaired['verifiedBytes'];receipt['result']='PASS'
  except Exception as error:
   receipt['error']=str(error)
   if sid:
    try:receipt['status']=coverage(sid)
    except Exception:pass
    try:(OUT/'capture-failure.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')))
    except Exception:pass
   print(json.dumps(receipt),flush=True);raise
  finally:
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();fixture.close();(OUT/'installed-capture.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
