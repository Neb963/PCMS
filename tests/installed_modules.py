"""P04 B: opaque UI -> Core queue -> finite background, never live provider."""
from installed_records import *
import io,zipfile

def fixture():
 background="""PCMS.defineModule({start(){},async runStep(job,api){let denied=false;try{await api.query({table:'generators',id:'wrong-target'});}catch{denied=true;}if(!job.checkpoint)return {kind:'wait',dueAt:Date.now()+5000,checkpoint:{value:job.input.value+'!',count:1,denied}};return {kind:'complete',checkpoint:{value:job.checkpoint.value+'!',count:2,denied}};},reconcile(job){return {kind:'checkpoint',checkpoint:job.checkpoint};},stop(){}});"""
 html='<h2>Fixture page</h2><label for="draft">Draft</label><input id="draft"><button id="save">Save draft</button><button id="start">Run task</button><button id="isolation">Check isolation</button><p id="result" role="status"></p><script>parent.bad=true</script><img src="https://example.invalid/sentinel" onerror="parent.bad=true">'
 ui="""PCMS.getView().then(v=>{document.getElementById('draft').value=v?.draft??'';});document.getElementById('save').onclick=async()=>{await PCMS.saveView({draft:document.getElementById('draft').value});document.getElementById('result').textContent='Saved';};document.getElementById('start').onclick=async()=>{const j=await PCMS.action({name:'enqueue',requestId:'fixture-action-one',logicalKey:'fixture-action-one',targetId:'fixture-generator',kind:'CHECK',input:{value:'expected'}});document.body.dataset.job=j.id;document.getElementById('result').textContent='Queued';};document.getElementById('isolation').onclick=async()=>{let denied=false,network=false;try{await PCMS.query({table:'credentials',id:'github'});}catch{denied=true;}try{await fetch('https://example.invalid/denied');}catch{network=true;}document.getElementById('result').textContent=JSON.stringify({browser:typeof browser,denied,network});};"""
 payload={'background.js':background,'ui.html':html,'ui.js':ui,'ui.css':'body{font:15px system-ui;padding:20px}button,input{font:inherit;margin:8px;padding:8px}label{display:block}','broken.js':'throw Error("fixture-private-error")'}
 manifest={'format':1,'id':'fixture-module','name':'Fixture','version':'1.0.0','coreApi':1,'jobSchema':1,'readsJobSchemas':[1],'capabilities':['records.discover','jobs.discover'],'entries':{'background':'background.js'},'pages':[{'id':'main','title':'Main','html':'ui.html','script':'ui.js','style':'ui.css'},{'id':'broken','title':'Broken','html':'ui.html','script':'broken.js'}],'settingsSchema':1,'files':[{'path':p,'bytes':len(v.encode()),'sha256':hashlib.sha256(v.encode()).hexdigest()} for p,v in payload.items()]}
 output=io.BytesIO()
 with zipfile.ZipFile(output,'w') as z:
  z.writestr('module.json',json.dumps(manifest))
  for p,v in payload.items():z.writestr(p,v)
 return {'manifest':manifest,'payload':payload,'zip':base64.b64encode(output.getvalue()).decode()}

def frame(sid):
 element=call('POST',f'/session/{sid}/element',{'using':'css selector','value':'iframe.module-frame'})
 call('POST',f'/session/{sid}/frame',{'id':element})
def top(sid):call('POST',f'/session/{sid}/frame',{'id':None})
def type_text(sid,selector,text):
 element=call('POST',f'/session/{sid}/element',{'using':'css selector','value':selector});call('POST',f'/session/{sid}/element/'+element['element-6066-11e4-a52e-4f735466cecf']+'/value',{'text':text})

