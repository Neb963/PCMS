"""P28 B: actual protected origin/cookies -> packaged Backup coverage.
Independent Firefox storage state; no external provider or native service.
"""
from installed_accounts import account_session,add,settle,login,account,page as account_page
from installed_lifecycle import permission_choice
from installed_journal import set_input
from installed_packages import *
from account_fixture import Fixture

def backup_page(sid):
 dashboard(sid);click(sid,'nav a[href="#settings"]');wait(lambda:script(sid,"return !!document.querySelector('a[href=\"#settings/backup\"]')"));click(sid,'a[href="#settings/backup"]');wait(lambda:script(sid,"return !!document.getElementById('backup-check')"))
def coverage(sid):
 return asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),{createBackup}=await import(browser.runtime.getURL('modules/backup.mjs'));const c=await openCore(),r=await createBackup({core:c,donor:{}}).status();c.close();return r;")
def collect(sid):
 before=(coverage(sid).get('coverage') or {}).get('jobId');click(sid,'#backup-check')
 return wait(lambda:next((c for c in [coverage(sid).get('coverage')] if c and c['jobId']!=before and c['state'] in ['COMPLETE','INCOMPLETE']),None),65)
def manage(sid,id,kind):
 settings(sid);selector='#records section[data-module="'+id+'"] button[data-lifecycle="'+kind+'"]';wait(lambda:script(sid,'return !!document.querySelector(arguments[0])',[selector]));click(sid,selector)
 wait(lambda:asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),m=await c.read('modules',arguments[0]);c.close();return !m.lifecycle&&m.enabled===arguments[1];",[id,kind=='ENABLE']))
def configure_auth(sid,id,token,unknown=False,rotate=False):
 return asyncjs(sid,"""const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),a=await c.read('accounts',arguments[0]);c.close();await browser.scripting.executeScript({target:{tabId:a.tabId,frameIds:[0]},world:'ISOLATED',func:(token,unknown,rotate)=>{clearInterval(globalThis.__FIXTURE_ROTATION);const data=JSON.parse(localStorage.getItem('app-storage'));data.user.sessionToken=token;if(unknown)data.user.refreshToken='unsupported-secret';else delete data.user.refreshToken;data.AI={workspace:'excluded-AI-sentinel'};localStorage.setItem('app-storage',JSON.stringify(data));localStorage.setItem('sessionTokenLastChangeTime','0000123.50');sessionStorage.setItem('unrelated-ai-store','untouched-session-sentinel');if(rotate)globalThis.__FIXTURE_ROTATION=setInterval(()=>localStorage.setItem('sessionTokenLastChangeTime',String(Math.random())),1);},args:[arguments[1],arguments[2],arguments[3]]});return true;""",[id,token,unknown,rotate])
def private_capsules(sid):
 # The privileged harness independently reopens stored private bytes; values
 # stay in memory and are never copied into receipts/screenshots/logs.
 return asyncjs(sid,"""const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),m=await c.read('modules','pcms-backup'),j=await c.read('jobs',m.backup.lastCoverageJobId),out=[];for(const r of j.capture.results)if(r.blobId)out.push({accountId:r.accountId,blobId:r.blobId,data:JSON.parse(new TextDecoder().decode(await c.bytes(r.blobId)))});c.close();return out;""")
