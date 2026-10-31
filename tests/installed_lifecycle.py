"""P07 B: actual Modules controls + production website STOP in a controlled
already-loaded editor document. No provider or route effects. Normal sandbox.
"""
from installed_packages import *
import http.server,threading

class Editor(http.server.BaseHTTPRequestHandler):
 def do_GET(self):
  body=b'<title>Controlled editor</title><textarea id="editor">base source</textarea><input id="dirty" value="yes"><p id="chat">retained fixture AI context</p>'
  self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers();self.wfile.write(body)
 def log_message(self,*args):pass

def package(path,version):
 f=fixture();m=f['manifest'];m['version']=version
 payload=f['payload'];payload['website.js']="const node=document.createElement('p');node.id='owned-module-node';node.textContent='module UI';document.body.append(node);const timer=setInterval(()=>{node.dataset.tick=String(Date.now());},100);PCMS.own(()=>{if(document.getElementById('dirty').value==='yes')throw Error('EDITOR_NEEDS_REVIEW');clearInterval(timer);node.remove();});"
 m['entries']['userscript']='website.js';m['userscript']={'matches':['https://perchance.org/*'],'lifecycle':1}
 m['files']=[{'path':p,'bytes':len(v.encode()),'sha256':hashlib.sha256(v.encode()).hexdigest()} for p,v in payload.items()]
 with zipfile.ZipFile(path,'w',compression=zipfile.ZIP_DEFLATED) as z:
  z.writestr('module.json',json.dumps(m))
  for p,v in payload.items():z.writestr(p,v)
 return path

def module(sid):
 return asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),m=await c.read('modules','fixture-module');c.close();return m?{version:m.version,enabled:m.enabled,generation:m.generation,lifecycle:m.lifecycle,state:m.state}:null;")
def manage(sid,kind):
 selector='#records section[data-module="fixture-module"] button[data-lifecycle="'+kind+'"]'
 wait(lambda:script(sid,'return !!document.querySelector(arguments[0])',[selector]));click(sid,selector)
def open_fixture(sid):
 click(sid,'nav a[href="#other"]');wait(lambda:script(sid,"return !!document.querySelector('#records a[href=\"#module/fixture-module/main\"]')"));click(sid,'#records a[href="#module/fixture-module/main"]');wait(lambda:script(sid,"return !!document.querySelector('iframe.module-frame')"));frame(sid);wait(lambda:script(sid,"return !!document.getElementById('draft')"))

def permission_choice(sid,allow):
 context(sid,'chrome')
 wait(lambda:script(sid,"return document.getElementById('notification-popup')?.state==='open'"))
 # The panel also contains hidden notification templates. Select the visible
 # native button, then its real shadow button, not the moz-button wrapper.
 element=wait(lambda:script(sid,"""const selector=arguments[0];for(const host of document.querySelectorAll(selector)){const r=host.getBoundingClientRect();if(r.width>0&&r.height>0)return host.shadowRoot?.querySelector('button')??host;}return null;""",['#notification-popup .popup-notification-'+('primary' if allow else 'secondary')+'-button']))
 call('POST',f'/session/{sid}/element/'+element['element-6066-11e4-a52e-4f735466cecf']+'/click',{})
 context(sid,'content')

