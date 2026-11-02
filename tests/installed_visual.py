"""R06: independent installed pixel capture; functional receipts remain separate."""
from installed_ui_continuity import *
from visual_capture import matrix,capture,viewport,state_matrix

def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve();identity=json.loads((xpi.parent/'identity.json').read_text());assert not identity['dirty'];assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
 receipt={'tier':'B/pixel-capture-NOT-vision-verdict','visualSuite':'visual-only','source':identity['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]};assert receipt['xpiSha256']==identity['xpiSha256']
 with tempfile.TemporaryDirectory(prefix='pcms-visual-') as tmp:
  root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();home=root/'home';home.mkdir();provider=Fixture(root);configure(provider);provider.start_catalog();provider.install_bridge(home,root)
  env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'};log=open(OUT/'visual-driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None
  try:
   wait(driver_ready,15);sid,caps=account_session(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'));assert int(caps['browserVersion'].split('.')[0])>=155 and caps['acceptInsecureCerts'] is False
   context(sid,'chrome');script(sid,"Components.classes['@mozilla.org/security/x509certdb;1'].getService(Components.interfaces.nsIX509CertDB).addCertFromBase64(arguments[0],'C,,');return true;",[base64.b64encode(provider.ca).decode()]);prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];receipt['sandbox']=prefs;context(sid,'content');assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid)
   wait(lambda:script(sid,"return document.getElementById('queue-status').textContent==='Running'"));state_matrix(sid,'home-idle',receipt)
   click(sid,'#pause-core');wait(lambda:script(sid,"return document.getElementById('queue-status').textContent==='Paused'"));state_matrix(sid,'home-paused',receipt);click(sid,'#pause-core');wait(lambda:script(sid,"return document.getElementById('queue-status').textContent==='Running'"))
   for width in [1280,560,390]:
    viewport(sid,width);click(sid,'nav a[href="#generators"]');wait(lambda:script(sid,"return !!document.getElementById('catalog-search')"));capture(sid,'generators-empty',receipt)
   settings(sid);wait(lambda:script(sid,"return !!document.getElementById('allow-userscripts')"));click(sid,'#allow-userscripts');permission_choice(sid,True);wait(lambda:script(sid,"return !document.getElementById('allow-userscripts')"))
   owner=add(sid,'Continuity owner');settle(sid,owner,'LOGIN_REQUIRED');login(sid,owner,'visual@fixture.test');click(sid,'#account-confirm');settle(sid,owner,'READY')
   matrix(sid,receipt,click,set_input,owner);receipt['result']='CAPTURED — VISION REVIEW REQUIRED'
  except Exception as error:
   receipt['error']=str(error)
   if sid:
    try:receipt['page']=script(sid,'return document.body.innerText')
    except Exception:pass
   raise
  finally:
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();provider.close();(OUT/'installed-visual.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
