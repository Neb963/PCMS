"""P08 B/DSK: real Settings actions, queue/sandbox/Downloads and independent
production ZIP disk reads. No provider access, real credentials or route effects.
"""
from installed_packages import *
from visual_capture import state_matrix

def set_input(sid,selector,text):
 # WebDriver clear does not deliver the input event used by real keyboard
 # deletion. Exercise the actual input/debounce/continuity path, also for ''.
 type_text(sid,selector,'\ue009a\ue000\ue003')
 if text:type_text(sid,selector,text)
def journal(sid):
 click(sid,'nav a[href="#settings"]');wait(lambda:script(sid,"return !!document.querySelector('#records a[href=\"#settings/journal\"]')"));click(sid,'#records a[href="#settings/journal"]');wait(lambda:script(sid,"return !!document.getElementById('export-journal')||!!document.getElementById('enable-journal')"))
def inspect(sid):
 return asyncjs(sid,"""const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),m=await c.read('modules','pcms-journal'),root=await c.status();let cursor=null,files=[];
 do{const p=await c.list({table:'files',cursor});for(const f of p.rows){const row=await c.read('files',f.id);files.push({id:row.id,state:row.state,filename:row.filename,automatic:row.automatic,metadata:row.metadata,bytes:row.bytes,sha256:row.sha256,downloadId:row.downloadId??null,completedAt:row.completedAt??null,job:await c.read('jobs',row.jobId)});}cursor=p.cursor;}while(cursor);c.close();return {enabled:m.enabled,journal:m.journal,paused:root.paused,files};""")
def read_zip(path):
 with zipfile.ZipFile(path) as z:
  assert z.testzip() is None;assert sorted(z.namelist())==['COMPLETE','diagnostics.json','events.jsonl','manifest.json'];manifest=z.read('manifest.json');m=json.loads(manifest);events=z.read('events.jsonl');done=json.loads(z.read('COMPLETE'))
  assert done=={'schema':1,'manifestSha256':hashlib.sha256(manifest).hexdigest()};assert m['eventSha256']==hashlib.sha256(events).hexdigest() and m['eventBytes']==len(events)
  rows=[json.loads(line) for line in events.splitlines()];assert len(rows)==m['count'];assert m['first']<=m['last'];assert [r['sequence'] for r in rows]==list(range(m['first'],m['last']+1));assert m['coverageComplete'] and m['gaps']==[]
  checkpoint=z.read('diagnostics.json');assert m['schema']==2 and len(checkpoint)==m['checkpointBytes'] and hashlib.sha256(checkpoint).hexdigest()==m['checkpointSha256'];assert json.loads(checkpoint)['cut']==m['checkpointCut']
  for entry in z.namelist():assert b'never-export-private-fixture' not in z.read(entry)
  return m,rows

def disk_files(root):
 result=[]
 for p in root.rglob('*.zip'):
  try:read_zip(p);result.append(p)
  except (zipfile.BadZipFile,AssertionError,EOFError):pass
 return result

def arm_due(sid,delay=1000):
 return asyncjs(sid,"""const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),m=await c.read('modules','pcms-journal');await c.mutate([{table:'modules',id:m.id,expectedRev:m.rev,refs:m.refs,value:{...m,journal:{...m.journal,nextDue:Date.now()-7200000}}}],{step:'FIXTURE_DEADLINE',result:'COMPLETE'});c.close();await browser.alarms.create('pcms-queue',{when:Date.now()+arguments[0]});return true;""",[delay])
def close_dashboard(sid):
 call('POST',f'/session/{sid}/window/new',{'type':'tab'});dashboard(sid);call('DELETE',f'/session/{sid}/window')

