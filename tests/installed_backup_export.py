"""P31 B/DSK: actual Back up now, production capture/ZIP/Downloads and disk reopen.
All provider/bridge/session data is synthetic, local and disposable.
"""
from installed_backup_sessions import backup_page,coverage,manage,configure_auth,inspect_paused
from installed_accounts import account_session,add,settle,login
from installed_lifecycle import permission_choice
from installed_journal import set_input,close_dashboard
from installed_packages import *
from account_fixture import Fixture
import io

def state(sid):return coverage(sid)['export']
def request_export(sid):
 before=(state(sid)['current'] or {}).get('jobId');click(sid,'#backup-export')
 return wait(lambda:next((s for s in [state(sid)['current']] if s and s['jobId']!=before),None),30)
def completed(sid,id):
 return wait(lambda:next((s for s in [state(sid)['current']] if s and s['jobId']==id and s['state'] in ['COMPLETE','FAILED']),None),180)
def read_archive(path):
 with zipfile.ZipFile(path) as z:
  assert z.testzip() is None;names=z.namelist();assert len(names)==len(set(names));mraw=z.read('manifest.json');m=json.loads(mraw);end=json.loads(z.read('COMPLETE.json'))
  assert m['format']==1 and m['coreSchema']==1 and m['donorSchema']==1 and m['unencrypted'] and m['credentialInclusive']
  assert end=={'format':1,'manifestSha256':hashlib.sha256(mraw).hexdigest(),'validatedEntries':len(names)-1}
  assert set(m['requiredSections'])==set(names)-{'manifest.json','COMPLETE.json'};assert len(m['entries'])==len(names)-2
  for d in m['entries']:
   raw=z.read(d['path']);assert len(raw)==d['bytes'] and hashlib.sha256(raw).hexdigest()==d['sha256'] and d['schema']==1 and d['result']=='COMPLETE'
  values={}
  for name in names:
   if name.startswith(('blobs/','modules/')):continue
   raw=z.read(name)
   values[name]=[json.loads(line) for line in raw.splitlines()] if name.endswith('.ndjson') else json.loads(raw)
  return m,values,{name:z.read(name) for name in names if name.startswith(('blobs/','modules/'))}
def file_receipt(sid,id):
 return asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),f=await c.read('files',arguments[0]);c.close();return f?{id:f.id,state:f.state,filename:f.filename,bytes:f.bytes,sha256:f.sha256,downloadId:f.downloadId??null}:null;",[id])
def setup_model(sid,ids):
 return asyncjs(sid,"""const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),source=await c.source([{path:'main.pjs',bytes:new TextEncoder().encode('previous exact 雪'+String.fromCharCode(13,10))},{path:'index.html',bytes:new TextEncoder().encode('<p>old</p>')},{path:'src/雪/é.bin',bytes:Uint8Array.from({length:1048601},(_,i)=>(i*137+(i>>>8))&255)}]),next=await c.source([{path:'main.pjs',bytes:new TextEncoder().encode('current exact')},{path:'index.html',bytes:new TextEncoder().encode('<p>current</p>')}]);await c.mutate([{table:'generators',id:'backup-source',value:{slug:'backup-source',accountId:arguments[0],sourceManifest:next.manifestId,previousGood:source.manifestId,writerHold:{jobId:'possible-save',reason:'FIXTURE'}},refs:[...source.refs,...next.refs]},{table:'jobs',id:'possible-save',value:{moduleId:'pcms-deployer',jobSchema:1,generation:1,targetId:'backup-source',kind:'FIXTURE_POSSIBLE',state:'HELD',input:{},effect:{kind:'PERCHANCE_SAVE',operationId:'possible-original',boundary:'POSSIBLE'},recovery:{action:'INSPECT',code:'OUTCOME_UNKNOWN'}}}],{step:'FIXTURE_BACKUP_SOURCE',result:'COMPLETE'});await c.releasePin(source.pinId);await c.releasePin(next.pinId);await c.credentials.set('fixture-secret','private-exact-'+String.fromCharCode(0)+'雪');await c.saveView('fixture-draft',{draft:'retained human draft 雪'},crypto.randomUUID());await browser.storage.local.set({fixtureDonorOwned:{exact:'donor-private-synthetic'}});const a=await c.read('accounts',arguments[0]);await browser.cookies.set({storeId:a.containerId,url:'https://perchance.org/',name:'backup-cookie',value:'synthetic-cookie-sentinel',httpOnly:true,secure:true,sameSite:'strict'});c.close();return {old:source.manifestId,current:next.manifestId,binary:source.files.find(f=>f.path.startsWith('src/')).blobId};""",ids)
