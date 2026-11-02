"""R07 B/S/DSK postlude: two real 30-minute production Journal rounds.

Runs only in the representative-capacity profile after its existing fault/disk
checks. No clock, deadline, alarm or production implementation is replaced.
"""
from installed_packages import *
from installed_journal import journal,inspect as journal_state,read_zip,set_input,close_dashboard
from installed_backup_sessions import manage,inspect_paused

INTERVAL_MS=30*60*1000

def modules(sid):
 return asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),p=await c.list({table:'modules',limit:200}),rows=[];for(const r of p.rows){const m=await c.read('modules',r.id);rows.push({id:m.id,enabled:m.enabled,lifecycle:m.lifecycle??null,packageHash:m.packageHash});}c.close();return rows;")

def close_ui(sid):
 close_dashboard(sid);call('POST',f'/session/{sid}/window',{'handle':call('GET',f'/session/{sid}/window/handles')[0]})

def managed_proofs(sid):
 return asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),p=await c.list({table:'accounts',limit:200}),out=[];for(const r of p.rows){const a=await c.read('accounts',r.id);if(a.personaUid)out.push({id:a.id,state:a.state,routeId:a.routeId,routeObservedAt:a.routeObservedAt,protectionState:a.protection?.state,protectionObservedAt:a.protection?.observedAt,purpose:a.flow?.purpose,jobId:a.flow?.jobId});}c.close();return out;")