def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve();identity=json.loads((xpi.parent/'identity.json').read_text())
 assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
 receipt={'tier':'B','source':identity['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]}
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Editor);threading.Thread(target=server.serve_forever,daemon=True).start()
 with tempfile.TemporaryDirectory(prefix='pcms-lifecycle-') as tmp:
  root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();home=root/'home';home.mkdir();first=package(root/'first.zip','1.0.0');update=package(root/'update.zip','1.1.0')
  env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'};log=open(OUT/'driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None
  try:
   wait(driver_ready,15);sid,caps=session(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'));assert int(caps['browserVersion'].split('.')[0])>=155
   # Load only the controlled document before installation. Do not alter donor
   # routing or use a real provider to obtain this fixture.
   call('POST',f'/session/{sid}/url',{'url':'http://127.0.0.1:'+str(server.server_port)+'/editor'});editor_handle=call('GET',f'/session/{sid}/window')
   type_text(sid,'#editor',' human changes Ω');expected_source=script(sid,"return document.getElementById('editor').value")
   assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid);status(sid,'BRIDGE_MISSING')
   context(sid,'chrome');prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];receipt['sandbox']=prefs;context(sid,'content')
   settings(sid);wait(lambda:script(sid,"return !!document.getElementById('allow-userscripts')"));click(sid,'#allow-userscripts')
   permission_choice(sid,False);wait(lambda:'still blocked' in script(sid,"return document.getElementById('records').textContent"))
   receipt['checks'].append('real-optional-permission-denial/visible-recovery')
   click(sid,'#allow-userscripts');permission_choice(sid,True)
   wait(lambda:script(sid,"return !document.getElementById('allow-userscripts')"))
   select(sid,first);click(sid,'#install-module');wait(lambda:'Installed.' in script(sid,"return document.getElementById('import-result').textContent"));open_fixture(sid);type_text(sid,'#draft','saved draft Ω');click(sid,'#save');wait(lambda:script(sid,"return document.getElementById('result').textContent")=='Saved');top(sid)
   setup=asyncjs(sid,"""
    const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),{wrapper}=await import(browser.runtime.getURL('host/website-scripts.mjs')),{worldIdForScript}=await import(browser.runtime.getURL('lib/userscripts.js'));
    const c=await openCore(),m=await c.read('modules','fixture-module'),tab=(await browser.tabs.query({})).find(t=>t.url.startsWith('http://127.0.0.1:')),frame=(await browser.webNavigation.getAllFrames({tabId:tab.id})).find(f=>f.frameId===0),worldId=await worldIdForScript('pcms:'+m.id+':'+m.generation);
    const i={instance:crypto.randomUUID(),document:frame.documentId,type:'website',tabId:tab.id,frameId:0,worldId,generation:m.generation,containerId:tab.cookieStoreId};
    await browser.userScripts.configureWorld({worldId,messaging:true});const code=new TextDecoder().decode(await c.bytes(m.payload['website.js']));const result=await browser.userScripts.execute({target:{tabId:tab.id,documentIds:[i.document]},world:'USER_SCRIPT',worldId,js:[{code:wrapper(code,i)}]});
    if(result[0].result!==i.instance)throw Error('FIXTURE_INJECTION_FAILED');await c.mutate([{table:'modules',id:m.id,expectedRev:m.rev,refs:m.refs,value:{...m,instances:[i]}}],{step:'FIXTURE_SETUP',result:'COMPLETE'});
    await c.mutate([{table:'generators',id:'fixture-generator',value:{slug:'fixture-generator'}}],{step:'FIXTURE_SETUP',result:'COMPLETE'});
    const job=await c.queue.enqueue({requestId:'unfinished',logicalKey:'unfinished',moduleId:m.id,targetId:'fixture-generator',kind:'CHECK',input:{exact:'retained'},dueAt:Date.now()+3600000});c.close();return {job:job.id,tab:tab.id,worldId};
   """);assert setup.get('job'),setup
   settings(sid);select(sid,update);click(sid,'#install-module');wait(lambda:script(sid,"return document.querySelector('section[data-module=\"fixture-module\"]')?.textContent.includes('staged')"));manage(sid,'UPDATE')
   wait(lambda:module(sid).get('lifecycle',{}).get('code')=='MODULE_STOP_INCOMPLETE',25);held=module(sid);assert held['version']=='1.0.0' and held['generation']==2 and not held['enabled'],held
   # Old bound sandbox requests cannot enqueue after the durable fence.
   denied=asyncjs(sid,"const {bindingAllows}=await import(browser.runtime.getURL('modules/bindings.mjs'));return bindingAllows({window:null,channel:'old',moduleId:'fixture-module',hash:'old',generation:1,capabilities:new Set(['ui.view'])},{source:null,channel:'old',current:arguments[0],operation:'ui.view'});",[held]);assert denied is False
   click(sid,'#records section[data-module="fixture-module"] button:not([data-lifecycle])');wait(lambda:call('GET',f'/session/{sid}/window')==editor_handle)
   assert script(sid,"return document.getElementById('editor').value")==expected_source
   assert script(sid,"return document.getElementById('chat').textContent")=='retained fixture AI context'
   assert script(sid,"return !!document.getElementById('owned-module-node')")
   element=call('POST',f'/session/{sid}/element',{'using':'css selector','value':'#dirty'});call('POST',f'/session/{sid}/element/'+element['element-6066-11e4-a52e-4f735466cecf']+'/clear',{});type_text(sid,'#dirty','no')
   toolbar(sid);dashboard(sid);settings(sid);manage(sid,'CONTINUE');wait(lambda:module(sid).get('version')=='1.1.0' and module(sid).get('enabled'))
   call('POST',f'/session/{sid}/window',{'handle':editor_handle});assert script(sid,"return !document.getElementById('owned-module-node')");assert script(sid,"return document.getElementById('editor').value")==expected_source
   toolbar(sid);dashboard(sid);open_fixture(sid);wait(lambda:script(sid,"return document.getElementById('draft').value")=='saved draft Ω');top(sid)
   retained=asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),j=await c.read('jobs',arguments[0]);c.close();return {input:j.input,generation:j.generation,state:j.state};",[setup['job']]);assert retained=={'input':{'exact':'retained'},'generation':2,'state':'WAITING'},retained
   receipt['checks'].append('real-selected-ZIP-update/unfinished-job/exact-draft/production-website-STOP/dirty-editor-hold/contextual-focus/source-chat-preserved/disposer-removes-only-owned-UI/generation-fence')
   settings(sid);manage(sid,'DISABLE');wait(lambda:module(sid).get('state')=='DISABLED');assert not module(sid)['enabled']
   prior=stop(sid,profile);sid=None;sid,_=session(binary,profile);assert not prior.intersection(pids(profile));toolbar(sid);dashboard(sid);assert module(sid)['state']=='DISABLED' and module(sid)['generation']==3
   settings(sid);manage(sid,'ENABLE');wait(lambda:module(sid).get('enabled'));assert module(sid)['generation']==4
   receipt['checks'].append('actual-Disable/real-browser-restart/disabled-persistence/Enable/same-unfinished-work')
   receipt['result']='PASS'
  except Exception as error:
   receipt['error']=str(error)
   if sid:
    try:top(sid);(OUT/'lifecycle-failure.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')))
    except Exception:pass
   raise
  finally:
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();server.shutdown();(OUT/'installed-lifecycle.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
