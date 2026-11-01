"""P33 bootstrap boundary B only (full File/restore/activation journey pending).
Actual MV3 registration/request admission/private world/document_start. Synthetic
local provider/bridge; raw auth stays in memory and never enters receipts.
"""
from installed_backup_sessions import manage
from installed_accounts import account_session,add,settle,account
from installed_lifecycle import permission_choice
from installed_packages import *
import account_fixture as af
OriginalProvider=af.Provider
class BootstrapProvider(OriginalProvider):
 def do_GET(self):
  if self.headers.get('Host','').split(':')[0]!='perchance.org':return super().do_GET()
  return self.send(b'''<!doctype html><meta charset="utf-8"><script>const first={app:JSON.parse(localStorage.getItem('app-storage')),guard:localStorage.getItem('sessionTokenLastChangeTime')};globalThis.fixtureFirst=first;fetch('/fixture/first',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(first)});const state=first.app||{};state.AI??={nativeDefault:true};localStorage.setItem('app-storage',JSON.stringify(state));</script><title>Disposable bootstrap fixture</title><h1>Local application startup fixture</h1>''','text/html')
 def do_POST(self):
  if self.path=='/fixture/first':
   body=self.body()
   with self.server.fixture.lock:self.server.fixture.first.setdefault(self.route,[]).append(body)
   return self.send({'ok':True})
  return super().do_POST()
af.Provider=BootstrapProvider

def private(sid,source,args=None):
 return asyncjs(sid,"const bg=await browser.runtime.getBackgroundPage();"+source,args or [])
def setup(sid,container,auth,nonce,operation):
 return asyncjs(sid,"""const {createRestoreBootstrap}=await import(browser.runtime.getURL('host/restore-bootstrap.mjs'));if(!globalThis.__P33_BOOTSTRAP)globalThis.__P33_BOOTSTRAP=createRestoreBootstrap({api:browser});const tab=await browser.tabs.create({cookieStoreId:arguments[0],url:'about:blank',active:false}),auth=arguments[1],hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(auth))))].map(n=>n.toString(16).padStart(2,'0')).join(''),input={operationId:arguments[3],nonce:arguments[2],tabId:tab.id,containerId:arguments[0],auth,authHash:hash};globalThis.__P33_INPUT=input;const r=await globalThis.__P33_BOOTSTRAP.arm(input,async()=>true);return {tab:tab.id,url:r.url};""",[container,auth,nonce,operation])
def observed(sid):
 return asyncjs(sid,"return await globalThis.__P33_BOOTSTRAP.observe(globalThis.__P33_INPUT);")