def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve();identity=json.loads((xpi.parent/'identity.json').read_text());assert not identity['dirty'];assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
 receipt={'tier':'B/DSK-production-manual-backup-export','source':identity['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]};assert receipt['xpiSha256']==identity['xpiSha256']
 with tempfile.TemporaryDirectory(prefix='pcms-backup-export-') as tmp:
  root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();home=root/'home';home.mkdir();disk=root/'downloads';disk.mkdir();fixture=Fixture(root);fixture.start_catalog();fixture.install_bridge(home,root)
  env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'};log=open(OUT/'driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None
  try:
   wait(driver_ready,15);sid,caps=account_session(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'));assert int(caps['browserVersion'].split('.')[0])>=155 and caps['acceptInsecureCerts'] is False;context(sid,'chrome')
   script(sid,"Components.classes['@mozilla.org/security/x509certdb;1'].getService(Components.interfaces.nsIX509CertDB).addCertFromBase64(arguments[0],'C,,');Services.prefs.setStringPref('browser.download.dir',arguments[1]);Services.prefs.setIntPref('browser.download.folderList',2);Services.prefs.setBoolPref('browser.download.useDownloadDir',true);return true;",[base64.b64encode(fixture.ca).decode(),str(disk)]);prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];receipt['sandbox']=prefs;context(sid,'content')
   assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid);settings(sid);wait(lambda:script(sid,"return !!document.getElementById('allow-userscripts')"));click(sid,'#allow-userscripts');permission_choice(sid,True);wait(lambda:script(sid,"return !document.getElementById('allow-userscripts')"));ids=[]
   for label,email in [('Backup source one','backup1@fixture.test'),('Backup source two','backup2@fixture.test')]:
    id=add(sid,label);settle(sid,id,'LOGIN_REQUIRED');login(sid,id,email);click(sid,'#account-confirm');settle(sid,id,'READY');ids.append(id)
   for index,id in enumerate(ids):configure_auth(sid,id,'synthetic-token-'+str(index)+'\0雪\r\n')
   model=setup_model(sid,ids)
   with zipfile.ZipFile(xpi) as outer:
    with zipfile.ZipFile(io.BytesIO(outer.read('bundled/pcms-backup.zip'))) as package:payload={name:package.read(name) for name in package.namelist()}
   manifest=json.loads(payload['module.json']);manifest['version']='0.5.0';payload['module.json']=json.dumps(manifest).encode();update=root/'backup-staged.zip'
   with zipfile.ZipFile(update,'w',compression=zipfile.ZIP_DEFLATED) as package:
    for name,value in payload.items():package.writestr(name,value)
   settings(sid);select(sid,update);click(sid,'#install-module');wait(lambda:'Update staged.' in script(sid,"return document.getElementById('import-result').textContent"))
   manage(sid,'pcms-journal','DISABLE');click(sid,'#pause-core');wait(lambda:inspect_paused(sid));backup_page(sid);set_input(sid,'#backup-folder','PCMS/Backup/Fixture');click(sid,'#backup-save-destination');wait(lambda:state(sid)['folder']=='PCMS/Backup/Fixture')
   sentinel=disk/'unrelated-sentinel.txt';sentinel.write_bytes(b'unrelated exact sentinel');manual=disk/'PCMS'/'manual-sentinel.zip';manual.parent.mkdir(parents=True,exist_ok=True);manual.write_bytes(b'not a tracked archive')
   first=request_export(sid);first_done=completed(sid,first['jobId']);assert first_done['state']=='COMPLETE',json.dumps(first_done);file=file_receipt(sid,first['jobId']);path=disk/file['filename'];m,values,binaries=read_archive(path);original_hash=hashlib.sha256(path.read_bytes()).hexdigest();assert original_hash==file['sha256'] and path.stat().st_size==file['bytes']
   assert values['records/meta.json']['root']['paused'];assert len(values['records/modules.ndjson'])==7;assert next(v for v in values['credentials.json'] if v['key'][1]=='fixture-secret')['value']=='private-exact-'+chr(0)+'雪';assert next(v for v in values['records/views.ndjson'] if v['key'][1]=='fixture-draft')['value']['draft']=='retained human draft 雪'
   assert values['donor/state.json']['storage']['local']['fixtureDonorOwned']['exact']=='donor-private-synthetic';assert len(m['logicalMappings'])==2
   assert any(v['effect']['boundary']=='POSSIBLE' for v in values['records/jobs.ndjson'] if v['id']=='possible-save')
   assert binaries['blobs/'+model['binary']]==bytes((i*137+(i>>8))&255 for i in range(1048601))
   for index,id in enumerate(ids):
    mapping=next(v for v in m['logicalMappings'] if v['accountId']==id);a=values['auth/'+mapping['personaUid']+'/perchance-auth-1.json'];assert a['auth']['user']['sessionToken']=='synthetic-token-'+str(index)+'\0雪\r\n';assert 'AI' not in a['auth']
   assert any(c['value']=='synthetic-cookie-sentinel' for p,rows in values.items() if p.startswith('cookies/') for c in rows)
   assert len([p for p in binaries if p.startswith('modules/pcms-backup/')])==2
   for p,b in binaries.items():
    if p.startswith('modules/'):
     with zipfile.ZipFile(io.BytesIO(b)) as z:assert z.testzip() is None and json.loads(z.read('module.json'))['coreApi']==1
   wait(lambda:'Firefox download complete' in script(sid,"return document.getElementById('backup-export-state').textContent"),15);assert 'synthetic-token' not in script(sid,"return document.body.textContent")
   receipt['checks'].append('actual-Back-up-now/qualified-production-capture/streamed-ZIP/Core-Downloads/independent-disk-CRC-manifest-all-entry-hashes/exact-source-history-binary-NUL-auth-cookie-credential-draft-donor/current-and-staged-module-ZIPs/7-modules/Pause/Journal-disabled')
   # Invalid fresh auth coverage must not create a second complete file.
   configure_auth(sid,ids[0],'synthetic-bad-schema',unknown=True);bad=request_export(sid);bad_done=completed(sid,bad['jobId']);assert bad_done['state']=='FAILED' and not file_receipt(sid,bad['jobId']),json.dumps(bad_done);assert state(sid)['lastComplete']['id']==first['jobId'];configure_auth(sid,ids[0],'synthetic-restored-token')
   receipt['checks'].append('unsupported-auth-schema/no-download/no-false-completion/last-complete-preserved')
   # Persist a local staging checkpoint and stop the actual browser while the
   # next bounded Blob read is pending. No Downloads call has occurred.
   asyncjs(sid,"""const bg=await browser.runtime.getBackgroundPage(),put=bg.IDBObjectStore.prototype.put,slice=bg.Blob.prototype.slice;bg.__P31_STAGE=false;bg.__P31_BLOCKED=false;bg.IDBObjectStore.prototype.put=function(row){if(this.name==='files'&&row.type==='backup'&&row.state==='STAGING')bg.__P31_STAGE=true;return put.call(this,row);};bg.Blob.prototype.slice=function(...args){const b=slice.apply(this,args);if(bg.__P31_STAGE&&!bg.__P31_BLOCKED){bg.__P31_BLOCKED=true;Object.defineProperty(b,'arrayBuffer',{value:()=>new Promise(()=>{})});}return b;};return true;""")
   interrupted=request_export(sid);wait(lambda:asyncjs(sid,"return (await browser.runtime.getBackgroundPage()).__P31_BLOCKED;"),180);partial=file_receipt(sid,interrupted['jobId']);assert partial['state']=='STAGING' and partial['downloadId'] is None
   prior=stop(sid,profile);sid=None;sid,_=account_session(binary,profile);assert not prior.intersection(pids(profile));toolbar(sid);dashboard(sid);backup_page(sid);wait(lambda:(state(sid)['current'] or {}).get('jobId')==interrupted['jobId']);assert state(sid)['current']['state']=='STAGING';click(sid,'#backup-export-check');resumed=completed(sid,interrupted['jobId']);assert resumed['state']=='COMPLETE',json.dumps(resumed);resumed_file=file_receipt(sid,interrupted['jobId']);read_archive(disk/resumed_file['filename']);assert (disk/resumed_file['filename']).stat().st_size==resumed_file['bytes'];assert inspect_paused(sid)
   receipt['checks'].append('actual-process-stop-mid-Blob-staging/durable-cut-pin-receipt/restart/actual-Check-export/same-job-and-filename/no-pre-restart-download/independent-production-disk-reopen')
   # Current account contexts require ordinary explicit recovery after restart
   # before a new capture. Exporting the old immutable cut needed none of these.
   click(sid,'#pause-core');wait(lambda:not inspect_paused(sid))
   from installed_accounts import account as account_status,page as account_page
   for index,id in enumerate(ids):
    account_page(sid,id);before_open=account_status(sid,id)['flow']['jobId'];wait(lambda:script(sid,"return !document.getElementById('account-open').disabled"));click(sid,'#account-open');dashboard(sid);wait(lambda:account_status(sid,id)['flow']['jobId']!=before_open)
    settle(sid,id,'HELD','ACCOUNT_LOGIN_REQUIRED');login(sid,id,'backup'+str(index+1)+'@fixture.test');configure_auth(sid,id,fixture.logins[account_status(sid,id)['routeId']]['sessionToken']);click(sid,'#account-confirm');settle(sid,id,'READY');dashboard(sid)
   click(sid,'#pause-core');wait(lambda:inspect_paused(sid));backup_page(sid)
   # Force actual Downloads cancellation at its returned ID, then restore the
   # API. The production receipt must report interruption and retain good files.
   asyncjs(sid,"""const bg=await browser.runtime.getBackgroundPage(),original=bg.browser.downloads.download;bg.__P31_NATIVE_DOWNLOAD=original;bg.browser.downloads.download=async options=>{const id=await original(options);try{await bg.browser.downloads.cancel(id);}catch{}return id;};return true;""")
   cancelled=request_export(sid);cancelled_done=completed(sid,cancelled['jobId']);asyncjs(sid,"const bg=await browser.runtime.getBackgroundPage();bg.browser.downloads.download=bg.__P31_NATIVE_DOWNLOAD;return true;");assert cancelled_done['state']=='FAILED',json.dumps(cancelled_done);assert state(sid)['lastComplete']['id']==interrupted['jobId']
   receipt['checks'].append('actual-browser-download-cancel/failed-receipt/no-last-good-replacement/no-automatic-replay')
   blocked=disk/'PCMS'/'Blocked';blocked.write_text('unrelated destination sentinel');set_input(sid,'#backup-folder','PCMS/Blocked/Backup');click(sid,'#backup-save-destination');wait(lambda:state(sid)['folder']=='PCMS/Blocked/Backup');failed=request_export(sid);assert completed(sid,failed['jobId'])['state']=='FAILED';assert state(sid)['lastComplete']['id']==interrupted['jobId'];assert blocked.read_text()=='unrelated destination sentinel'
   manage(sid,'pcms-backup','DISABLE');backup_page(sid);assert script(sid,"return document.getElementById('backup-export').disabled");before=len(list(disk.rglob('*.pcms.zip')));time.sleep(2);assert len(list(disk.rglob('*.pcms.zip')))==before
   assert sentinel.read_bytes()==b'unrelated exact sentinel' and manual.read_bytes()==b'not a tracked archive' and hashlib.sha256(path.read_bytes()).hexdigest()==original_hash;assert fixture.receipt()['unexpected']==[]
   receipt['checks'].append('actual-destination-error/Backup-Disable/no-export/manual-and-unrelated-sentinels/earlier-complete-hash-preserved/no-provider-write');receipt['result']='PASS'
  except Exception as error:
   receipt['error']=str(error)
   if sid:
    try:receipt['status']=coverage(sid)
    except Exception:pass
    try:(OUT/'backup-export-failure.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')))
    except Exception:pass
   print(json.dumps(receipt),flush=True);raise
  finally:
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();fixture.close();(OUT/'installed-backup-export.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
