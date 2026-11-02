"""P40 S/B/DSK. Reuse the qualified production manual-export journey under load.
Only test-side local synthetic records/HTTPS/native fixtures are used.
"""
import installed_backup_export as base
from installed_packages import *
from installed_journal import set_input
import threading,platform

metrics={'tier':'S/B/DSK/P40','hardware':{'platform':platform.platform(),'logicalCpus':os.cpu_count()},'archives':[],'exports':[],'aggregateFirefoxRssPeakBytes':0}
fixture=None
original_setup=base.setup_model
original_read=base.read_archive
original_completed=base.completed

def rss():
 total=0
 for p in pathlib.Path('/proc').iterdir():
  if not p.name.isdigit():continue
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
 asyncjs(sid,"const n=arguments[0];globalThis.__capacitySeed={phase:'starting'};void(async()=>{const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore();try{"+source+";return await seedCapacity(c,{existingAccounts:n,progress:p=>globalThis.__capacitySeed=p});}finally{c.close();}})().then(result=>globalThis.__capacitySeed={result},error=>globalThis.__capacitySeed={error:String(error)});return true;",[len(ids)])
 def seeded():
  state=script(sid,'return globalThis.__capacitySeed;')
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
  metrics['exports'].append({'jobId':id,'waitMs':(time.monotonic()-start)*1000,'barrierMs':capture['receipt']['barrierMs'],'verifiedBytes':capture.get('verifiedBytes')})
 return result

def main():
 identity=json.loads((pathlib.Path(sys.argv[1]).resolve().parent/'identity.json').read_text());metrics.update(source=identity['source'],xpiSha256=identity['xpiSha256'])
 metrics['hardware']['memoryBytes']=int(next(line.split()[1] for line in pathlib.Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemTotal:')))*1024
 stop=threading.Event()
 def sample():
  while not stop.wait(.25):metrics['aggregateFirefoxRssPeakBytes']=max(metrics['aggregateFirefoxRssPeakBytes'],rss())
 worker=threading.Thread(target=sample,daemon=True);worker.start();base.setup_model=setup;base.read_archive=read;base.completed=completed
 try:
  base.main();assert len(metrics['archives'])>=2 and len(metrics['exports'])>=2;metrics['result']='PASS'
 finally:
  stop.set();worker.join();(OUT/'installed-capacity.json').write_text(json.dumps(metrics,indent=2)+'\n');print(json.dumps(metrics),flush=True)
if __name__=='__main__':main()
