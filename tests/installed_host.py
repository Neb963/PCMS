"""P01 B: actual toolbar, persistent XPI, process restart, clean/no-host profile.
No provider targets, native helpers, production data or sandbox overrides.
"""
import base64, hashlib, json, os, pathlib, subprocess, sys, tempfile, time
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ID='persona-route-manager@local'
BASE='http://127.0.0.1:44448'
OUT=pathlib.Path('test-results'); OUT.mkdir(exist_ok=True)

def call(method, route, data=None):
    req=Request(BASE+route,data=None if data is None else json.dumps(data).encode(),method=method,headers={'Content-Type':'application/json'})
    try:
        with urlopen(req,timeout=60) as response: value=json.load(response).get('value')
    except HTTPError as error:
        raise RuntimeError(error.read().decode()[:2500]) from error
    if isinstance(value,dict) and value.get('error'): raise RuntimeError(value)
    return value

def script(session, source, args=None, asynchronous=False):
    return call('POST',f'/session/{session}/execute/'+('async' if asynchronous else 'sync'),{'script':source,'args':args or []})

def context(session, name): call('POST',f'/session/{session}/moz/context',{'context':name})

def wait(fn, timeout=20):
    end=time.monotonic()+timeout; last=None
    while time.monotonic()<end:
        last=fn()
        if last: return last
        time.sleep(.15)
    raise AssertionError(('CONDITION_TIMEOUT',last))

def session(binary, profile):
    result=call('POST','/session',{'capabilities':{'alwaysMatch':{'browserName':'firefox','moz:firefoxOptions':{
        'binary':str(binary),'args':['-headless','-no-remote','-profile',str(profile)],
        'prefs':{'xpinstall.signatures.required':False,'extensions.autoDisableScopes':0}}}}})
    return result['sessionId'],result['capabilities']