def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve();identity=json.loads((xpi.parent/'identity.json').read_text())
 assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
 receipt={'tier':'B/DSK','source':identity['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]};assert receipt['xpiSha256']==identity['xpiSha256'] and identity['dirty'] is False
 with tempfile.TemporaryDirectory(prefix='pcms-journal-') as tmp:
  root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();home=root/'home';home.mkdir();disk=root/'downloads';disk.mkdir()
  env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'};log=open(OUT/'driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None
  try:
   wait(driver_ready,15);sid,caps=session(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'));assert int(caps['browserVersion'].split('.')[0])>=155
   context(sid,'chrome');script(sid,"Services.prefs.setStringPref('browser.download.dir',arguments[0]);Services.prefs.setIntPref('browser.download.folderList',2);Services.prefs.setBoolPref('browser.download.useDownloadDir',true);return true;",[str(disk)]);context(sid,'content')
   assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid);status(sid,'BRIDGE_MISSING')
   context(sid,'chrome');prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];receipt['sandbox']=prefs;context(sid,'content')
   fixture=asyncjs(sid,"""const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore();await c.credentials.set('github','never-export-private-fixture');let first=(await c.status()).sequence+1,last;
    // Exercise the production dispatch/transaction/error projection with a
    // deterministic local call boundary. No native/provider call is possible.
    const {CoreError}=await import(browser.runtime.getURL('core/records.mjs'));
    await c.mutate([{table:'modules',id:'r01-fault',value:{enabled:true,generation:1}}],{step:'FIXTURE_FAULT_MODULE',result:'COMPLETE'});await c.queue.boot();
    const job=await c.queue.enqueue({requestId:'r01-fault',logicalKey:'r01-fault',moduleId:'r01-fault',targetId:'synthetic-git-target',kind:'WORK'}),turn=await c.queue.next();if(turn.id!==job.id)throw Error('FAULT_FIXTURE_TURN');
    await c.queue.dispatch(job.id,turn.rev,{operationId:'r01-lost-reply',kind:'GIT_COMMITS',preflight:async()=>({ok:true}),call:async()=>{throw new CoreError('GIT_COMMIT_IDENTITY_MISMATCH',{failedCheck:'COMMIT_IDENTITY',messageMatches:false,expectedLength:77,observedLength:76});},observe:async()=>({matched:false})});
    await c.mutate([{table:'accounts',id:'synthetic-account',value:{state:'HELD',holdCode:'ACCOUNT_ROUTE_RECHECK_REQUIRED',routeObservedAt:Date.now()-901000,expectedPrincipal:'never-export-private-fixture'}},{table:'generators',id:'synthetic-held',value:{state:'HELD',creatorState:'HELD',creatorHoldCode:'CREATOR_TEMPLATE_SCHEMA',source:'never-export-private-fixture'}}],{step:'FIXTURE_PREPARE_HOLD',result:'HELD'});
    for(let i=0;i<65;i++){const r=await c.record({step:'JOURNAL_FIXTURE',result:i===64?'FAILED':'COMPLETE',targetId:'fixture-target-'+i,...i===64?{code:'EXPECTED_ERROR'}:{}});first??=r.sequence;last=r.sequence;}c.close();return {first,last};""")
   journal(sid);prior_settings=inspect(sid)['journal'];set_input(sid,'#journal-folder','PCMS/../never-export-private-fixture');click(sid,'#save-journal-settings')
   wait(lambda:script(sid,"return document.getElementById('save-journal-settings').nextElementSibling.textContent==='Use a relative folder inside PCMS, without dots or unsafe path characters.'"))
   assert inspect(sid)['journal']['folder']==prior_settings['folder'] and inspect(sid)['journal']['intervalMinutes']==prior_settings['intervalMinutes']
   state_matrix(sid,'settings-journal-validation-error',receipt)
   set_input(sid,'#journal-folder',prior_settings['folder']);fixture['last']=asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),r=await c.status();c.close();return r.sequence;")
   set_input(sid,'#journal-first',str(fixture['first']));set_input(sid,'#journal-last',str(fixture['last']));click(sid,'#export-journal')
   completed=wait(lambda:next((f for f in inspect(sid)['files'] if not f['automatic'] and f['state']=='COMPLETE'),None),30);path=disk/completed['filename'];m,rows=read_zip(path);assert (m['first'],m['last'],m['count'])==(fixture['first'],fixture['last'],fixture['last']-fixture['first']+1);assert [r['targetId'] for r in rows if r['step']=='JOURNAL_FIXTURE']==['fixture-target-'+str(i) for i in range(65)];assert path.stat().st_size==completed['bytes'];assert hashlib.sha256(path.read_bytes()).hexdigest()==completed['sha256'];manual_hash=hashlib.sha256(path.read_bytes()).hexdigest();assert inspect(sid)['journal']['watermark']==0
   fault=next(r for r in rows if r['step']=='EFFECT_OUTCOME');assert fault['operationId']=='r01-lost-reply' and fault['diagnostics']['causeCode']=='GIT_COMMIT_IDENTITY_MISMATCH' and fault['diagnostics']['messageMatches'] is False and fault['diagnostics']['noReplay'] is True
   rejection=next(r for r in rows if r['step']=='CORE_REQUEST' and r['code']=='EXPORT_DESTINATION_INVALID');assert rejection['diagnostics']['action']=='JOURNAL_SETTINGS' and rejection['diagnostics']['decision']=='REQUEST_FAILED' and rejection['operationId']
   receipt['checks'].append('actual-invalid-settings-control/unchanged-prior-settings/default-causal-host-rejection/independent-disk-original-code/action-correlation/request-canary-excluded')
   with zipfile.ZipFile(path) as z:checkpoint=json.loads(z.read('diagnostics.json'))
   account=next(a for a in checkpoint['tables']['accounts'] if a['id']=='synthetic-account');assert account['code']=='ACCOUNT_ROUTE_RECHECK_REQUIRED' and account['diagnostics']['proofAgeMs']>=901000
   assert next(j for j in checkpoint['tables']['jobs'] if j['id'])
   receipt['checks'].append('R01-default-disk-ZIP/original-Git-cause/mismatched-message/no-replay/route-age-expiry/secret-safe-checkpoint')
   receipt['checks'].append('actual-Export-now/sandbox-step/Core-Downloads/independent-production-ZIP-CRC-hashes/all-range-records/65-exact-fixture-targets/no-secret/manual-no-watermark')
   set_input(sid,'#journal-filter','JOURNAL_FIXTURE');wait(lambda:script(sid,"return document.querySelectorAll('#journal-events li').length===50&&[...document.querySelectorAll('#journal-events summary')].every(e=>e.textContent.includes('JOURNAL_FIXTURE'))&&!document.getElementById('next-events').disabled"));click(sid,'#next-events');wait(lambda:'fixture-target-64' in script(sid,"return document.getElementById('journal-events').textContent"));assert script(sid,"return document.querySelectorAll('#journal-events li').length")==15
   set_input(sid,'#journal-target','fixture-target-64');wait(lambda:script(sid,"return document.querySelectorAll('#journal-events li').length")==1);click(sid,'#journal-events summary');assert 'EXPECTED_ERROR' in script(sid,"return document.getElementById('journal-events').textContent")
   set_input(sid,'#journal-interval','15');set_input(sid,'#journal-folder','PCMS/Journal/Fixture');click(sid,'#save-journal-settings');wait(lambda:inspect(sid)['journal']['intervalMinutes']==15)
   receipt['checks'].append('real-search/later-page/exact-target-filter/details/settings-save')
   asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),m=await c.read('modules','r01-fault');await c.mutate([{table:'modules',id:m.id,expectedRev:m.rev,value:{...m,enabled:false}}],{step:'FIXTURE_FAULT_DISABLED',result:'COMPLETE'});c.close();return true;")
   click(sid,'#pause-core');wait(lambda:script(sid,"return document.getElementById('queue-status').textContent")=='Paused');arm_due(sid,5000);close_dashboard(sid);context(sid,'chrome');terminated=asyncjs(sid,"const {ExtensionParent}=ChromeUtils.importESModule('resource://gre/modules/ExtensionParent.sys.mjs');const e=ExtensionParent.GlobalManager.getExtension(arguments[0]);await e.terminateBackground();return e.backgroundState;",[ID]);assert terminated=='stopped';context(sid,'content')
   wait(lambda:len(disk_files(disk))==2,35);time.sleep(2);reopened=time.time()*1000;toolbar(sid);dashboard(sid);state=inspect(sid);auto=[f for f in state['files'] if f['automatic'] and f['state']=='COMPLETE'];assert len(auto)==1 and auto[0]['completedAt']<reopened and state['paused'];assert state['journal']['watermark']==auto[0]['metadata']['last'];read_zip(disk/auto[0]['filename']);assert hashlib.sha256(path.read_bytes()).hexdigest()==manual_hash
   receipt['checks'].append('global-Pause/closed-dashboard/native-event-page-termination/alarm-wake/automatic-disk-export/completion-before-reopen/initial-retained-range')
   settings(sid);wait(lambda:script(sid,"return !!document.querySelector('section[data-module=\"pcms-journal\"] [data-lifecycle=\"DISABLE\"]')"));click(sid,'section[data-module="pcms-journal"] [data-lifecycle="DISABLE"]');wait(lambda:not inspect(sid)['enabled']);arm_due(sid);time.sleep(3);assert len(disk_files(disk))==2
   asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore();await c.record({step:'RECORD_WHILE_DISABLED',result:'COMPLETE'});c.close();return true;");journal(sid);assert script(sid,"return !document.getElementById('export-journal')");click(sid,'#enable-journal');wait(lambda:len(disk_files(disk))==3,30);wait(lambda:inspect(sid)['journal']['lastExport']['state']=='COMPLETE');time.sleep(2);assert len(disk_files(disk))==3
   receipt['checks'].append('actual-Disable/no-new-export/Core-recording/actual-Enable/one-coalesced-due-export')
   arm_due(sid,60000);prior=stop(sid,profile);sid=None;sid,_=session(binary,profile);assert not prior.intersection(pids(profile));wait(lambda:len(disk_files(disk))==4,35);time.sleep(2);toolbar(sid);dashboard(sid);state=inspect(sid);assert state['paused'] and state['journal']['intervalMinutes']==15;time.sleep(2);assert len(disk_files(disk))==4
   auto=sorted((f for f in state['files'] if f['automatic'] and f['state']=='COMPLETE'),key=lambda f:f['metadata']['last']);assert auto[1]['metadata']['first']==auto[0]['metadata']['last']+1 and auto[2]['metadata']['first']==auto[1]['metadata']['last']+1
   receipt['checks'].append('real-browser-process-restart/paused-maintenance-without-dashboard/incremental-no-overlap/no-missed-export-burst')
   journal(sid);wait(lambda:script(sid,"return !document.getElementById('export-journal').disabled"));injected=asyncjs(sid,"""const bg=await browser.runtime.getBackgroundPage(),p=bg.IDBObjectStore.prototype,put=p.put;bg.p08Injected=0;p.put=function(row){if(this.name==='files'&&row.state==='IN_PROGRESS'&&row.downloadId!=null&&!bg.p08Injected){bg.p08Injected++;throw new DOMException('injected receipt failure','AbortError');}return put.call(this,row);};return true;""");assert injected
   click(sid,'#export-journal');wait(lambda:len(disk_files(disk))==5,30);wait(lambda:len([f for f in inspect(sid)['files'] if f['state']=='COMPLETE'])==5,30);assert asyncjs(sid,"return (await browser.runtime.getBackgroundPage()).p08Injected;")==1;assert len(disk_files(disk))==5
   receipt['checks'].append('injected-IDB-receipt-loss-after-real-download/exact-browser-identity-reconciliation/no-second-file')
   blocked=disk/'PCMS'/'Blocked';blocked.write_text('unrelated sentinel');journal(sid);set_input(sid,'#journal-folder','PCMS/Blocked/Journal');click(sid,'#save-journal-settings');wait(lambda:inspect(sid)['journal']['folder']=='PCMS/Blocked/Journal');wait(lambda:script(sid,"return !document.getElementById('export-journal').disabled"));before=inspect(sid)['journal']['watermark'];click(sid,'#export-journal');wait(lambda:any(f['state']=='FAILED' for f in inspect(sid)['files']),30);assert inspect(sid)['journal']['watermark']==before and len(disk_files(disk))==5;assert blocked.read_text()=='unrelated sentinel';assert hashlib.sha256(path.read_bytes()).hexdigest()==manual_hash
   receipt['checks'].append('real-unwritable-relative-destination/error/no-false-completion/watermark-and-earlier-files-preserved/unrelated-sentinel')
   # Actual persistent Firefox 90-day event history. Seed outside production
   # logging only to avoid 100k independent setup transactions. The export,
   # UI, Downloads and archive bytes remain production paths.
   late=asyncjs(sid,"""const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),r=await c.status();c.close();const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('pcms-core');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});const n=100001,tx=db.transaction(['events','meta'],'readwrite');const done=new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});for(let i=1;i<=n;i++){const sequence=r.sequence+i;tx.objectStore('events').put({key:[r.dataset,sequence],dataset:r.dataset,id:String(sequence),sequence,time:Date.now()-90*86400000+Math.floor(i/n*90*86400000),step:'SCALE_FIXTURE',result:'COMPLETE'});}tx.objectStore('meta').put({...r,sequence:r.sequence+n});await done;db.close();const bg=await browser.runtime.getBackgroundPage(),proto=bg.IDBCursor.prototype,original=proto.continue;bg.r01TailReads=0;proto.continue=function(...args){if(this.source.name==='events'&&Number(this.key?.[1])>=r.sequence+n)bg.r01TailReads++;return original.apply(this,args);};return {last:r.sequence+n};""")
   journal(sid);set_input(sid,'#journal-folder','PCMS/Journal/Scale');click(sid,'#save-journal-settings');wait(lambda:inspect(sid)['journal']['folder']=='PCMS/Journal/Scale');set_input(sid,'#journal-first',str(late['last']));set_input(sid,'#journal-last',str(late['last']));started=time.monotonic();click(sid,'#export-journal')
   scale=wait(lambda:next((f for f in inspect(sid)['files'] if f['state']=='COMPLETE' and f['metadata'].get('first')==late['last']),None),40);sm,srows=read_zip(disk/scale['filename']);assert sm['count']==1 and srows[0]['sequence']==late['last'];reads=asyncjs(sid,"return (await browser.runtime.getBackgroundPage()).r01TailReads;");assert reads<=20,reads;receipt['scale']={'events':100001,'days':90,'exportedRows':1,'tailCursorReads':reads,'elapsedMs':round((time.monotonic()-started)*1000),'sha256':hashlib.sha256((disk/scale['filename']).read_bytes()).hexdigest()}
   receipt['checks'].append('R01-actual-Firefox/100k-90day-prefix/single-tail-export/bounded-cursor/real-UI-Downloads-independent-disk')
   (OUT/'journal.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')));receipt['result']='PASS'
  except Exception as error:
   receipt['error']=str(error)
   if sid:
    try:receipt['state']=inspect(sid)
    except Exception:pass
    try:(OUT/'journal-failure.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')))
    except Exception:pass
   raise
  finally:
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();(OUT/'installed-journal.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
