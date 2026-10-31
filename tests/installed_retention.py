"""P09 B/DSK: normal-sandbox production cleanup, controlled receipt ages,
real expired/manual/unrelated disk files, history loss and process restart.
"""
from installed_journal import *

def retention_state(sid):
 return asyncjs(sid,"""const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),root=await c.status(),m=await c.read('modules','pcms-journal');let cursor=null,files=[];do{const p=await c.list({table:'files',cursor});for(const f of p.rows){const r=await c.read('files',f.id);files.push({...r,job:await c.read('jobs',r.jobId),cleanupJob:r.cleanup?.jobId?await c.read('jobs',r.cleanup.jobId):null});}cursor=p.cursor;}while(cursor);c.close();return {root,journal:m.journal,files};""")

def completed(sid,automatic=None):
 return [f for f in retention_state(sid)['files'] if f['state']=='COMPLETE' and (automatic is None or f['automatic']==automatic) and f['job']['state']=='COMPLETE']

def auto_export(sid):
 before={f['id'] for f in completed(sid)};arm_due(sid);return wait(lambda:next((f for f in completed(sid,True) if f['id'] not in before),None),35)

def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve();identity=json.loads((xpi.parent/'identity.json').read_text());assert not identity['dirty']
 assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
 receipt={'tier':'B/DSK','source':identity['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]};assert receipt['xpiSha256']==identity['xpiSha256']
 with tempfile.TemporaryDirectory(prefix='pcms-retention-') as tmp:
  root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();home=root/'home';home.mkdir();disk=root/'downloads';disk.mkdir()
  env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'};log=open(OUT/'driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None
  try:
   wait(driver_ready,15);sid,caps=session(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'));assert int(caps['browserVersion'].split('.')[0])>=155
   context(sid,'chrome');script(sid,"Services.prefs.setStringPref('browser.download.dir',arguments[0]);Services.prefs.setIntPref('browser.download.folderList',2);Services.prefs.setBoolPref('browser.download.useDownloadDir',true);return true;",[str(disk)]);context(sid,'content')
   assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid);status(sid,'BRIDGE_MISSING')
   context(sid,'chrome');prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];receipt['sandbox']=prefs;context(sid,'content');journal(sid)
   assert script(sid,"return document.getElementById('journal-retention').value")=='90';set_input(sid,'#journal-retention','0');click(sid,'#save-journal-settings');wait(lambda:'positive whole number' in script(sid,"return document.querySelector('#save-journal-settings').nextSibling.textContent"));assert inspect(sid)['journal']['retentionDays']==90
   set_input(sid,'#journal-retention','120');click(sid,'#save-journal-settings');wait(lambda:inspect(sid)['journal']['retentionDays']==120);set_input(sid,'#journal-retention','90');click(sid,'#save-journal-settings');wait(lambda:inspect(sid)['journal']['retentionDays']==90)
   click(sid,'#export-journal');manual=wait(lambda:next(iter(completed(sid,False)),None),35);manual_path=disk/manual['filename'];read_zip(manual_path);manual_bytes=manual_path.read_bytes();sentinel=disk/'unrelated.zip';sentinel.write_bytes(b'independent unrelated sentinel')
   owned=auto_export(sid);missing=auto_export(sid);moved=auto_export(sid);files=[manual,owned,missing,moved]
   for f in files:read_zip(disk/f['filename'])
   # Isolated fixture advances only receipt dates, not Downloads identity or bytes.
   asyncjs(sid,"""const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore();for(const id of arguments[0]){const f=await c.read('files',id);await c.mutate([{table:'files',id,expectedRev:f.rev,refs:f.refs,value:{...f,completedAt:Date.now()-91*86400000}}],{step:'FIXTURE_AGE',result:'COMPLETE'});}c.close();await browser.downloads.erase({id:arguments[1]});return true;""",[[f['id'] for f in files],missing['downloadId']])
   moved_path=disk/moved['filename'];moved_to=disk/'moved-outside-owned-path.zip';moved_path.rename(moved_to);moved_bytes=moved_to.read_bytes();missing_path=disk/missing['filename'];missing_bytes=missing_path.read_bytes();owned_path=disk/owned['filename']
   settings(sid);wait(lambda:script(sid,"return !!document.querySelector('section[data-module=\"pcms-journal\"] [data-lifecycle=\"DISABLE\"]')"));click(sid,'section[data-module="pcms-journal"] [data-lifecycle="DISABLE"]');wait(lambda:not inspect(sid)['enabled']);time.sleep(2);assert owned_path.is_file() and missing_path.read_bytes()==missing_bytes and manual_path.read_bytes()==manual_bytes;journal(sid);click(sid,'#enable-journal');wait(lambda:script(sid,"return !!document.getElementById('export-journal')"));receipt['checks'].append('actual-Journal-Disable/expired-files-kept/Enable-with-retention-preserved')
   blocked=disk/'PCMS'/'Blocked';blocked.write_bytes(b'blocked destination sentinel');set_input(sid,'#journal-folder','PCMS/Blocked/Journal');click(sid,'#save-journal-settings');wait(lambda:inspect(sid)['journal']['folder']=='PCMS/Blocked/Journal');wait(lambda:script(sid,"return !document.getElementById('export-journal').disabled"));click(sid,'#export-journal');wait(lambda:inspect(sid)['journal']['lastExport']['state']=='FAILED',35);assert owned_path.is_file() and missing_path.read_bytes()==missing_bytes and moved_to.read_bytes()==moved_bytes and manual_path.read_bytes()==manual_bytes
   receipt['checks'].append('real-Settings/default-90/invalid-zero/persist-120-and-90/real-failed-new-export/preserve-earlier-complete/manual/unrelated/moved/history-cleared-files')
   set_input(sid,'#journal-folder','PCMS/Journal');click(sid,'#save-journal-settings');wait(lambda:inspect(sid)['journal']['folder']=='PCMS/Journal');click(sid,'#pause-core');wait(lambda:script(sid,"return document.getElementById('queue-status').textContent")=='Paused');wait(lambda:script(sid,"return !document.getElementById('export-journal').disabled"));click(sid,'#export-journal');close_dashboard(sid)
   wait(lambda:not owned_path.exists(),40);assert manual_path.read_bytes()==manual_bytes and missing_path.read_bytes()==missing_bytes and moved_to.read_bytes()==moved_bytes and sentinel.read_bytes()==b'independent unrelated sentinel' and blocked.read_bytes()==b'blocked destination sentinel'
   toolbar(sid);dashboard(sid);journal(sid);wait(lambda:'Cleanup needs attention' in script(sid,"return document.getElementById('journal-cleanup-status').textContent"),20);removed=wait(lambda:next((f for f in retention_state(sid)['files'] if f['id']==owned['id'] and f.get('cleanup',{}).get('phase')=='HELD'),None),20);assert removed['cleanup'].get('removedAckAt') and removed['cleanup']['code']=='CLEANUP_METADATA_STALE';state=retention_state(sid);byid={f['id']:f for f in state['files']};assert byid[missing['id']]['cleanup']['code']=='CLEANUP_HISTORY_MISSING';assert byid[manual['id']].get('cleanup') is None
   assert len([e for e in removed['cleanupJob']['effects'] if e['operationId']==removed['cleanupJob']['id']+'-remove'])==1
   receipt['checks'].append('real-Downloads-removeFile/closed-dashboard/global-Pause/independent-owned-disk-absence/preserved-exact-manual-unrelated-moved-history-loss-bytes/tracked-native-delayed-exists-attention')
   before_job=removed['cleanupJob']['id'];prior=stop(sid,profile);sid=None;sid,_=session(binary,profile);assert not prior.intersection(pids(profile));toolbar(sid);dashboard(sid);journal(sid);click(sid,'#check-journal-download');time.sleep(2);state=retention_state(sid);removed=next(f for f in state['files'] if f['id']==owned['id']);assert removed['cleanupJob']['id']==before_job;assert len([e for e in removed['cleanupJob']['effects'] if e['operationId']==before_job+'-remove'])==1
   assert not owned_path.exists() and manual_path.read_bytes()==manual_bytes and missing_path.read_bytes()==missing_bytes and moved_to.read_bytes()==moved_bytes and sentinel.read_bytes()==b'independent unrelated sentinel';assert state['journal']['retentionDays']==90
   receipt['checks'].append('real-process-restart/same-cleanup-operation/read-only-check/no-new-remove-intent/persistent-retention-and-disk-preservation')
   receipt['cleanup']={f['id']:f.get('cleanup') for f in state['files'] if f.get('cleanup')};receipt['result']='PASS';(OUT/'retention.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')))
  except Exception as error:
   receipt['error']=str(error)
   if sid:
    try:receipt['state']=retention_state(sid)
    except Exception:
     try:context(sid,'content');toolbar(sid);dashboard(sid);receipt['stateAfterDiagnosticReopen']=retention_state(sid)
     except Exception:pass
    try:(OUT/'retention-failure.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')))
    except Exception:pass
   raise
  finally:
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();(OUT/'installed-retention.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
