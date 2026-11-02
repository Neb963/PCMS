"""P37 B: real Refresher controls -> shared source writer -> independent native/server.
No live provider operations; only disposable protected native/HTTPS fixtures.
"""
from installed_directory import Provider,FRAME,state,page,visibility,measured,check,native_filter
from installed_refresh_clock import settings_clock,pause
from installed_source_save import configure,editor,dashboard,stored,SLUG,hard_stop
from installed_source import completed_source
from installed_accounts import add,settle,login,account,account_session
from installed_lifecycle import permission_choice
from installed_journal import set_input,close_dashboard
from installed_packages import *
from account_fixture import Fixture
import account_fixture
account_fixture.Provider=Provider
def refresh_cut(sid):
 return asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),g=await c.read('generators',arguments[0]),j=g.sourceSaveJobId?await c.read('jobs',g.sourceSaveJobId):null;c.close();return {g,j};",[SLUG])
def refresh(sid):
 page(sid);selector='button[data-refresh="'+SLUG+'"]';wait(lambda:script(sid,"return !!document.querySelector(arguments[0])&&!document.querySelector(arguments[0]).disabled",[selector]),70);click(sid,selector)
def verified(sid,counter):
 def get():
  cut=refresh_cut(sid)
  if cut['g'].get('refreshMarker',{}).get('counter')==counter and cut['g'].get('refreshLast',{}).get('state')=='VERIFIED':return cut
  return None
 return wait(get,100)
def assert_bytes(provider,initial,marker,counter):
 files=stored(provider);pjs='// pcms-refresh:'+marker+':'+str(counter)+'\r\n';html='<!-- pcms-refresh:'+marker+':'+str(counter)+' -->';assert files['main.pjs'].count(pjs.encode())==1 and files['index.html'].count(html.encode())==1
 assert files['main.pjs'].replace(pjs.encode(),b'')==initial['main.pjs'] and files['index.html'].replace(html.encode(),b'')==initial['index.html']
 for path,expected in initial.items():
  if path.startswith('src/'):assert files[path]==expected,(path,files[path],expected)
 assert provider.generator['isPrivate'] is False
 return files
def reopen_account(sid,owner):
 script(sid,"location.hash='#accounts/'+arguments[0]",[owner]);wait(lambda:script(sid,"return !!document.getElementById('account-open')&&!document.getElementById('account-open').disabled"));old=account(sid,owner)['flow']['jobId'];click(sid,'#account-open');dashboard(sid);wait(lambda:account(sid,owner)['flow']['jobId']!=old);settle(sid,owner,'READY');page(sid)

