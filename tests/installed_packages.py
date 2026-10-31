"""P05 B: real file input/Install, actual sandbox action, negative imports."""
from installed_modules import *

def write_package(path,version='1.0.0',duplicate=False,large=False):
 f=fixture();m=f['manifest'];m['version']=version
 payload=f['payload'].copy()
 if(large):payload['data.bin']='x'*(2*1024*1024);m['files'].append({'path':'data.bin','bytes':2*1024*1024,'sha256':hashlib.sha256(payload['data.bin'].encode()).hexdigest()})
 text=json.dumps(m)
 if duplicate:text=text.replace('"format": 1','"format": 1, "format": 1')
 with zipfile.ZipFile(path,'w',compression=zipfile.ZIP_DEFLATED) as z:
  z.writestr('module.json',text)
  for p,v in payload.items():z.writestr(p,v)
 return path

def select(sid,path):
 element=call('POST',f'/session/{sid}/element',{'using':'css selector','value':'#module-zip'})
 call('POST',f'/session/{sid}/element/'+element['element-6066-11e4-a52e-4f735466cecf']+'/value',{'text':str(path)})
def settings(sid):
 click(sid,'nav a[href="#settings"]');wait(lambda:script(sid,"return !!document.querySelector('#records a[href=\"#settings/modules\"]')"));click(sid,'#records a[href="#settings/modules"]');wait(lambda:script(sid,"return !!document.getElementById('module-zip')"))
def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve()
 assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
 receipt={'tier':'B','source':json.loads((xpi.parent/'identity.json').read_text())['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]}
 with tempfile.TemporaryDirectory(prefix='pcms-package-') as tmp:
  root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();home=root/'home';home.mkdir();good=write_package(root/'valid.zip');bad=write_package(root/'duplicate.zip',duplicate=True);large=write_package(root/'budget.zip',large=True);update=write_package(root/'update.zip',version='1.1.0')
  env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'};log=open(OUT/'driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None
  try:
   wait(driver_ready,15);sid,caps=session(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'));assert int(caps['browserVersion'].split('.')[0])>=155
   assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid);status(sid,'BRIDGE_MISSING')
   context(sid,'chrome');prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];receipt['sandbox']=prefs;context(sid,'content')
   asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs'));const c=await openCore();await c.mutate([{table:'generators',id:'fixture-generator',value:{slug:'fixture-generator'}}],{step:'FIXTURE_SETUP',result:'COMPLETE'});c.close();return true;")
   settings(sid);select(sid,good);click(sid,'#install-module');wait(lambda:'Installed.' in script(sid,"return document.getElementById('import-result').textContent"));click(sid,'#import-result a');wait(lambda:script(sid,"return !!document.querySelector('iframe.module-frame')"));frame(sid);wait(lambda:script(sid,"return !!document.getElementById('start')"))
   type_text(sid,'#draft','ZIP draft retained');click(sid,'#save');wait(lambda:script(sid,"return document.getElementById('result').textContent")=='Saved');click(sid,'#start');wait(lambda:script(sid,"return document.body.dataset.job"));job=script(sid,"return document.body.dataset.job");top(sid)
   complete=wait(lambda:asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs'));const c=await openCore();const j=await c.read('jobs',arguments[0]);c.close();return j?.state==='COMPLETE'?j.checkpoint:null;",[job]),20);assert complete=={'value':'expected!!','count':2,'denied':True},complete
   expected=asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs'));const c=await openCore();const m=await c.read('modules','fixture-module');const j=await c.queue.enqueue({requestId:'unfinished',logicalKey:'unfinished',moduleId:m.id,targetId:'fixture-generator',kind:'CHECK',dueAt:Date.now()+3600000});c.close();return {hash:m.packageHash,revision:m.rev,job:j.id};");assert expected['hash']==hashlib.sha256(good.read_bytes()).hexdigest()
   receipt['checks'].append('real-file-input/Install/original-ZIP-hash/open-module/actual-action/exact-finite-output/saved-draft')
   settings(sid);select(sid,bad);click(sid,'#install-module');wait(lambda:script(sid,"return document.getElementById('import-result').dataset.code")=='DUPLICATE_JSON_KEY');assert script(sid,"return document.getElementById('module-zip').files[0].name")=='duplicate.zip'
   element=call('POST',f'/session/{sid}/element',{'using':'css selector','value':'#module-budget'});call('POST',f'/session/{sid}/element/'+element['element-6066-11e4-a52e-4f735466cecf']+'/clear',{});type_text(sid,'#module-budget','1');select(sid,large);click(sid,'#install-module');wait(lambda:script(sid,"return document.getElementById('import-result').dataset.code")=='IMPORT_BUDGET_EXCEEDED')
   call('POST',f'/session/{sid}/element/'+element['element-6066-11e4-a52e-4f735466cecf']+'/clear',{});type_text(sid,'#module-budget','64');select(sid,update)
   injected=asyncjs(sid,"const bg=await browser.runtime.getBackgroundPage(),p=bg.IDBObjectStore.prototype,original=p.put;p.put=function(row){if(this.name==='modules')throw new DOMException('private quota fixture','QuotaExceededError');return original.call(this,row);};return true;");assert injected is True
   click(sid,'#install-module');wait(lambda:script(sid,"return document.getElementById('import-result').dataset.code")=='STORAGE_FULL');assert 'private quota' not in script(sid,"return document.body.textContent");assert script(sid,"return document.getElementById('module-zip').files[0].name")=='update.zip'
   preserved=asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs'));const c=await openCore();const m=await c.read('modules','fixture-module'),j=await c.read('jobs',arguments[0]),v=await c.view('module:fixture-module:main');c.close();return {hash:m.packageHash,revision:m.rev,version:m.version,staged:m.staged??null,job:j.state,draft:v.draft};",[expected['job']]);assert preserved=={'hash':expected['hash'],'revision':expected['revision'],'version':'1.0.0','staged':None,'job':'WAITING','draft':'ZIP draft retained'},preserved
   select(sid,good);click(sid,'#install-module');wait(lambda:'already installed' in script(sid,"return document.getElementById('import-result').textContent"))
   receipt['checks'].append('duplicate-key-error/visible-budget-error/actual-IDB-quota/error-secret-redaction/selected-file-kept/registry-job-draft-preserved/identical-no-op')
   (OUT/'packages.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')));receipt['result']='PASS'
  except Exception as error:
   receipt['error']=str(error)
   if sid:
    try:top(sid);(OUT/'packages-failure.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')))
    except Exception:pass
   raise
  finally:
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();(OUT/'installed-packages.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)

if __name__=='__main__':main()
