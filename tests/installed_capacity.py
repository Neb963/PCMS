"""P40 S/B/DSK. Reuse the qualified production manual-export journey under load.
Only test-side local synthetic records/HTTPS/native fixtures are used.
"""
import installed_backup_export as base
from installed_packages import *
from installed_journal import set_input
import threading,platform

metrics={'tier':'S/B/DSK/P40','hardware':{'platform':platform.platform(),'logicalCpus':os.cpu_count()},'archives':[],'exports':[],'aggregateFirefoxRssPeakBytes':0,'sampledFirefoxCpuSeconds':0}
fixture=None
capacity_profile=None
original_session=base.account_session
def scoped_session(binary,profile):
 global capacity_profile
 capacity_profile=str(profile)
 return original_session(binary,profile)

def scoped_pids():
 parents={};roots=[]
 for p in pathlib.Path('/proc').iterdir():
  if not p.name.isdigit():continue
  try:
   fields=(p/'stat').read_text().rsplit(')',1)[1].split();parents[p.name]=fields[1]
   if capacity_profile and capacity_profile.encode() in (p/'cmdline').read_bytes() and (p/'exe').resolve().name in ['firefox','firefox-bin']:roots.append(p.name)
  except (OSError,IndexError):pass
 selected=set(roots)
 for _ in range(12):
  more={pid for pid,parent in parents.items() if parent in selected}-selected
  if not more:break
  selected.update(more)
 return selected

original_setup=base.setup_model
original_read=base.read_archive
original_completed=base.completed

def rss():
 total=0
 selected=scoped_pids()
 for p in pathlib.Path('/proc').iterdir():
  if p.name not in selected:continue
  try:
   exe=(p/'exe').resolve().name
   if exe not in ['firefox','firefox-bin']:continue
   for line in (p/'status').read_text().splitlines():
    if line.startswith('VmRSS:'):total+=int(line.split()[1])*1024
  except (OSError,ValueError):pass
 return total

def setup(sid,ids):
 global fixture
 call('POST',f'/session/{sid}/timeouts',{'script':180000})
 model=original_setup(sid,ids)
 source=pathlib.Path(__file__).with_name('capacity-fixture.mjs').read_text().replace('export async function','async function')
 started=asyncjs(sid,"const n=arguments[0];window.__capacitySeed={phase:'starting'};void(async()=>{const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore();try{"+source+";return await seedCapacity(c,{existingAccounts:n,progress:p=>window.__capacitySeed=p});}finally{c.close();}})().then(result=>window.__capacitySeed={result},error=>window.__capacitySeed={error:String(error)});return true;",[len(ids)])
 assert started is True,started
 def seeded():
  state=script(sid,'return window.__capacitySeed;')
  assert state is not None,'CAPACITY_SEED_OBSERVATION_LOST'
  if state.get('error'):raise AssertionError(state)
  return state.get('result')
 fixture=wait(seeded,180)
 assert fixture.get('accounts')==50,fixture
 metrics['fixture']=fixture
 # Read through the installed global query UI, beyond the first page. The
 # captured source model is not changed by inspecting search/list results.
 start=time.monotonic();set_input(sid,'#global-search','scale-generator-');click(sid,'#global-search-form button');wait(lambda:script(sid,"return document.querySelectorAll('#global-results a').length===20"),30)
 for n in range(3):
  before=script(sid,"return document.querySelector('#global-results a').getAttribute('href')");click(sid,'#global-next');wait(lambda:script(sid,"return document.querySelector('#global-results a')?.getAttribute('href')!==arguments[0]",[before]),30)
 metrics['fourGlobalPagesMs']=(time.monotonic()-start)*1000
 asyncjs(sid,"const bg=await browser.runtime.getBackgroundPage();bg.__capacityVersionReads=0;const old=bg.IDBCursor.prototype.continue;bg.IDBCursor.prototype.continue=function(...args){if((this.source.objectStore?.name??this.source.name)==='versions')bg.__capacityVersionReads++;return old.apply(this,args);};return true;")
 repeated=[]
 for _ in range(3):
  script(sid,"window.__searchObserved=false;const o=new MutationObserver(()=>{if(document.getElementById('global-search-status').textContent!=='Searching…'){window.__searchObserved=true;o.disconnect();}});o.observe(document.getElementById('global-search-status'),{childList:true,characterData:true,subtree:true});")
  before=time.monotonic();click(sid,'#global-search-form button');wait(lambda:script(sid,'return window.__searchObserved;'),30);repeated.append((time.monotonic()-before)*1000)
 metrics['warmRepeatedGlobalSearch']={'uiRoundTripsMs':repeated,'backgroundVersionCursorReads':asyncjs(sid,"return (await browser.runtime.getBackgroundPage()).__capacityVersionReads;")}

 start=time.monotonic();set_input(sid,'#global-search','scale-generator-0999');click(sid,'#global-search-form button');wait(lambda:script(sid,"return !!document.querySelector('#global-results a[href=\"#generators/scale-generator-0999\"]')"),30);metrics['exactLaterSearchMs']=(time.monotonic()-start)*1000
 result=asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore();try{let cursor=null,n=0,pages=0;const start=performance.now();do{const p=await c.list({table:'generators',cursor,limit:50});n+=p.rows.length;pages++;cursor=p.cursor;}while(cursor);await c.collect();const b=await c.readBlob(arguments[0]);return {n,pages,pagingMs:performance.now()-start,binaryBytes:b.size};}finally{c.close();}",[fixture['binaryHash']]);assert result['n']==1001 and result['binaryBytes']==fixture['binaryBytes'],result;metrics['corePagingRetention']=result
 return model