def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve();identity=json.loads((xpi.parent/'identity.json').read_text());assert not identity['dirty'];assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
 receipt={'tier':'B-private-bootstrap-boundary/full-P33-UI-and-activation-pending','source':identity['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]};assert receipt['xpiSha256']==identity['xpiSha256']
 with tempfile.TemporaryDirectory(prefix='pcms-auth-start-') as tmp:
  root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();home=root/'home';home.mkdir();fixture=af.Fixture(root);fixture.first={};fixture.start_catalog();fixture.install_bridge(home,root)
  env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'};log=open(OUT/'driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None
  try:
   wait(driver_ready,15);sid,caps=account_session(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'));assert int(caps['browserVersion'].split('.')[0])>=155 and caps['acceptInsecureCerts'] is False;context(sid,'chrome');script(sid,"Components.classes['@mozilla.org/security/x509certdb;1'].getService(Components.interfaces.nsIX509CertDB).addCertFromBase64(arguments[0],'C,,');return true;",[base64.b64encode(fixture.ca).decode()]);prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];receipt['sandbox']=prefs;context(sid,'content')
   assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid);settings(sid);wait(lambda:script(sid,"return !!document.getElementById('allow-userscripts')"));click(sid,'#allow-userscripts');permission_choice(sid,True);wait(lambda:script(sid,"return !document.getElementById('allow-userscripts')"))
   ids=[]
   for label in ['Bootstrap target','Unrelated protected target']:
    id=add(sid,label);settle(sid,id,'LOGIN_REQUIRED');ids.append(id)
   one,two=[account(sid,id) for id in ids];dashboard(sid)
   asyncjs(sid,"await browser.scripting.executeScript({target:{tabId:arguments[0],frameIds:[0]},world:'ISOLATED',func:()=>{localStorage.setItem('app-storage',JSON.stringify({AI:{freshDefault:'untouched'},setting:17}));}});return true;",[one['tabId']])
   baseline=len(fixture.first.get(two['routeId'],[]));auth={'adapter':'perchance-auth-1','schema':1,'origin':'https://perchance.org','userPresent':True,'user':{'loggedIn':True,'email':'bootstrap@fixture.test','sessionToken':'exact-'+chr(0)+'雪\r\n'},'guardPresent':True,'sessionTokenLastChangeTime':'000123.50'}
   target=setup(sid,one['containerId'],auth,'12345678-1234-4234-8234-123456789abc','bootstrap-boundary-one')
   # Both accounts have independently prepared protected routes. A copied URL
   # in the unrelated prepared container must be cancelled by the new guard.
   wrong=asyncjs(sid,"return (await browser.tabs.create({cookieStoreId:arguments[0],url:arguments[1],active:false})).id;",[two['containerId'],target['url']]);wait(lambda:asyncjs(sid,"return (await browser.tabs.get(arguments[0])).status==='complete';",[wrong]),25)
   assert len(fixture.first.get(two['routeId'],[]))==baseline,'COPIED_URL_REACHED_UNRELATED_APPLICATION'
   assert asyncjs(sid,"const r=await browser.scripting.executeScript({target:{tabId:arguments[0],frameIds:[0]},world:'ISOLATED',func:()=>JSON.parse(localStorage.getItem('app-storage'))});return !r[0].result?.user;",[two['tabId']]),'UNRELATED_AUTH_CHANGED'
   asyncjs(sid,"await browser.tabs.update(arguments[0],{url:arguments[1]});return true;",[target['tab'],target['url']]);wait(lambda:bool(fixture.first.get(one['routeId'],[])) and fixture.first[one['routeId']][-1].get('app',{}).get('user')==auth['user'],30);first=fixture.first[one['routeId']][-1];assert first['guard']==auth['sessionTokenLastChangeTime'] and first['app']['AI']=={'freshDefault':'untouched'} and first['app']['setting']==17
   result=wait(lambda:next((r for r in [observed(sid)] if r.get('ok')),None),30);assert result['tabId']==target['tab'] and result['containerId']==one['containerId'];receipt['checks'].append('actual-MV3-userScripts/private-world/document_start-before-independent-first-site-script/exact-NUL-Unicode-auth-and-guard/fresh-default-merge/copied-URL-denied-in-a-second-prepared-protected-container')
   # A revisit of the original operation ticket cannot overwrite later native
   # rotation. Do not mistake its historical receipt for fresh byte validation.
   asyncjs(sid,"await browser.scripting.executeScript({target:{tabId:arguments[0],frameIds:[0]},world:'ISOLATED',func:()=>{const s=JSON.parse(localStorage.getItem('app-storage'));s.user.sessionToken='native-rotated';localStorage.setItem('app-storage',JSON.stringify(s));}});await browser.tabs.update(arguments[0],{url:arguments[1]});return true;",[target['tab'],target['url']]);wait(lambda:fixture.first[one['routeId']][-1].get('app',{}).get('user',{}).get('sessionToken')=='native-rotated',30)
   asyncjs(sid,"await globalThis.__P33_BOOTSTRAP.remove(globalThis.__P33_INPUT);return true;");assert asyncjs(sid,"return !(await browser.userScripts.getScripts()).some(s=>s.id==='pcms-restore-bootstrap-boundary-one');");receipt['checks'].append('actual-ticket-revisit/one-use-marker/no-auth-replay-or-rotation-overwrite/exact-script-unregistered-after-receipt')
   second=setup(sid,one['containerId'],auth,'abcdef01-2345-4234-8234-123456789abc','bootstrap-boundary-conflict');asyncjs(sid,"await browser.tabs.update(arguments[0],{url:arguments[1]});return true;",[second['tab'],second['url']]);held=wait(lambda:next((r for r in [observed(sid)] if r.get('code')=='RESTORE_AUTH_CONFLICT'),None),30);assert not held['ok'];assert fixture.first[one['routeId']][-1]['app']['user']['sessionToken']=='native-rotated';asyncjs(sid,"await globalThis.__P33_BOOTSTRAP.remove(globalThis.__P33_INPUT);await globalThis.__P33_BOOTSTRAP.close();return true;")
   assert fixture.receipt()['unexpected']==[];receipt['checks'].append('actual-current-login-conflict/named-private-receipt/no-overwrite/no-activation-or-operational-login-claim');receipt['result']='PASS'
  except Exception as error:
   receipt['error']=str(error)
   if sid:
    try:receipt['diagnostic']=observed(sid)
    except Exception:pass
   print(json.dumps(receipt),flush=True);raise
  finally:
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();fixture.close();(OUT/'installed-restore-auth.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
