"""P06 B: seven actual seeded ZIP packages, registry/data preservation across
real Firefox process restart and in-place versioned extension update.
No provider or donor-route effects are invoked.
"""
from installed_packages import *

BUILTINS=['pcms-accounts','pcms-discover','pcms-creator','pcms-deployer','pcms-refresher','pcms-journal','pcms-backup']

def expected_packages(xpi):
 with zipfile.ZipFile(xpi) as src:
  index=json.loads(src.read('bundled/registry.json'))
  assert [p['id'] for p in index['packages']]==BUILTINS
  expected={}
  for p in index['packages']:
   zipped=src.read('bundled/'+p['id']+'.zip')
   with zipfile.ZipFile(io.BytesIO(zipped)) as package:
    manifest=package.read('module.json');m=json.loads(manifest)
    assert m['id']==p['id'] and m['version']=='0.1.0' and not m['pages']
    assert m['capabilities']==[]
    for file in m['files']:assert hashlib.sha256(package.read(file['path'])).hexdigest()==file['sha256']
    expected[p['id']]={'zip':hashlib.sha256(zipped).hexdigest(),'manifest':hashlib.sha256(manifest).hexdigest()}
    assert expected[p['id']]['zip']==p['packageHash'] and expected[p['id']]['manifest']==p['manifestHash']
  return expected

def build_update(original,dest):
 with zipfile.ZipFile(original) as src,zipfile.ZipFile(dest,'w') as out:
  for item in src.infolist():
   data=src.read(item.filename)
   if item.filename=='manifest.json':
    m=json.loads(data);assert m['version']=='0.6.0';m['version']='0.6.1';data=json.dumps(m).encode()
   out.writestr(item,data)
 return dest

def inspect(sid):
 return asyncjs(sid,"""
  const {openCore}=await import(browser.runtime.getURL('core/records.mjs'));
  const c=await openCore(),root=await c.status(),modules=[];let cursor=null;
  do{const page=await c.list({table:'modules',cursor});modules.push(...page.rows);cursor=page.cursor;}while(cursor);
  const rows={};for(const p of modules){const m=await c.read('modules',p.id);rows[p.id]={hash:m.packageHash,manifest:m.manifestHash,enabled:m.enabled,
   version:m.version,settings:m.settings,staged:m.staged?.manifest?.version??null,rev:m.rev,pages:m.manifest?.pages??[],
   packageClass:m.packageClass??null};}
  const job=await c.read('jobs','seed-fixture-job'),draft=await c.view('module:seed-fixture:main');
  const status=await c.moduleSeedStatus();c.close();
  return {marker:root.moduleSeed,seed:status,rows,job:job?.state??null,draft};
 """)

