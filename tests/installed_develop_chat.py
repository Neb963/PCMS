"""P23 B: automatic DEVELOP -> exact native instruction save -> cold readback.
No live service, AI send or source/Git writeback. Full independent byte oracle.
"""
from installed_deployer import *
import installed_source_save as source_module
source_module.NATIVE+='\n'+(pathlib.Path(__file__).parent/'native_ai_fixture.js').read_text()
INSTRUCTIONS['prompt.md']='Exact prompt\n雪 🐈\nlast line'.encode()
class AiProvider(source_module.Provider):
 def do_POST(self):
  if self.path=='/fixture/ai':
   with self.server.fixture.lock:self.server.fixture.ai_records.append(self.body())
   return self.send({'ok':True})
  return super().do_POST()
account_fixture.Provider=AiProvider

def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve();identity=json.loads((xpi.parent/'identity.json').read_text());assert not identity['dirty'];assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
 receipt={'tier':'B/installed-P24/native-chat-exact-prompt/independent-send-counts','source':identity['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]};assert receipt['xpiSha256']==identity['xpiSha256']
 with tempfile.TemporaryDirectory(prefix='pcms-p23-') as tmp:
  root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();home=root/'home';home.mkdir();provider=Fixture(root,extra_hosts=['user.uploads.dev']);initial=configure(provider);provider.generator['isPrivate']=False;provider.ai_records=[];provider.delay_after_apply=False;provider.install_bridge(home,root);remote=GitWriteFixture(root);remote.controls(race=None,lose_applied_ref=False,hide_applied_commits=False);ready_head=ready(remote,action='DEVELOP');baseline=remote.snapshot();expected={**initial,**{'src/'+p:INSTRUCTIONS[p] for p in ['specification.md','ui.md','agents.md']}};(root/'fixture-socks-catalog.json').write_text(json.dumps([{'online':True,'hostname':'fixture-'+str(i),'ipv4_address':'10.124.0.'+str(i),'port':1080,'location':{'country':'Fixture','city':'Local'}} for i in range(1,9)]));remote.start();env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'};log=open(OUT/'driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None
  try:
   wait(driver_ready,15);sid,caps=session15(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'));assert int(caps['browserVersion'].split('.')[0])>=155 and caps['acceptInsecureCerts'] is False;context(sid,'chrome')
   for ca in [provider.ca,remote.ca]:script(sid,"Components.classes['@mozilla.org/security/x509certdb;1'].getService(Components.interfaces.nsIX509CertDB).addCertFromBase64(arguments[0],'C,,');return true;",[base64.b64encode(ca).decode()])
   prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];receipt['sandbox']=prefs;context(sid,'content');assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid);settings(sid);wait(lambda:script(sid,"return !!document.getElementById('allow-userscripts')"));click(sid,'#allow-userscripts');permission_choice(sid,True);wait(lambda:script(sid,"return !document.getElementById('allow-userscripts')"))
   owner=add(sid,'DEVELOP staging fixture owner');settle(sid,owner,'LOGIN_REQUIRED');login(sid,owner,'source@fixture.test');click(sid,'#account-confirm');settle(sid,owner,'READY');connections(sid);set_input(sid,'#git-repository','fixture/catalog');set_input(sid,'#git-token',TOKEN);click(sid,'#git-save');wait(lambda:'Connection saved' in script(sid,"return document.getElementById('git-result').textContent"));close_dashboard(sid);close_dashboard(sid)
   wait(lambda:len(provider.ai_records)==2,120);toolbar(sid);dashboard(sid)
   s=wait(lambda:(lambda s:s if s['j'] and s['j']['deployment']['phase']=='AI_RUNNING' and s['j']['state']=='HELD' else None)(deployment(sid)),90);j=s['j'];job_id=j['id'];operation=j['deployment']['ai']['sendOperationId'];assert j['deployment']['ai']['chatDigest'] and j['effect']['operationId']==operation and j['effect']['boundary']=='OBSERVED';assert provider.ai_records==[{'action':'NEW_CHAT'},{'action':'SEND','text':INSTRUCTIONS['prompt.md'].decode()}];assert len(provider.save_requests)==2 and stored(provider)==expected and provider.generator['isPrivate'];assert s['g']['writerHold']['jobId']==job_id and not j['deployment'].get('publicationReceipt');receipt['checks'].append('automatic-READY-DEVELOP/distinct-exact-staging/actual-native-new-chat-transition/exact-Unicode-newline-prompt/one-send/closed-dashboard/bound-reserved-editor')
   detail(sid,SLUG);wait(lambda:'Prompt sent once' in script(sid,"return document.getElementById('deployment-state').textContent"));click(sid,'#deployment-check');wait(lambda:'checked' in script(sid,"return document.getElementById('deployment-detail').textContent"));assert len(provider.ai_records)==2
   close_dashboard(sid);old=hard_stop(sid,profile);sid=None;sid,_=session15(binary,profile);assert not old.intersection(pids(profile));toolbar(sid);dashboard(sid)
   s=wait(lambda:(lambda s:s if s['j'] and s['j']['recovery'] and s['j']['recovery']['code']=='AI_INSPECTION_REQUIRED' else None)(deployment(sid)),120);assert s['j']['id']==job_id and s['j']['deployment']['ai']['sendOperationId']==operation;assert provider.ai_records==[{'action':'NEW_CHAT'},{'action':'SEND','text':INSTRUCTIONS['prompt.md'].decode()}];assert len(provider.save_requests)==2 and stored(provider)==expected
   detail(sid,SLUG);wait(lambda:'Inspect the original chat' in script(sid,"return document.getElementById('deployment-state').textContent"));click(sid,'#deployment-check');wait(lambda:'AI_INSPECTION_REQUIRED' in script(sid,"return document.getElementById('deployment-detail').textContent"));assert len(provider.ai_records)==2;assert remote.snapshot()['head']==baseline['head'] and remote.snapshot()['files']==baseline['files'] and remote.snapshot()['operations']==[] and all(r['method']=='GET' for r in remote.requests());assert provider.unexpected==[];receipt['checks'].append('actual-Check-no-repeat/forced-Firefox-process-restart/persistent-same-job-inspection-hold/no-chat-reset-no-resend/no-reused-tab/no-publication-Git-effects');receipt['result']='PASS'
  except Exception as error:
   receipt['error']=str(error)
   if sid:
    try:toolbar(sid);dashboard(sid);receipt['page']=script(sid,"return document.body.innerText");receipt['state']=deployment(sid);(OUT/'p24-failure.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')))
    except Exception:pass
   print(json.dumps(receipt),flush=True);raise
  finally:
   provider.release_ack.set();receipt.update(aiRecords=provider.ai_records,saveRequests=provider.save_requests,uploads=provider.uploads,serverHashes={p:hashlib.sha256(b).hexdigest() for p,b in stored(provider).items()})
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();remote.close();provider.close();(OUT/'installed-develop-chat.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