def run(sid,profile,disk,parent,resources):
 result={'tier':'B/S/DSK-real-duration-Journal','source':parent['source'],'xpiSha256':parent['xpiSha256'],'browserVersion':parent['browserVersion'],'buildId':parent['buildId'],'sandbox':parent['sandbox'],'rounds':[],'probes':[],'observations':[]}
 started=time.monotonic();expected=[];seen=set();paused=False
 try:
  manage(sid,'pcms-journal','ENABLE');manage(sid,'pcms-backup','ENABLE');journal(sid)
  if inspect_paused(sid):click(sid,'#pause-core');wait(lambda:not inspect_paused(sid))
  installed=modules(sid);assert len(installed)==7 and all(m['enabled'] and not m['lifecycle'] for m in installed),installed;result['modules']=installed
  before={f['id'] for f in journal_state(sid)['files']}
  set_input(sid,'#journal-interval','30');set_input(sid,'#journal-retention','90');set_input(sid,'#journal-folder','PCMS/Journal/LongSession');click(sid,'#save-journal-settings')
  settings=wait(lambda:(lambda s:s if s['journal']['intervalMinutes']==30 and s['journal']['retentionDays']==90 and s['journal']['folder']=='PCMS/Journal/LongSession' else None)(journal_state(sid)))['journal']
  deadline=settings['nextDue'];configured_at=deadline-INTERVAL_MS;assert abs(configured_at-time.time()*1000)<10000;result['configuredAt']=configured_at;result['initialDeadline']=deadline
  folder=disk/'PCMS'/'Journal'/'LongSession';next_probe=0;close_ui(sid)
  while len(result['rounds'])<2:
   elapsed=time.monotonic()-started;assert elapsed<3900,('REAL_ROUND_TIMEOUT',result['rounds'])
   fresh=[]
   if folder.exists():
    for path in folder.glob('auto-*.zip'):
     if path.name in seen:continue
     try:manifest,events=read_zip(path)
     except (zipfile.BadZipFile,AssertionError,EOFError,FileNotFoundError):continue
     fresh.append((path,manifest,events))
   if fresh:
    toolbar(sid);dashboard(sid);journal(sid)
    for path,manifest,events in sorted(fresh,key=lambda v:v[1]['first']):
     row=wait(lambda:next((f for f in journal_state(sid)['files'] if f['id'] not in before and f['automatic'] and f['state']=='COMPLETE' and disk/f['filename']==path),None),45)
     assert path.stat().st_size==row['bytes'] and hashlib.sha256(path.read_bytes()).hexdigest()==row['sha256']
     native=asyncjs(sid,"const d=(await browser.downloads.search({id:arguments[0]}))[0];return {state:d.state,exists:d.exists,fileSize:d.fileSize,byExtensionId:d.byExtensionId};",[row['downloadId']]);assert native=={'state':'complete','exists':True,'fileSize':row['bytes'],'byExtensionId':ID},native
     round_number=len(result['rounds'])+1;assert row['completedAt']>=configured_at+round_number*INTERVAL_MS-1000,('EARLY_AUTOMATIC_EXPORT',row)
     if result['rounds']:assert manifest['first']==result['rounds'][-1]['last']+1,('NON_INCREMENTAL_RANGE',manifest)
     probes=[e for e in events if e['step']=='LONG_SESSION_PROBE'];expected_in_cut=[p for p in expected if manifest['first']<=p['sequence']<=manifest['last']]
     assert [(e['sequence'],e['operationId']) for e in probes]==[(p['sequence'],p['operationId']) for p in expected_in_cut]
     assert [e['sequence'] for e in events]==list(range(manifest['first'],manifest['last']+1))
     result['rounds'].append({'id':row['id'],'automatic':True,'paused':paused,'completedAt':row['completedAt'],'realElapsedSeconds':elapsed,'first':manifest['first'],'last':manifest['last'],'count':manifest['count'],'sha256':row['sha256'],'bytes':row['bytes'],'probes':len(probes),'native':native,'resources':resources()});seen.add(path.name)
    assert len(result['rounds'])<=2,('DUPLICATE_AUTOMATIC_EXPORT',result['rounds'])
    if not paused:
     click(sid,'#pause-core');wait(lambda:inspect_paused(sid));paused=True
    close_ui(sid)
   if elapsed>=next_probe and len(result['rounds'])<2:
    toolbar(sid);dashboard(sid);tick=len(expected);operation='long-session-'+str(tick)
    observed=asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),r=await c.record({moduleId:'pcms-journal',targetId:'long-session-probe',operationId:arguments[0],step:'LONG_SESSION_PROBE',result:'COMPLETE'});c.close();return r;",[operation]);expected.append({'sequence':observed['sequence'],'operationId':operation})
    begin=time.monotonic();set_input(sid,'#global-search','scale-generator-0999');click(sid,'#global-search-form button');wait(lambda:script(sid,"return [...document.querySelectorAll('#global-results a')].some(a=>a.getAttribute('href')==='#generators/scale-generator-0999')"));latency=(time.monotonic()-begin)*1000
    click(sid,'nav a[href="#accounts"]');wait(lambda:script(sid,"return !!document.getElementById('account-search')"));set_input(sid,'#account-search','Synthetic account 49');wait(lambda:'Synthetic account 49' in script(sid,"return document.getElementById('account-list').textContent"));assert script(sid,"return document.getElementById('global-search').value")=='scale-generator-0999'
    result['observations'].append({'elapsedSeconds':elapsed,'queryMs':latency,'paused':inspect_paused(sid),'managedProofs':managed_proofs(sid),'resources':resources()});assert inspect_paused(sid)==paused
    print(json.dumps({'longSessionElapsedSeconds':round(elapsed),'automaticRounds':len(result['rounds']),'queryMs':round(latency,2)}),flush=True);next_probe=elapsed+60;close_ui(sid)
   time.sleep(10)
  toolbar(sid);dashboard(sid);journal(sid);assert inspect_paused(sid);assert all(m['enabled'] and not m['lifecycle'] for m in modules(sid));assert time.monotonic()-started>=3590
  assert sum(r['probes'] for r in result['rounds'])==len([p for p in expected if p['sequence']<=result['rounds'][-1]['last']])
  state=journal_state(sid);assert state['journal']['watermark']>=result['rounds'][-1]['last'] and state['journal']['intervalMinutes']==30 and state['journal']['retentionDays']==90
  result['probes']=expected;result['realSeconds']=time.monotonic()-started;result['result']='PASS';parent['checks'].append('real-two-30-minute-automatic-Journal-rounds/50-accounts-1k-generators-90k-history/loaded-typing-navigation-open-close/all-seven-enabled/second-round-global-Pause/native-download-and-independent-disk/range-continuity/every-causal-probe/no-clock-or-alarm-override');parent['longSession']=result
  return sid
 except Exception as error:
  result['error']=str(error);result['probes']=expected;result['realSeconds']=time.monotonic()-started;parent['longSession']=result;raise
 finally:(OUT/'installed-long-session.json').write_text(json.dumps(result,indent=2)+'\n')