def pids(profile):
    found=set()
    for p in pathlib.Path('/proc').iterdir():
        if not p.name.isdigit(): continue
        try:
            command=(p/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace')
            if str(profile) in command and 'firefox' in command: found.add(int(p.name))
        except OSError: pass
    return found

def stop(sid, profile):
    before=pids(profile); assert before, 'FIREFOX_PROCESS_NOT_OBSERVED'
    call('DELETE','/session/'+sid)
    wait(lambda:not pids(profile),10)
    return before

def toolbar(session):
    context(session,'chrome')
    widget=script(session,"""
      const {CustomizableUI}=ChromeUtils.importESModule('moz-src:///browser/components/customizableui/CustomizableUI.sys.mjs');
      const id='persona-route-manager_local-browser-action';
      CustomizableUI.addWidgetToArea(id,CustomizableUI.AREA_NAVBAR);
      const node=document.getElementById(id);
      if(!node)throw Error('REAL_TOOLBAR_ACTION_NOT_FOUND');
      return id;
    """)
    element=call('POST',f'/session/{session}/element',{'using':'css selector','value':'#'+widget})
    call('POST',f'/session/{session}/element/'+element['element-6066-11e4-a52e-4f735466cecf']+'/click',{})
    context(session,'content')

def dashboard(session):
    def locate():
        hits=[]
        for handle in call('GET',f'/session/{session}/window/handles'):
            call('POST',f'/session/{session}/window',{'handle':handle})
            url=call('GET',f'/session/{session}/url')
            if url.startswith('moz-extension://') and '/ui/index.html' in url: hits.append(handle)
        if len(hits)>1: raise AssertionError(('DUPLICATE_DASHBOARD',hits))
        if hits: call('POST',f'/session/{session}/window',{'handle':hits[0]});return hits[0]
    return wait(locate)

def status(session, expected):
    return wait(lambda:script(session,"return document.body.dataset.startup") == expected,25)

def main():
    binary=pathlib.Path(os.environ['FIREFOX_BINARY']); driver=pathlib.Path(os.environ['GECKODRIVER_BINARY'])
    xpi=pathlib.Path(sys.argv[1]).resolve()
    assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k), 'SANDBOX_ENV_OVERRIDE'
    receipt={'tier':'B','xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]}
    assert receipt['xpiSha256']==json.loads((xpi.parent/'identity.json').read_text())['xpiSha256']
    with tempfile.TemporaryDirectory(prefix='pcms-p01-') as tmp:
        root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();clean_home=root/'home';clean_home.mkdir()
        env={**os.environ,'HOME':str(clean_home),'XDG_CONFIG_HOME':str(clean_home/'.config'),'XDG_DATA_HOME':str(clean_home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'}
        daemon_log=open(OUT/'driver.log','w')
        proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=daemon_log,stderr=subprocess.STDOUT)
        sid=None
        try:
            wait(lambda:driver_ready(),15)
            sid,caps=session(binary,profile)
            receipt['browserVersion']=caps['browserVersion'];receipt['buildId']=caps.get('moz:buildID')
            # Browser compares the XPI's minimum at real persistent installation.
            assert int(caps['browserVersion'].split('.')[0])>=155, caps['browserVersion']
            addon=call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})
            assert addon==ID,addon
            context(sid,'chrome')
            installed=script(sid,"""const done=arguments[arguments.length-1];
              const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
              AddonManager.getAddonByID(arguments[0]).then(a=>done({id:a.id,active:a.isActive,temporary:a.temporarilyInstalled}));""",[ID],True)
            assert installed=={'id':ID,'active':True,'temporary':False},installed
            prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart};")
            assert prefs['sandbox']>=4 and prefs['remote'],prefs
            receipt['sandbox']=prefs
            context(sid,'content')
            toolbar(sid);first=dashboard(sid);status(sid,'BRIDGE_MISSING')
            toolbar(sid);second=dashboard(sid);assert first==second
            receipt['checks'].append('persistent-install/real-toolbar-twice/single-dashboard/bridge-missing')
            nav=script(sid,"return [...document.querySelectorAll('nav a')].map(a=>a.textContent)")
            assert nav==['Home','Generators','Accounts','Refresher','Work','Other','Settings'],nav
            # Click a real packaged nav link through WebDriver, then read the
            # resulting route and current link (the intended P01 shell effect).
            element=call('POST',f'/session/{sid}/element',{'using':'css selector','value':'nav a[href="#settings"]'})
            call('POST',f'/session/{sid}/element/'+element['element-6066-11e4-a52e-4f735466cecf']+'/click',{})
            wait(lambda:script(sid,"return document.querySelector('h1').textContent")=='Settings')
            assert script(sid,"return document.querySelector('nav [aria-current]').hash")=='#settings'
            receipt['checks'].append('ordered-navigation/actual-settings-click/no-fake-operations')
            (OUT/'dashboard.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')))
            prior=stop(sid,profile);sid=None
            sid,caps2=session(binary,profile);assert not prior.intersection(pids(profile))
            toolbar(sid);dashboard(sid);status(sid,'BRIDGE_MISSING')
            receipt['checks'].append('new-process/persistent-addon/cold-blocked-start')
            # Simulate existing Alpha data in this disposable profile; preserve
            # exact sentinel bytes and prove the host refuses implicit adoption.
            script(sid,"""const done=arguments[arguments.length-1];
              browser.storage.local.set({state:{fixture:'preserve-existing-donor-data'}})
              .then(()=>browser.storage.local.remove('pcmsHostProfile')).then(()=>done(true));""",asynchronous=True)
            stop(sid,profile);sid=None
            sid,_=session(binary,profile);toolbar(sid);dashboard(sid);status(sid,'CLEAN_PROFILE_REQUIRED')
            stored=script(sid,"const done=arguments[arguments.length-1];browser.storage.local.get('state').then(done);",asynchronous=True)
            assert stored=={'state':{'fixture':'preserve-existing-donor-data'}},stored
            receipt['checks'].append('existing-donor-data-refused-and-preserved')
            receipt['result']='PASS'
        except Exception:
            if sid:
                try:
                    context(sid,'chrome')
                    diagnostic=script(sid,"""const {ExtensionParent}=ChromeUtils.importESModule('resource://gre/modules/ExtensionParent.sys.mjs');
                      const ext=ExtensionParent.GlobalManager.getExtension(arguments[0]);
                      return {backgroundState:ext?.backgroundState,errors:ext?.errors,
                        background:ext?.manifest?.background,
                        console:Services.console.getMessageArray().map(m=>m.message).filter(m=>/moz-extension|PCMS|PersonaMonkey|SyntaxError|background|module/i.test(m)).slice(-25),
                        tabs:[...gBrowser.tabs].map(t=>t.linkedBrowser.currentURI.spec)};""",[ID])
                    (OUT/'failure.json').write_text(json.dumps(diagnostic,indent=2)+'\n')
                    print('P01_FAILURE_DIAGNOSTIC '+json.dumps(diagnostic),flush=True)
                except Exception as error: print('DIAGNOSTIC_UNAVAILABLE '+str(error),flush=True)
            raise
        finally:
            if sid:
                try:stop(sid,profile)
                except Exception:pass
            proc.terminate();proc.wait(timeout=10);daemon_log.close()
            (OUT/'installed.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps(receipt),flush=True)

def driver_ready():
    try:return call('GET','/status').get('ready')
    except Exception:return False

if __name__=='__main__': main()