def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve()
 assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
 identity=json.loads((xpi.parent/'identity.json').read_text());expected=expected_packages(xpi)
 receipt={'tier':'B','source':identity['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]}
 assert receipt['xpiSha256']==identity['xpiSha256']
 with tempfile.TemporaryDirectory(prefix='pcms-seed-') as tmp:
  root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();home=root/'home';home.mkdir()
  update=build_update(xpi,root/'update-v0.6.1.xpi')
  custom=write_package(root/'selected-user.zip')
  env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'}
  log=open(OUT/'driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None
  try:
   wait(driver_ready,15);sid,caps=session(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'))
   assert int(caps['browserVersion'].split('.')[0])>=155
   assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID
   toolbar(sid);dashboard(sid);status(sid,'BRIDGE_MISSING')
   context(sid,'chrome');prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];receipt['sandbox']=prefs;context(sid,'content')
   settings(sid);wait(lambda:'pcms-backup' in json.dumps(inspect(sid).get('rows',{})))
   for module in BUILTINS:
    assert module.split('pcms-')[1].capitalize() in script(sid,"return document.getElementById('records').textContent"),module
   assert script(sid,"return document.querySelectorAll('#records .module-pin').length")==0
   click(sid,'nav a[href="#other"]');wait(lambda:'No matching modules' in script(sid,"return document.getElementById('records').textContent"))
   first=inspect(sid);assert first['marker']=={'schema':1,'state':'SEEDED','count':7},first
   assert first['seed']=={'initialized':True,'moduleCount':7},first
   assert list(sorted(first['rows']))==sorted(BUILTINS),first
   for module in BUILTINS:
    row=first['rows'][module];assert row['enabled'] and row['version']=='0.1.0' and row['pages']==[]
    assert row['hash']==expected[module]['zip'] and row['manifest']==expected[module]['manifest']
   receipt['checks'].append('persistent-install/seven-enabled-valid-ZIP-hashes/independent-IDB/real-Modules-list/no-fake-Other-pages')
   # Use the existing operating Install UI for an ordinary selected user ZIP.
   settings(sid);select(sid,custom);click(sid,'#install-module');wait(lambda:'Installed.' in script(sid,"return document.getElementById('import-result').textContent"))
   # Mimic persisted user-selected choices that P07 will later expose through
   # Disable/Update controls. The fixture is intentionally NOT evidence of P07.
   revised=asyncjs(sid,"""
    const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore();
    const m=await c.read('modules','pcms-refresher');await c.mutate([{table:'modules',id:m.id,
     value:{...m,enabled:false,settings:{activeHours:17,operatorChoice:'retain'}},expectedRev:m.rev,refs:m.refs}],
     {step:'FIXTURE_SETUP',result:'COMPLETE'});
    await c.mutate([{table:'jobs',id:'seed-fixture-job',value:{jobId:'seed-fixture-job',kind:'CHECK',
      moduleId:'fixture-module',state:'HELD',jobSchema:1}}],{step:'FIXTURE_SETUP',result:'COMPLETE'});
    await c.saveView('module:seed-fixture:main',{draft:'keep exact user draft'},'seed-fixture-draft');c.close();return true;
   """);assert revised is True,revised
   before=inspect(sid);assert before['seed']=={'initialized':True,'moduleCount':8};assert before['job']=='HELD'
   receipt['checks'].append('user-selected-local-ZIP/disabled-and-settings-fixture/unfinished-job/draft-retained')
   # A truly new Firefox process with the persistently installed original XPI.
   prior=stop(sid,profile);sid=None;sid,_=session(binary,profile);assert not prior.intersection(pids(profile))
   toolbar(sid);dashboard(sid);status(sid,'BRIDGE_MISSING');cold=inspect(sid);assert cold==before,(before,cold)
   settings(sid);assert '17' not in script(sid,"return document.getElementById('records').textContent") # settings not surfaced until P07
   receipt['checks'].append('full-Firefox-process-restart/no-reseed/exact-disabled-version-settings-jobs-draft')
   # Real in-place add-on update: version changes, package modules do not.
   assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(update),'temporary':False})==ID
   context(sid,'chrome');installed=script(sid,"""
    const done=arguments[arguments.length-1];const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
    AddonManager.getAddonByID(arguments[0]).then(a=>done({version:a.version,active:a.isActive,temporary:a.temporarilyInstalled}));
   """,[ID],True);assert installed=={'version':'0.6.1','active':True,'temporary':False},installed;context(sid,'content')
   toolbar(sid);dashboard(sid);wait(lambda:inspect(sid)==before,30)
   settings(sid);assert all(module.split('pcms-')[1].capitalize() in script(sid,"return document.getElementById('records').textContent") for module in BUILTINS)
   receipt['checks'].append('real-in-place-extension-update-version-0.6.1/no-reseed-preserves-user-registry')
   (OUT/'seed.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')));receipt['result']='PASS'
  except Exception as error:
   receipt['error']=str(error)
   if sid:
    try:(OUT/'seed-failure.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')))
    except Exception:pass
   raise
  finally:
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();(OUT/'installed-seed.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