def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve();identity=json.loads((xpi.parent/'identity.json').read_text());assert not identity['dirty'];assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
 receipt={'tier':'B/installed-scoped-auth-and-actual-Firefox-cookies','source':identity['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]};assert receipt['xpiSha256']==identity['xpiSha256']
 with tempfile.TemporaryDirectory(prefix='pcms-backup-sessions-') as tmp:
  root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();home=root/'home';home.mkdir();fixture=Fixture(root);fixture.start_catalog();fixture.install_bridge(home,root)
  env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'};log=open(OUT/'driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None
  try:
   wait(driver_ready,15);sid,caps=account_session(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'));assert int(caps['browserVersion'].split('.')[0])>=155 and caps['acceptInsecureCerts'] is False;context(sid,'chrome')
   script(sid,"Components.classes['@mozilla.org/security/x509certdb;1'].getService(Components.interfaces.nsIX509CertDB).addCertFromBase64(arguments[0],'C,,');return true;",[base64.b64encode(fixture.ca).decode()]);prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];receipt['sandbox']=prefs;context(sid,'content')
   assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid);settings(sid);wait(lambda:script(sid,"return !!document.getElementById('allow-userscripts')"));click(sid,'#allow-userscripts');permission_choice(sid,True);wait(lambda:script(sid,"return !document.getElementById('allow-userscripts')"))
   ids=[]
   for label,email in [('First capture account','first@fixture.test'),('Second capture account','second@fixture.test')]:
    id=add(sid,label);settle(sid,id,'LOGIN_REQUIRED');login(sid,id,email);click(sid,'#account-confirm');settle(sid,id,'READY');ids.append(id)
   one,two=ids;token='disposable-exact-'+chr(0)+'雪😀\r\n'
   with fixture.lock:fixture.logins[account(sid,one)['routeId']]['sessionToken']=token
   configure_auth(sid,one,token)
   setup=asyncjs(sid,"""const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),a=await c.read('accounts',arguments[0]),b=await c.read('accounts',arguments[1]);c.close();const expires=Math.floor(Date.now()/1000)+7200,base={url:'https://perchance.org/',name:'managed-secret',value:'cookie-one-opaque',path:'/',secure:true,httpOnly:true,sameSite:'strict'};await browser.cookies.set({...base,storeId:a.containerId});await browser.cookies.set({...base,name:'persistent',domain:'.perchance.org',path:'/guard',expirationDate:expires,sameSite:'lax',storeId:a.containerId});await browser.cookies.set({...base,value:'fpi-opaque',firstPartyDomain:'example.org',storeId:a.containerId});await browser.cookies.set({...base,value:'partition-opaque',partitionKey:{topLevelSite:'https://example.net',hasCrossSiteAncestor:true},storeId:a.containerId});await browser.cookies.set({...base,value:'cookie-two-opaque',storeId:b.containerId});await browser.cookies.set({...base,name:'unrelated-cookie',value:'excluded-default-sentinel',storeId:'firefox-default'});const t=await browser.tabs.create({cookieStoreId:a.containerId,url:'https://perchance.org/human-review#edit',active:false});return {expires,human:t.id,one:a.containerId,two:b.containerId};""",ids)
   wait(lambda:asyncjs(sid,"return (await browser.tabs.get(arguments[0])).status==='complete';",[setup['human']]))
   asyncjs(sid,"await browser.scripting.executeScript({target:{tabId:arguments[0]},world:'ISOLATED',func:()=>{const t=document.createElement('textarea');t.id='human-draft';t.value='Human unsaved source stays exact 雪';document.body.append(t);}});return true;",[setup['human']])
   manage(sid,'pcms-journal','DISABLE');click(sid,'#pause-core');wait(lambda:inspect_paused(sid));backup_page(sid);first=collect(sid);assert first['complete'] and len(first['rows'])==2;capsules=private_capsules(sid);a=next(x['data'] for x in capsules if x['accountId']==one);b=next(x['data'] for x in capsules if x['accountId']==two);assert a['auth']['user']['sessionToken']==token and a['auth']['sessionTokenLastChangeTime']=='0000123.50';assert 'AI' not in a['auth'] and 'excluded-AI-sentinel' not in json.dumps(capsules);assert len(a['cookies'])==4 and len(b['cookies'])==1
   cookies=a['cookies'];assert any(c['firstPartyDomain']=='example.org' and c['value']=='fpi-opaque' for c in cookies);assert any(c['partitionKey']=={'topLevelSite':'https://example.net','hasCrossSiteAncestor':True} and c['value']=='partition-opaque' for c in cookies);assert any(c['name']=='persistent' and c['expirationDate']==setup['expires'] and not c['session'] and not c['hostOnly'] and c['path']=='/guard' and c['sameSite']=='lax' for c in cookies);assert any(c['value']=='cookie-one-opaque' and c['hostOnly'] and c['session'] and c['expirationDate'] is None and c['httpOnly'] and c['secure'] for c in cookies);assert b['cookies'][0]['value']=='cookie-two-opaque'
   assert asyncjs(sid,"const tab=await browser.tabs.get(arguments[0]),r=await browser.scripting.executeScript({target:{tabId:tab.id},world:'ISOLATED',func:()=>document.getElementById('human-draft').value});return tab.url==='https://perchance.org/human-review#edit'&&r[0].result==='Human unsaved source stays exact 雪';",[setup['human']])
   public=json.dumps(coverage(sid))+script(sid,"return document.getElementById('records').textContent");assert all(s not in public for s in ['cookie-one-opaque','disposable-exact-','sessionToken','excluded-default-sentinel','unsupported-secret']);assert asyncjs(sid,"return (await browser.cookies.getAll({storeId:'firefox-default'})).some(c=>c.value==='excluded-default-sentinel');");assert inspect_paused(sid)
   receipt['checks'].append('real-Backup-control/finite-sandbox-queue/two-protected-origins/exact-NUL-Unicode-auth/actual-partition-FPI-session-expiry-cookie-bytes/Journal-disabled/global-Pause/human-editor-and-unrelated-container-preserved/secret-safe-UI')
   set_input(sid,'#backup-search','Second capture');wait(lambda:script(sid,"return document.querySelectorAll('#backup-accounts li').length===1&&document.getElementById('backup-accounts').textContent.includes('Second capture')"));call('POST',f'/session/{sid}/window/rect',{'width':420,'height':900});(OUT/'backup-coverage.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')));click(sid,'nav a[href="#home"]');backup_page(sid);assert script(sid,"return document.getElementById('backup-search').value")=='Second capture';set_input(sid,'#backup-search','')
   configure_auth(sid,one,token,unknown=True);bad=collect(sid);assert not bad['complete'] and next(r for r in bad['rows'] if r['accountId']==one)['code']=='AUTH_SCHEMA_UNVERIFIED';assert coverage(sid)['lastGood']['stale'];configure_auth(sid,one,token,rotate=True);rotated=collect(sid);assert not rotated['complete'] and next(r for r in rotated['rows'] if r['accountId']==one)['code']=='AUTH_SESSION_CHANGED';configure_auth(sid,one,token);final=collect(sid);assert final['complete'];saved={x['accountId']:x['blobId'] for x in private_capsules(sid)}
   receipt['checks'].append('actual-unknown-auth-schema/incomplete-not-absent/bounded-changing-session-retries/previous-complete-stale/repair-recollect/search-navigation/narrow-view')
   manage(sid,'pcms-backup','DISABLE');backup_page(sid);assert script(sid,"return document.getElementById('backup-check').disabled");assert coverage(sid)['coverage']['jobId']==final['jobId'];manage(sid,'pcms-backup','ENABLE');backup_page(sid);assert coverage(sid)['coverage']['jobId']==final['jobId']
   prior=stop(sid,profile);sid=None;sid,_=account_session(binary,profile);assert not prior.intersection(pids(profile));toolbar(sid);dashboard(sid);backup_page(sid);assert inspect_paused(sid);assert coverage(sid)['coverage']['jobId']==final['jobId'];assert saved=={x['accountId']:x['blobId'] for x in private_capsules(sid)};assert fixture.receipt()['unexpected']==[]
   receipt['checks'].append('real-Disable-no-new-collection/Enable-no-automatic-capture/actual-process-restart/persisted-Pause/private-capsule-closure/no-automatic-refetch/no-archive-export-or-live-login-claim');receipt['result']='PASS'
  except Exception as error:
   receipt['error']=str(error)
   if sid:
    try:receipt['coverage']=coverage(sid)
    except Exception:pass
    try:(OUT/'backup-failure.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')))
    except Exception:pass
   raise
  finally:
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();fixture.close();(OUT/'installed-backup-sessions.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)
def inspect_paused(sid):
 return asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),s=await c.queue.status();c.close();return s.paused;")
if __name__=='__main__':main()
