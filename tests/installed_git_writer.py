"""P13 B: real ZIP caller -> scoped sandbox/Core queue/Git service and Work.
Independent HTTPS backend uses actual disposable Git objects/refs. No remote.
"""
from installed_packages import *
from installed_journal import set_input
from installed_git_catalog import git_session,connections
from git_write_https_fixture import GitWriteFixture
from git_https_fixture import TOKEN
TARGET='git-fixture-target';MODULE='fixture-git-caller';SLUG='fixture-prepared'
def caller(path):
 background="""PCMS.defineModule({start(){},async runStep(job,api){return this.outcome(await api.action({name:'github.prepareFolder'}));},async reconcile(job,api){return this.outcome(await api.query({name:'github.prepareFolderStatus'}));},outcome(r){if(r.state==='COMPLETE')return {kind:'complete',checkpoint:{commit:r.receipt?.commit}};if(['CONTINUE','READY'].includes(r.state))return {kind:'checkpoint',checkpoint:{}};return {kind:'hold',reason:r.code||'GIT_WRITE_OUTCOME_UNKNOWN',recovery:{action:'CHECK_GIT'}};},stop(){}});"""
 html='<h2>Controlled scoped Git caller</h2><button id="direct">Check page denial</button><button id="prepare">Prepare fixture folder</button><p id="result" role="status"></p>'
 ui="""document.getElementById('direct').onclick=async()=>{let denied=false;try{await PCMS.action({name:'github.prepareFolder',targetId:'git-fixture-target'});}catch{denied=true;}document.body.dataset.denied=String(denied);document.getElementById('result').textContent=denied?'Unbound page call denied.':'Unexpected page authority';};document.getElementById('prepare').onclick=async()=>{const b=document.getElementById('prepare');b.disabled=true;try{const j=await PCMS.action({name:'enqueue',requestId:'fixture-git-prepare-once',logicalKey:'fixture-git-prepare-once',targetId:'git-fixture-target',kind:'GIT_PREPARE',input:{slug:'fixture-prepared'}});document.body.dataset.job=j.id;document.getElementById('result').textContent='Scoped preparation queued.';}finally{b.disabled=false;}};"""
 payload={'background.js':background,'ui.html':html,'ui.js':ui}
 manifest={'format':1,'id':MODULE,'name':'Controlled Git caller','version':'1.0.0','coreApi':1,'jobSchema':1,'readsJobSchemas':[1],'capabilities':['records.discover','jobs.discover','github.prepareFolder'],'entries':{'background':'background.js'},'pages':[{'id':'main','title':'Main','html':'ui.html','script':'ui.js'}],'settingsSchema':1,'files':[{'path':p,'bytes':len(v.encode()),'sha256':hashlib.sha256(v.encode()).hexdigest()} for p,v in payload.items()]}
 with zipfile.ZipFile(path,'w',compression=zipfile.ZIP_DEFLATED) as z:
  z.writestr('module.json',json.dumps(manifest))
  for p,v in payload.items():z.writestr(p,v)
 return path
def inspect(sid,id=None):
 return asyncjs(sid,"""const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore();let result;if(arguments[0])result=await c.read('jobs',arguments[0]);else{let cursor=null,jobs=[];do{const p=await c.list({table:'jobs',cursor});for(const j of p.rows)if(j.moduleId==='fixture-git-caller')jobs.push(await c.read('jobs',j.id));cursor=p.cursor;}while(cursor);result={jobs,queue:await c.queue.status(),catalog:await c.view('git-catalog')};}c.close();return result;""",[id])
def work(sid,id):
 click(sid,'nav a[href="#work"]');wait(lambda:script(sid,"return !!document.querySelector('#work-list a[href=\"#work/'+arguments[0]+'\"]')",[id]));click(sid,'#work-list a[href="#work/'+id+'"]');wait(lambda:script(sid,"return !!document.getElementById('git-job-check')"))