def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve();identity=json.loads((xpi.parent/'identity.json').read_text());assert not identity['dirty'];assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k);receipt={'tier':'B/P37/both-markers','source':identity['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]};assert receipt['xpiSha256']==identity['xpiSha256']
 with tempfile.TemporaryDirectory(prefix='pcms-p37-') as tmp:
  root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();home=root/'home';home.mkdir();provider=Fixture(root,extra_hosts=['user.uploads.dev',FRAME]);expected=configure(provider);expected['main.pjs']=b'output\r\n  Hello [animal]\r\nanimal\r\n  cat\r\n  dog';provider.generator['modelText']=expected['main.pjs'].decode();provider.directory_mode='complete';provider.directory_reads=[];provider.directory_advances=[];provider.generator['isPrivate']=False;original=json.loads(json.dumps(provider.generator));provider.start_catalog();provider.install_bridge(home,root);env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'};log=open(OUT/'driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None
  try:
   wait(driver_ready,15);sid,caps=account_session(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'));assert int(caps['browserVersion'].split('.')[0])>=155 and caps['acceptInsecureCerts'] is False;context(sid,'chrome');script(sid,"Components.classes['@mozilla.org/security/x509certdb;1'].getService(Components.interfaces.nsIX509CertDB).addCertFromBase64(arguments[0],'C,,');return true;",[base64.b64encode(provider.ca).decode()]);prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];receipt['sandbox']=prefs;context(sid,'content');assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid);settings(sid);wait(lambda:script(sid,"return !!document.getElementById('allow-userscripts')"));click(sid,'#allow-userscripts');permission_choice(sid,True);wait(lambda:script(sid,"return !document.getElementById('allow-userscripts')"));initial=state(sid);assert initial['settings']['activeHours']==24 and initial['settings']['sleepHours']==72
   owner=add(sid,'Clock owner');settle(sid,owner,'LOGIN_REQUIRED');login(sid,owner,'source@fixture.test');click(sid,'#account-confirm');settle(sid,owner,'READY');settings_clock(sid,1,1);asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),a=await c.read('accounts',arguments[0]);await c.mutate([{table:'generators',id:'existing-sentinel',value:{slug:'existing-sentinel',remoteId:'public_source-stable-18',accountId:a.id,ownerPrincipal:a.expectedPrincipal,creatorState:'OWNED',listing:'PUBLIC',state:'OWNED'}}],{step:'FIXTURE_PREVIOUS_OWNED',result:'COMPLETE'});c.close();location.hash='#generators/existing-sentinel';return true;",[owner]);wait(lambda:script(sid,"return !!document.getElementById('source-open')&&!document.getElementById('source-open').disabled"));click(sid,'#source-open');editor_handle=editor(sid);dashboard(sid);script(sid,"location.hash='#generators/existing-sentinel'");wait(lambda:script(sid,"return !!document.getElementById('source-inspect')&&!document.getElementById('source-inspect').disabled"));click(sid,'#source-inspect');source=wait(lambda:completed_source(sid),90);assert source['generator']['sourceState']=='VERIFIED' and source['generator']['listing']=='PUBLIC';assert {p:base64.b64decode(v) for p,v in source['bytes'].items()}==expected
   asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),g=await c.read('generators','existing-sentinel');await c.mutate([{table:'generators',id:g.id,expectedRev:g.rev,refs:g.refs,value:{...g,poolMember:true,pool:{schema:1,member:true,sourceManifest:g.sourceManifest,addedAt:Date.now()},refreshCycle:{schema:1,cycleId:crypto.randomUUID(),phase:'PENDING',activeUsedMs:0}}}],{step:'FIXTURE_QUALIFIED_P22_POOL',result:'COMPLETE'});c.close();return true;");page(sid)
   check(sid);wait(lambda:measured(sid),100);pause(sid,'Pause Refresher');pause(sid,'Resume Refresher');baseline=source['generator']['sourceManifest'];refresh(sid);one=verified(sid,1);marker=one['g']['refreshMarker']['id'];assert one['g']['previousGood']==baseline and one['j']['kind']=='REFRESH' and one['j']['effect']['disposition']=='APPLIED';assert_bytes(provider,expected,marker,1);assert len(provider.save_requests)==1 and provider.save_requests[0]['valid'] and not provider.save_requests[0]['forced']
   refresh(sid);two=verified(sid,2);assert two['g']['previousGood']==one['g']['sourceManifest'];assert_bytes(provider,expected,marker,2);assert len(provider.save_requests)==2
   wait(lambda:'Source save verified:' in script(sid,"return document.getElementById('refresher-list').textContent"));receipt['checks'].append('actual-Refresher-Refresh-control/shared-native-guarded-save/both-markers-counter1-then2/no-duplicates/full-independent-root-and-binary-bytes/public-state/previous-good/receipt-separate-from-position')
   call('POST',f'/session/{sid}/window',{'handle':editor_handle});set_input(sid,'#fixture-source-model','Human unsaved text must stay');dashboard(sid);page(sid)
   # The real backend immediately rechecks dirty state even before its next heartbeat.
   script(sid,"document.querySelector('button[data-refresh=\"'+arguments[0]+'\"]').click();return true;",[SLUG]);wait(lambda:'EDITOR_DIRTY' in script(sid,"return document.getElementById('refresher-result').textContent") or state(sid)['rows'][0]['holdCode']=='EDITOR_DIRTY',45);assert len(provider.save_requests)==2;call('POST',f'/session/{sid}/window',{'handle':editor_handle});assert script(sid,"return document.getElementById('fixture-source-model').value")=='Human unsaved text must stay';script(sid,"modelTextEditor.getDoc().text=app.data.generator.modelText;modelTextEditor.getDoc().clean=true;menuBar.saveState='saved';document.getElementById('fixture-source-model').value=app.data.generator.modelText;return true;");dashboard(sid);page(sid);pause(sid,'Pause Refresher');pause(sid,'Resume Refresher')
   receipt['checks'].append('actual-dirty-human-editor/zero-stage-or-save/preserved-human-text/normal-undo-and-Pause-Resume-recheck')
   # Lose the third save acknowledgement after independent server application.
   provider.delay_after_apply=True;provider.delay_save_number=3;refresh(sid);assert provider.applied.wait(30),'THIRD_SAVE_NOT_APPLIED';provider.readback_outage=True;possible=refresh_cut(sid);assert possible['j']['effect']['boundary']=='POSSIBLE';op=possible['j']['effect']['operationId'];assert_bytes(provider,expected,marker,3);close_dashboard(sid);old=hard_stop(sid,profile);sid=None;provider.release_ack.set();provider.delay_after_apply=False
   sid,_=account_session(binary,profile);assert not old.intersection(pids(profile));toolbar(sid);dashboard(sid);page(sid);cold=refresh_cut(sid);assert cold['j']['effect']['operationId']==op and cold['j']['effect']['boundary']=='POSSIBLE' and cold['g']['refreshMarker']['counter']==2;assert len(provider.save_requests)==3
   reopen_account(sid,owner);page(sid);wait(lambda:script(sid,"return !!document.querySelector('button[data-refresh=\"'+arguments[0]+'\"]').closest('li')",[SLUG]));selector='[data-refresher="'+SLUG+'"]';button=script(sid,"return [...document.querySelector(arguments[0]).querySelectorAll('button')].find(b=>b.textContent==='Check Refresh result')?.hidden===false",[selector]);assert button;check_button=call('POST',f'/session/{sid}/element',{'using':'xpath','value':'//li[@data-refresher="'+SLUG+'"]//button[text()="Check Refresh result"]'})['element-6066-11e4-a52e-4f735466cecf'];before_check=refresh_cut(sid)['j']['rev'];call('POST',f'/session/{sid}/element/{check_button}/click',{});wait(lambda:refresh_cut(sid)['j']['rev']>before_check,30);assert refresh_cut(sid)['j']['effect']['boundary']=='POSSIBLE';provider.readback_outage=False;page(sid);check_button=call('POST',f'/session/{sid}/element',{'using':'xpath','value':'//li[@data-refresher="'+SLUG+'"]//button[text()="Check Refresh result"]'})['element-6066-11e4-a52e-4f735466cecf'];call('POST',f'/session/{sid}/element/{check_button}/click',{});three=verified(sid,3);assert three['j']['effect']['operationId']==op and len(provider.save_requests)==3;assert_bytes(provider,expected,marker,3)
   receipt['checks'].append('server-applied-third-save/actual-process-crash/lost-ACK/readback-outage/original-POSSIBLE-and-counter2-retained/normal-route-reverify/real-Check-control/full-readback-resolves-same-operation/counter3/no-resend')
   # Open is a real scoped handler, needed after a browser that restores no live tabs.
   click(sid,'button[data-refresh-open="'+SLUG+'"]');editor_handle=editor(sid);dashboard(sid);page(sid);check(sid);wait(lambda:measured(sid),100);pause(sid,'Pause Refresher');pause(sid,'Resume Refresher');provider.race=True;refresh(sid);held=wait(lambda:refresh_cut(sid) if refresh_cut(sid)['g'].get('sourceSaveCode')=='SOURCE_STALE' else None,100);assert held['j']['effect']['disposition']=='REJECTED' and held['g']['refreshMarker']['counter']==3;assert len(provider.save_requests)==4;assert provider.generator['modelText']=='Independent external editor changed source\n';assert held['g']['previousGood'] is not None
   native_filter(sid,'all');wait(lambda:visibility(sid)['fresh'] and visibility(sid)['size']==127,100);assert provider.generator['modelText']=='Independent external editor changed source\n' and len(provider.save_requests)==4 and provider.unexpected==[]
   receipt['checks'].append('real-Open-protected-editor-after-cold-start/external-version-race/stale-rejection-no-repair/marker-counter-not-advanced/previous-good-and-user-base-preserved/independent-directory-work-continues-on-same-account')
   receipt['markerId']=marker;receipt['operationId']=op;receipt['saves']=provider.save_requests;receipt['final']=refresh_cut(sid);receipt['result']='PASS'
  except Exception as error:
   receipt['error']=str(error)
   if sid:
    try:toolbar(sid);dashboard(sid);page(sid);receipt['status']=state(sid);receipt['cut']=refresh_cut(sid);receipt['body']=script(sid,"return document.body.innerText")
    except Exception:pass
   print(json.dumps(receipt),flush=True);raise
  finally:
   provider.release_ack.set()
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();provider.close();(OUT/'installed-refresh-markers.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