def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve()
 assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
 receipt={'tier':'B','source':json.loads((xpi.parent/'identity.json').read_text())['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]}
 with tempfile.TemporaryDirectory(prefix='pcms-module-') as tmp:
  root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();home=root/'home';home.mkdir();env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'}
  log=open(OUT/'driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None
  try:
   wait(driver_ready,15);sid,caps=session(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'));assert int(caps['browserVersion'].split('.')[0])>=155
   assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid);status(sid,'BRIDGE_MISSING')
   context(sid,'chrome');prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];receipt['sandbox']=prefs;context(sid,'content')
   seeded=asyncjs(sid,"""
    const f=arguments[0],{openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore();const payload={},refs=[];
    for(const [p,text] of Object.entries(f.payload)){payload[p]=await c.putBytes(new TextEncoder().encode(text));refs.push(payload[p]);}
    const zip=await c.putBytes(Uint8Array.from(atob(f.zip),x=>x.charCodeAt(0)));refs.push(zip);
    await c.mutate([{table:'modules',id:'fixture-module',value:{name:'Fixture',version:'1.0.0',enabled:true,generation:1,packageHash:zip,manifest:f.manifest,payload},refs},{table:'generators',id:'fixture-generator',value:{slug:'fixture-generator'}}],{step:'FIXTURE_SETUP',result:'COMPLETE'});c.close();return {seeded:true};
   """,[fixture()]);assert seeded=={'seeded':True},seeded
   click(sid,'nav a[href="#other"]');wait(lambda:'Fixture' in script(sid,"return document.getElementById('records').textContent"));click(sid,'#records a[href="#module/fixture-module/main"]')
   wait(lambda:script(sid,"return !!document.querySelector('iframe.module-frame')"));frame(sid);wait(lambda:script(sid,"return !!document.getElementById('start')"))
   assert script(sid,"return !!document.querySelector('script:not([src])')") is False
   assert script(sid,"return document.querySelector('img')?.getAttribute('src')") is None
   click(sid,'#isolation');wait(lambda:'network' in script(sid,"return document.getElementById('result').textContent"));isolated=json.loads(script(sid,"return document.getElementById('result').textContent"));assert isolated=={'browser':'undefined','denied':True,'network':True},isolated
   type_text(sid,'#draft','preserved draft');click(sid,'#save');wait(lambda:script(sid,"return document.getElementById('result').textContent")=='Saved')
   click(sid,'#start');wait(lambda:script(sid,"return document.body.dataset.job"));job=script(sid,"return document.body.dataset.job");top(sid)
   wait(lambda:asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs'));const c=await openCore();const j=await c.read('jobs',arguments[0]);c.close();return j?.state==='WAITING'&&j?.checkpoint?.count===1;",[job]),20)
   receipt['checks'].append('actual-module-control/opaque-sandbox/no-browser-or-network/credential-denied/sanitized-markup/draft-ack')
   # Close UI before second finite step; terminate background and let its real
   # deadline wake rebuild the runner. Inspect completion timestamp after UI
   # reopening to establish the effect happened while the dashboard was closed.
   call('POST',f'/session/{sid}/window/new',{'type':'tab'});dashboard(sid);call('DELETE',f'/session/{sid}/window');context(sid,'chrome')
   terminated=asyncjs(sid,"const {ExtensionParent}=ChromeUtils.importESModule('resource://gre/modules/ExtensionParent.sys.mjs');const e=ExtensionParent.GlobalManager.getExtension(arguments[0]);await e.terminateBackground();return {state:e.backgroundState};",[ID]);assert terminated['state']=='stopped';context(sid,'content');time.sleep(8)
   reopened=time.time()*1000;toolbar(sid);dashboard(sid);status(sid,'BRIDGE_MISSING')
   observed=asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs'));const c=await openCore();const j=await c.read('jobs',arguments[0]);c.close();return {state:j.state,checkpoint:j.checkpoint,time:j.updatedAt};",[job]);assert observed['state']=='COMPLETE' and observed['checkpoint']=={'value':'expected!!','count':2,'denied':True} and observed['time']<reopened,observed
   receipt['checks'].append('closed-dashboard/native-event-page-termination/alarm-wake/finite-background-completion/independent-expected-checkpoint')
   click(sid,'nav a[href="#other"]');click(sid,'#records a[href="#module/fixture-module/main"]');wait(lambda:script(sid,"return !!document.querySelector('iframe.module-frame')"));frame(sid);wait(lambda:script(sid,"return document.getElementById('draft')?.value")=='preserved draft');top(sid)
   click(sid,'#records a[href="#module/fixture-module/broken"]');wait(lambda:'Open Modules' in script(sid,"return document.getElementById('records').textContent"));click(sid,'#records a[href="#settings/modules/fixture-module"]');wait(lambda:script(sid,"return !!document.querySelector('.module-pin')"));click(sid,'.module-pin')
   wait(lambda:script(sid,"return !!document.querySelector('nav [data-pinned-module]')"));nav=script(sid,"return [...document.querySelectorAll('nav a')].map(a=>a.textContent)");assert nav[-2:]==['Fixture','Settings'],nav
   click(sid,'nav [data-pinned-module]');wait(lambda:script(sid,"return !!document.querySelector('iframe.module-frame')"));frame(sid);wait(lambda:script(sid,"return document.getElementById('draft')?.value")=='preserved draft');top(sid)
   call('POST',f'/session/{sid}/window/rect',{'width':480,'height':800});assert script(sid,"return document.querySelector('nav').scrollWidth>=document.querySelector('nav').clientWidth")
   receipt['checks'].append('same-page-pinning/Settings-last/secondary-menu/page-error-Open-Modules/narrow-layout/preserved-draft')
   (OUT/'modules.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')));receipt['result']='PASS'
  except Exception as error:
   receipt['error']=str(error)
   if sid:
    try:top(sid);(OUT/'modules-failure.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')))
    except Exception:pass
   raise
  finally:
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();(OUT/'installed-modules.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)

if __name__=='__main__':main()