def read(path):
 start=time.monotonic();m,values,binaries=original_read(path)
 assert len(values['records/accounts.ndjson'])==50 and len(values['records/generators.ndjson'])==1001
 events=values['journal/events.ndjson'];synthetic=[e for e in events if e['step']=='SYNTHETIC_RECORDED_OPERATION'];assert len(synthetic)==90000
 assert max(e['time'] for e in synthetic)-min(e['time'] for e in synthetic)>=90*86400000-2
 data=binaries['blobs/'+fixture['binaryHash']];assert len(data)==32*1024*1024 and hashlib.sha256(data).hexdigest()==fixture['binaryHash']
 g=next(g for g in values['records/generators.ndjson'] if g['id']=='scale-generator-0999');assert g['previousGood']==fixture['old'] and g['sourceManifest']==fixture['current']
 metrics['archives'].append({'bytes':path.stat().st_size,'events':len(events),'generators':1001,'accounts':50,'binaryBytes':len(data),'independentReopenMs':(time.monotonic()-start)*1000})
 return m,values,binaries

def completed(sid,id):
 start=time.monotonic();result=original_completed(sid,id)
 if result['state']=='COMPLETE':
  capture=base.coverage(sid)['capture']['current'];assert capture['receipt']['barrierMs']<=5000,capture
  f=base.file_receipt(sid,id);native=asyncjs(sid,"const d=(await browser.downloads.search({id:arguments[0]}))[0];return {state:d.state,exists:d.exists,fileSize:d.fileSize,bytesReceived:d.bytesReceived,totalBytes:d.totalBytes,byExtensionId:d.byExtensionId};",[f['downloadId']]);assert native['state']=='complete' and native['exists'] and native['fileSize']==f['bytes'] and native['byExtensionId']==ID,native
  metrics['exports'].append({'jobId':id,'waitMs':(time.monotonic()-start)*1000,'barrierMs':capture['receipt']['barrierMs'],'captureMs':capture['finishedAt']-capture['startedAt'],'verifiedBytes':capture.get('verifiedBytes'),'native':native,'expectedBytes':f['bytes'],'expectedSha256':f['sha256']})
 return result

def main():
 identity=json.loads((pathlib.Path(sys.argv[1]).resolve().parent/'identity.json').read_text());metrics.update(source=identity['source'],xpiSha256=identity['xpiSha256'])
 metrics['hardware']['memoryBytes']=int(next(line.split()[1] for line in pathlib.Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemTotal:')))*1024
 metrics['hardware']['cpu']=next((line.split(':',1)[1].strip() for line in pathlib.Path('/proc/cpuinfo').read_text().splitlines() if line.startswith('model name')),'Unknown')
 started=time.monotonic()
 stop=threading.Event()
 def sample():
  previous={};ticks=os.sysconf('SC_CLK_TCK')
  while not stop.wait(.25):
   metrics['aggregateFirefoxRssPeakBytes']=max(metrics['aggregateFirefoxRssPeakBytes'],rss());current={}
   selected=scoped_pids()
   for p in pathlib.Path('/proc').iterdir():
    if p.name not in selected:continue
    try:
     if (p/'exe').resolve().name not in ['firefox','firefox-bin']:continue
     fields=(p/'stat').read_text().rsplit(')',1)[1].split();value=int(fields[11])+int(fields[12]);current[p.name]=value
     metrics['sampledFirefoxCpuSeconds']+=max(0,value-previous.get(p.name,value))/ticks
    except (OSError,ValueError,IndexError):pass
   previous=current
 worker=threading.Thread(target=sample,daemon=True);worker.start();base.account_session=scoped_session;base.setup_model=setup;base.read_archive=read;base.completed=completed
 try:
  if os.environ.get('PCMS_REAL_JOURNAL_ROUNDS')=='2':
   from installed_long_session import run
   base.main(after_checks=lambda sid,profile,disk,receipt:run(sid,profile,disk,receipt,lambda:{'aggregateFirefoxRssPeakBytes':metrics['aggregateFirefoxRssPeakBytes'],'sampledFirefoxCpuSeconds':metrics['sampledFirefoxCpuSeconds'],'currentFirefoxRssBytes':rss()}))
  else:base.main()
  assert len(metrics['archives'])>=2 and len(metrics['exports'])>=2;metrics['result']='PASS'
 finally:
  stop.set();worker.join();metrics['wallSeconds']=time.monotonic()-started;(OUT/'installed-capacity.json').write_text(json.dumps(metrics,indent=2)+'\n');print(json.dumps(metrics),flush=True)
if __name__=='__main__':main()
