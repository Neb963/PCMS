"""P03 B: visible Pause/Resume, independent fixture effect, cold Unknown.
No fixture controls, endpoints or bypasses are shipped in the XPI.
"""
from installed_records import *

def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve()
 assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
 receipt={'tier':'B','source':json.loads((xpi.parent/'identity.json').read_text())['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]}
 with tempfile.TemporaryDirectory(prefix='pcms-queue-') as tmp:
  root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();home=root/'home';home.mkdir()
  env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'}
  log=open(OUT/'driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None
  try:
   wait(driver_ready,15);sid,caps=session(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'));assert int(caps['browserVersion'].split('.')[0])>=155
   assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID
   toolbar(sid);dashboard(sid);status(sid,'BRIDGE_MISSING')
   context(sid,'chrome');prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];receipt['sandbox']=prefs;context(sid,'content')
   wait(lambda:script(sid,"return document.getElementById('queue-status').textContent")=='Running')
   seeded=asyncjs(sid,"""
    const {openCore}=await import(browser.runtime.getURL('core/records.mjs'));const c=await openCore();await c.queue.boot();
    await c.mutate([{table:'modules',id:'fixture-module',value:{enabled:true,generation:1}},{table:'generators',id:'fixture-generator',value:{slug:'fixture-generator'}}],{step:'FIXTURE_SETUP',result:'COMPLETE'});
    let job=await c.queue.enqueue({requestId:'fixture-request',logicalKey:'fixture-save',moduleId:'fixture-module',targetId:'fixture-generator',accountId:'fixture-account',kind:'SAVE',batchId:'fixture-batch'});
    const duplicate=await c.queue.enqueue({requestId:'fixture-request',logicalKey:'fixture-save',moduleId:'fixture-module',targetId:'fixture-generator',kind:'SAVE'});if(duplicate.id!==job.id)throw Error('DUPLICATE');
    job=await c.queue.claim(job.id,job.rev);const ready=new Promise(resolve=>{
      window.fixturePending=c.queue.dispatch(job.id,job.rev,{operationId:'fixture-operation',kind:'SAVE',sourceWrite:true,preflight:async()=>({ok:true}),call:async()=>{
       const saved=await browser.storage.local.get('fixture-effects');await browser.storage.local.set({'fixture-effects':(saved['fixture-effects']??0)+1});resolve();await new Promise(()=>{});
      },observe:async()=>({matched:true,operationId:'fixture-operation'})});
    });await ready;return {jobId:job.id};
   """);assert 'jobId' in seeded,seeded
   click(sid,'#pause-core');wait(lambda:script(sid,"return document.getElementById('queue-status').textContent")=='Pausing')
   count=asyncjs(sid,"return (await browser.storage.local.get('fixture-effects'))['fixture-effects'];");assert count==1,count
   receipt['checks'].append('packaged-dispatch/independent-effect-count-one/visible-Pause/Pausing/deduplicated-intake')
   call('POST',f'/session/{sid}/window/new',{'type':'tab'});dashboard(sid);call('DELETE',f'/session/{sid}/window')
   # Force real nonpersistent background shutdown using Firefox's native
   # Extension object; do not replace it with a page refresh or handler call.
   context(sid,'chrome')
   terminated=asyncjs(sid,"""
    const {ExtensionParent}=ChromeUtils.importESModule('resource://gre/modules/ExtensionParent.sys.mjs');const ext=ExtensionParent.GlobalManager.getExtension(arguments[0]);
    const before=ext.backgroundState;if(typeof ext.terminateBackground!=='function')return {error:'TERMINATE_API_UNAVAILABLE',before};
    await ext.terminateBackground();return {before,after:ext.backgroundState};
   """,[ID]);assert terminated.get('after')=='stopped',terminated;receipt['termination']=terminated;context(sid,'content')
   toolbar(sid);dashboard(sid);status(sid,'BRIDGE_MISSING')
   wait(lambda:script(sid,"return document.getElementById('queue-status').textContent")=='Paused')
   click(sid,'nav a[href="#work"]');wait(lambda:'Unknown' in script(sid,"return document.getElementById('work-list')?.textContent||''"))
   click(sid,'#work-list a[href="#work/'+seeded['jobId']+'"]');wait(lambda:'fixture-generator' in script(sid,"return document.getElementById('records').textContent"))
   text=script(sid,"return document.getElementById('records').textContent");assert 'Unknown' in text and 'OUTCOME_UNKNOWN' in text and seeded['jobId'] in text,text
   receipt['checks'].append('dashboard-closed/native-event-page-termination/toolbar-wake/same-job/Unknown-exact-target/no-replay')
   click(sid,'#pause-core');wait(lambda:script(sid,"return document.getElementById('queue-status').textContent")=='Running')
   assert asyncjs(sid,"return (await browser.storage.local.get('fixture-effects'))['fixture-effects'];")==1
   still=asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs'));const c=await openCore();const job=await c.read('jobs',arguments[0]);const r={state:job.state,boundary:job.effect.boundary,next:await c.queue.next()};c.close();return r;",[seeded['jobId']]);assert still=={'state':'HELD','boundary':'POSSIBLE','next':None},still
   click(sid,'#pause-core');wait(lambda:script(sid,"return document.getElementById('queue-status').textContent")=='Paused')
   prior=stop(sid,profile);sid=None;sid,_=session(binary,profile);assert not prior.intersection(pids(profile));toolbar(sid);dashboard(sid);status(sid,'BRIDGE_MISSING')
   wait(lambda:script(sid,"return document.getElementById('queue-status').textContent")=='Paused')
   click(sid,'nav a[href="#work"]');wait(lambda:'Unknown' in script(sid,"return document.getElementById('work-list')?.textContent||''"))
   assert asyncjs(sid,"return (await browser.storage.local.get('fixture-effects'))['fixture-effects'];")==1
   receipt['checks'].append('visible-Resume/revalidation/no-replay-or-burst/new-process/durable-Pause-and-held-job/Core-recording')
   (OUT/'queue.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')));receipt['result']='PASS'
  except Exception as error:
   receipt['error']=str(error)
   if sid:
    try:(OUT/'queue-failure.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')))
    except Exception:pass
   raise
  finally:
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();(OUT/'installed-queue.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)

if __name__=='__main__':main()