def writes(f):return [r for r in f.requests() if r['method']!='GET']
def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve();identity=json.loads((xpi.parent/'identity.json').read_text());assert not identity['dirty'];assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
 receipt={'tier':'B/actual-Git-plumbing-HTTPS-fixture','source':identity['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]};assert receipt['xpiSha256']==identity['xpiSha256']
 with tempfile.TemporaryDirectory(prefix='pcms-git-writer-') as tmp:
  root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();home=root/'home';home.mkdir();fixture=GitWriteFixture(root);baseline=fixture.snapshot();fixture.start();package=caller(root/'caller.zip');receipt['callerSha256']=hashlib.sha256(package.read_bytes()).hexdigest()
  env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'};log=open(OUT/'driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None;job_id=None
  try:
   wait(driver_ready,15);sid,caps=git_session(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'));assert int(caps['browserVersion'].split('.')[0])>=155 and caps['acceptInsecureCerts'] is False
   context(sid,'chrome');script(sid,"Components.classes['@mozilla.org/security/x509certdb;1'].getService(Components.interfaces.nsIX509CertDB).addCertFromBase64(arguments[0],'C,,');return true;",[base64.b64encode(fixture.ca).decode()]);prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];receipt['sandbox']=prefs;context(sid,'content')
   assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid);connections(sid);set_input(sid,'#git-repository','fixture/catalog');set_input(sid,'#git-token',TOKEN);click(sid,'#git-save');wait(lambda:'Connection saved' in script(sid,"return document.getElementById('git-result').textContent"));wait(lambda:inspect(sid)['catalog']['scan'] is None)
   asyncjs(sid,"""const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore();await c.mutate([{table:'generators',id:'git-fixture-target',value:{slug:'fixture-prepared',folder:'generators/fixture-prepared',repositoryId:'314159',state:'FOLDER_ONLY'}}],{step:'FIXTURE_SCOPED_CALLER_TARGET',result:'COMPLETE'});c.close();return true;""")
   settings(sid);select(sid,package);click(sid,'#install-module');wait(lambda:'Installed.' in script(sid,"return document.getElementById('import-result').textContent"));click(sid,'#import-result a');wait(lambda:script(sid,"return !!document.querySelector('iframe.module-frame')"));frame(sid);wait(lambda:script(sid,"return !!document.getElementById('prepare')"));click(sid,'#direct');wait(lambda:script(sid,"return document.body.dataset.denied")=='true');assert writes(fixture)==[]
   click(sid,'#prepare');job_id=wait(lambda:script(sid,"return document.body.dataset.job"));top(sid);wait(lambda:any(r['path']=='/git/blobs' for r in writes(fixture)));click(sid,'#pause-core');wait(lambda:inspect(sid)['queue']['state']=='PAUSED');paused=len(writes(fixture));time.sleep(1.3);assert len(writes(fixture))==paused;click(sid,'#pause-core');wait(lambda:not inspect(sid)['queue']['paused'])
   work(sid,job_id);pending=wait(lambda:next((j for j in [inspect(sid,job_id)] if j.get('effect',{}).get('boundary')=='POSSIBLE' and j['git']['active']['phase']=='REF' and any(r.get('lost') for r in writes(fixture))),None),90);operation=pending['effect']['operationId'];applied=fixture.snapshot();assert len(applied['operations'])==1 and applied['head']==pending['git']['active']['plan']['candidate'];assert TOKEN not in json.dumps(pending)
   receipt['checks'].append('real-ZIP-caller/page-authority-denied/exact-host-held-target/real-Pause-between-object-calls/nonforced-concurrent-ref-rejection/applied-ref-reply-lost')
   prior=stop(sid,profile);sid=None;sid,_=git_session(binary,profile);assert not prior.intersection(pids(profile));toolbar(sid);dashboard(sid);held=wait(lambda:next((j for j in [inspect(sid,job_id)] if j['state']=='HELD' and j['git']['active']['phase']=='VERIFY' and j['effect']['boundary']=='OBSERVED'),None),35);assert held['effect']['operationId']==operation and held['effect']['disposition']=='APPLIED';work(sid,job_id);assert 'No verified Git completion' in script(sid,"return document.getElementById('git-job-state').textContent")
   fixture.controls(hide_applied_commits=False);before_check=len(writes(fixture));click(sid,'#git-job-check');wait(lambda:inspect(sid,job_id)['state']=='COMPLETE',35);finished=inspect(sid,job_id);assert len(writes(fixture))==before_check;assert finished['git']['active']['receipt']['applied'] is True
   snapshot=fixture.snapshot();proof=finished['git']['active']['receipt'];assert len(snapshot['operations'])==1 and proof['commit']==snapshot['head'];assert snapshot['operations'][0]['parents']==[{'sha':snapshot['controls']['raceHead']}]
   for path,value in baseline['files'].items():
    if path!='README.md':assert snapshot['files'][path]==value,(path,value,snapshot['files'].get(path))
   assert snapshot['files']['README.md']['mode']=='100755' and base64.b64decode(snapshot['files']['README.md']['bytes'])==b'independent concurrent README edit\n';assert base64.b64decode(snapshot['files']['generators/'+SLUG+'/DEPLOYMENT.md']['bytes'])==b'Format: PCMS-1\nVersion: v1\nAction: DEVELOP\nStatus: NOT_READY\n'
   refs=[r for r in writes(fixture) if r['method']=='PATCH'];assert len(refs)==2 and all(r['force'] is False for r in refs) and len([r for r in refs if r.get('lost')])==1 and len([r for r in refs if r['status']==422])==1;assert len([r for r in writes(fixture) if r['path']=='/git/blobs'])==1
   count=len(writes(fixture));click(sid,'nav a[href="#other"]');wait(lambda:script(sid,"return !!document.querySelector('#records a[href=\"#module/fixture-git-caller/main\"]')"));click(sid,'#records a[href="#module/fixture-git-caller/main"]');wait(lambda:script(sid,"return !!document.querySelector('iframe.module-frame')"));frame(sid);wait(lambda:script(sid,"return !!document.getElementById('prepare')"));click(sid,'#prepare');wait(lambda:script(sid,"return document.body.dataset.job")==job_id);top(sid);time.sleep(1.2);assert len(writes(fixture))==count and len(inspect(sid)['jobs'])==1
   receipt['checks'].append('real-process-restart/same-operation-readback/no-early-verification/actual-Work-Check/independent-real-Git-commit-parent-tree-blobs/protected-modes-binary-bytes/concurrent-README-preserved/one-reachable-logical-commit/no-ref-replay/duplicate-control-no-new-job-or-write');receipt['proof']=proof;receipt['writes']=writes(fixture);receipt['result']='PASS';work(sid,job_id);(OUT/'git-writer.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')))
  except Exception as error:
   receipt['error']=str(error);receipt['writes']=writes(fixture)
   if sid:
    try:top(sid);dashboard(sid);receipt['state']=inspect(sid,job_id) if job_id else inspect(sid);receipt['uiResult']=script(sid,"return document.getElementById('git-result')?.textContent??document.getElementById('git-job-result')?.textContent??''");(OUT/'git-writer-failure.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')))
    except Exception:pass
   print(json.dumps(receipt),flush=True);raise
  finally:
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();fixture.close();receipt['fixtureDiagnostics']=fixture.proc.stderr.read()[-4000:];
   if receipt.get('error'):print(json.dumps(receipt),flush=True)
   (OUT/'installed-git-writer.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
