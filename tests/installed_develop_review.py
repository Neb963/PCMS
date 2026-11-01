"""P25 B: real Review/Check/Cancel and parked native editors with exact source.
Controlled HTTPS fixtures only; no live service mutations.
"""
from installed_deployer import *
import installed_source_save as source_module
source_module.NATIVE+='\n'+(pathlib.Path(__file__).parent/'native_ai_fixture.js').read_text()
INSTRUCTIONS['prompt.md']='Exact prompt\n雪 🐈\nlast line'.encode()
PARKED=['parked-review-two','parked-review-three']
class AiProvider(source_module.Provider):
 def do_GET(self):
  if self.path in ['/'+p for p in PARKED]:
   f=self.server.fixture;slug=self.path[1:]
   with f.lock:g=json.loads(json.dumps(f.generator));version=dict(f.version);files={p:base64.b64encode(f.bytes[e['key']]).decode() for p,e in f.assets.items()}
   g.update(name=slug,publicId=slug+'-stable');js='const INITIAL_VERSION='+json.dumps(version)+';const INITIAL_GENERATOR='+json.dumps(g)+';const INITIAL_FILES='+json.dumps(files)+';'+source_module.NATIVE
   return self.send(('<!doctype html><meta charset="utf-8"><h1>Parked native editor</h1><textarea id="fixture-source-model"></textarea><script>'+js.replace('</',r'<\/')+'</script>').encode(),'text/html; charset=utf-8')
  return super().do_GET()
 def do_POST(self):
  if self.path=='/fixture/ai':
   with self.server.fixture.lock:self.server.fixture.ai_records.append(self.body())
   return self.send({'ok':True})
  return super().do_POST()
account_fixture.Provider=AiProvider

def select_editor(sid,slug):
 for h in call('GET',f'/session/{sid}/window/handles'):
  call('POST',f'/session/{sid}/window',{'handle':h})
  if call('GET',f'/session/{sid}/url')=='https://perchance.org/'+slug+'#edit':return h
 raise AssertionError('EDITOR_NOT_FOUND_'+slug)

def seed_parked(sid,remote,job_id):
 # Actual immutable Git folders with the same protected input bytes.
 old=head(remote.root);body=commit(remote.root,old);root=tree(remote.root,body['tree']['sha']);gens=next(e for e in root if e['path']=='generators');folders=tree(remote.root,gens['sha']);source=next(e for e in folders if e['path']==SLUG)
 for slug in PARKED:folders.append({'path':slug,'mode':'040000','type':'tree','sha':source['sha']})
 gens['sha']=put_tree(remote.root,folders);body.update(tree=put_tree(remote.root,root),parents=[old],message='Independent parked review fixture folders');tip=put_commit(remote.root,body);git(remote.root,'update-ref','refs/heads/main',tip)
 rows=asyncjs(sid,"""const {openCore,sha256}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),original=await c.read('jobs',arguments[0]),base=await c.read('generators',original.targetId),a=await c.read('accounts',original.accountId),out=[];
 for(const slug of arguments[1]){const jobId=crypto.randomUUID(),folder='generators/'+slug,generatorId='git:'+base.repositoryId+':'+await sha256(new TextEncoder().encode(folder)),nonce=crypto.randomUUID(),remoteId='public_'+slug+'-stable',tab=await browser.tabs.create({url:'https://perchance.org/'+slug+'#edit',cookieStoreId:a.containerId,active:false});out.push({jobId,generatorId,slug,nonce,remoteId,tabId:tab.id});}
 c.close();return out;""",[job_id,PARKED])
 for row in rows:
  row['handle']=wait(lambda:next((h for h in call('GET',f'/session/{sid}/window/handles') if (call('POST',f'/session/{sid}/window',{'handle':h}) is None or True) and call('GET',f'/session/{sid}/url')=='https://perchance.org/'+row['slug']+'#edit'),None),30)
  wait(lambda:script(sid,"return !!window.fixtureAi"));click(sid,'#aiAgentNewChatBtn');set_input(sid,'#aiAgentInputEl','Prior parked fixture run');click(sid,'#aiAgentSendBtn');click(sid,'#aiAgentStopBtn');click(sid,'#fixture-settle-ai');toolbar(sid);dashboard(sid)
  asyncjs(sid,"""const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),{accountDocumentWitness}=await import(browser.runtime.getURL('modules/account-observations.mjs')),{nativeAi}=await import(browser.runtime.getURL('modules/ai-native.mjs')),c=await openCore(),row=arguments[1],old=await c.read('jobs',arguments[0]),g=await c.read('generators',old.targetId),a=await c.read('accounts',old.accountId),w=(await browser.scripting.executeScript({target:{tabId:row.tabId,frameIds:[0]},world:'ISOLATED',func:accountDocumentWitness,args:[]}))[0].result,o=(await browser.scripting.executeScript({target:{tabId:row.tabId,frameIds:[0]},world:'MAIN',func:nativeAi,args:[{slug:row.slug,remoteId:row.remoteId,principalFingerprint:a.expectedPrincipal,nonce:row.nonce,action:'OBSERVE',operationId:row.jobId}]}))[0].result;
 if(!o.ok||!o.chatDigest||!o.idle)throw Error('PARKED_NATIVE_CHECKPOINT_INVALID');const ai={...old.deployment.ai,sendOperationId:row.jobId+'-send',newChatOperationId:row.jobId+'-reset',nonce:row.nonce,tabId:row.tabId,witness:w,document:o.document,chatDigest:o.chatDigest,automationActive:false},deployment={...old.deployment,phase:'AI_UNKNOWN',ai,folder:'generators/'+row.slug,cancelRequestedAt:null,readiness:null};await c.mutate([{table:'jobs',id:row.jobId,value:{...old,id:row.jobId,targetId:row.generatorId,logicalKey:'fixture-parked:'+row.jobId,effect:{operationId:ai.sendOperationId,kind:'AI_SEND',boundary:'OBSERVED',disposition:'APPLIED'},effects:[{operationId:ai.sendOperationId,kind:'AI_SEND',boundary:'OBSERVED',disposition:'APPLIED'}],state:'HELD',recovery:{action:'REVIEW_AI',code:'AI_REVIEW_REQUIRED'},input:{...old.input,slug:row.slug,remoteId:row.remoteId},deployment},refs:old.refs},{table:'generators',id:row.generatorId,value:{...g,id:row.generatorId,slug:row.slug,folder:deployment.folder,remoteId:row.remoteId,deploymentJobId:row.jobId,sourceSaveJobId:row.jobId,creatorJobId:null,writerHold:{jobId:row.jobId,reason:'DEVELOP'},deploymentState:'AI_UNKNOWN',deploymentCode:'AI_REVIEW_REQUIRED'},refs:g.refs}],{step:'FIXTURE_PARKED_REVIEW_CHECKPOINT',result:'COMPLETE'});await browser.sessions.setTabValue(row.tabId,'pcmsDevelopTab',{jobId:row.jobId,accountId:a.id,personaUid:a.personaUid,remoteId:row.remoteId,witness:w,role:'REVIEW'});c.close();return true;""",[job_id,row])
 return rows

def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve();identity=json.loads((xpi.parent/'identity.json').read_text());assert not identity['dirty'];assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
 receipt={'tier':'B/installed-P25/same-chat-review/independent-native-counts','source':identity['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]};assert receipt['xpiSha256']==identity['xpiSha256']
 with tempfile.TemporaryDirectory(prefix='pcms-p25-') as tmp:
  root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();home=root/'home';home.mkdir();provider=Fixture(root,extra_hosts=['user.uploads.dev']);initial=configure(provider);provider.generator['isPrivate']=False;provider.ai_records=[];provider.delay_after_apply=False;provider.install_bridge(home,root);remote=GitWriteFixture(root);remote.controls(race=None,lose_applied_ref=False,hide_applied_commits=False);ready_head=ready(remote,action='DEVELOP');baseline=remote.snapshot();expected={**initial,**{'src/'+p:INSTRUCTIONS[p] for p in ['specification.md','ui.md','agents.md']}};(root/'fixture-socks-catalog.json').write_text(json.dumps([{'online':True,'hostname':'fixture-'+str(i),'ipv4_address':'10.124.0.'+str(i),'port':1080,'location':{'country':'Fixture','city':'Local'}} for i in range(1,9)]));remote.start();env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'};log=open(OUT/'driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None
  try:
   wait(driver_ready,15);sid,caps=session15(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'));assert int(caps['browserVersion'].split('.')[0])>=155 and caps['acceptInsecureCerts'] is False;context(sid,'chrome')
   for ca in [provider.ca,remote.ca]:script(sid,"Components.classes['@mozilla.org/security/x509certdb;1'].getService(Components.interfaces.nsIX509CertDB).addCertFromBase64(arguments[0],'C,,');return true;",[base64.b64encode(ca).decode()])
   prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];receipt['sandbox']=prefs;context(sid,'content');assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid);settings(sid);wait(lambda:script(sid,"return !!document.getElementById('allow-userscripts')"));click(sid,'#allow-userscripts');permission_choice(sid,True);wait(lambda:script(sid,"return !document.getElementById('allow-userscripts')"))
   owner=add(sid,'DEVELOP staging fixture owner');settle(sid,owner,'LOGIN_REQUIRED');login(sid,owner,'source@fixture.test');click(sid,'#account-confirm');settle(sid,owner,'READY');connections(sid);set_input(sid,'#git-repository','fixture/catalog');set_input(sid,'#git-token',TOKEN);click(sid,'#git-save');wait(lambda:'Connection saved' in script(sid,"return document.getElementById('git-result').textContent"));close_dashboard(sid)
   wait(lambda:len(provider.ai_records)==2,120);call('POST',f'/session/{sid}/window',{'handle':call('GET',f'/session/{sid}/window/handles')[0]});toolbar(sid);dashboard(sid)
   s=wait(lambda:(lambda s:s if s['j'] and s['j']['deployment']['phase']=='AI_RUNNING' and s['j']['state']=='HELD' else None)(deployment(sid)),90);j=s['j'];job_id=j['id'];operation=j['deployment']['ai']['sendOperationId'];assert j['deployment']['ai']['chatDigest'] and j['effect']['operationId']==operation and j['effect']['boundary']=='OBSERVED';assert provider.ai_records==[{'action':'NEW_CHAT'},{'action':'SEND','text':INSTRUCTIONS['prompt.md'].decode()}];assert len(provider.save_requests)==2 and stored(provider)==expected and provider.generator['isPrivate'];assert s['g']['writerHold']['jobId']==job_id and not j['deployment'].get('publicationReceipt');receipt['checks'].append('automatic-READY-DEVELOP/distinct-exact-staging/actual-native-new-chat-transition/exact-Unicode-newline-prompt/one-send/closed-dashboard/bound-reserved-editor')
   detail(sid,SLUG);click(sid,'#deployment-review');wait(lambda:'Protected original chat opened' in script(sid,"return document.getElementById('deployment-detail').textContent"));active=asyncjs(sid,"return (await browser.tabs.query({active:true,currentWindow:true}))[0].url;");assert active=='https://perchance.org/'+SLUG+'#edit'
   click(sid,'#deployment-ai-check');wait(lambda:deployment(sid)['j']['recovery']['code']=='AI_STILL_ACTIVE');assert not deployment(sid)['j']['deployment'].get('readiness')
   editor=select_editor(sid,SLUG);click(sid,'#aiAgentStopBtn');toolbar(sid);dashboard(sid);detail(sid,SLUG);click(sid,'#deployment-ai-check');wait(lambda:deployment(sid)['j']['recovery']['code']=='AI_APPLICATION_UNSETTLED');assert not deployment(sid)['j']['deployment'].get('readiness')
   select_editor(sid,SLUG);click(sid,'#fixture-settle-ai');toolbar(sid);dashboard(sid);detail(sid,SLUG);click(sid,'#deployment-ai-check');wait(lambda:(deployment(sid)['j']['deployment'].get('readiness') or {}).get('kind')=='ELIGIBLE_UNKNOWN');wait(lambda:script(sid,"const e=document.getElementById('ai-ready-attestation'),b=document.getElementById('deployment-ai-check');return !!e&&!e.disabled&&!b.disabled&&!e.parentElement.hidden;"));click(sid,'#ai-ready-attestation');assert script(sid,"return document.getElementById('ai-ready-attestation').checked");click(sid,'#deployment-ai-check');wait(lambda:(deployment(sid)['j']['deployment'].get('readiness') or {}).get('kind')=='HUMAN_VERIFIED_READY');assert deployment(sid)['j']['deployment']['readiness']['second']['observedAt']-deployment(sid)['j']['deployment']['readiness']['first']['observedAt']>=1000
   select_editor(sid,SLUG);set_input(sid,'#fixture-source-model','Late native AI/human source edit 雪');toolbar(sid);dashboard(sid);detail(sid,SLUG);wait(lambda:deployment(sid)['j']['recovery']['code']=='AI_REVIEW_CHANGED');assert not deployment(sid)['j']['deployment'].get('readiness');assert len([r for r in provider.ai_records if r['action']=='SEND'])==1;assert len(provider.save_requests)==2 and stored(provider)==expected;receipt['checks'].append('real-Review-focus-exact-bound-tab/active-denial/native-Stop-unsettled-denial/two-separated-stable-samples/explicit-human-ready-never-success/late-edit-revokes/no-save-or-resend')
   # Seed two already-completed native review checkpoints, then drive only the
   # production P25 boundary. P24 automatic intake/send is independently proven.
   parked=seed_parked(sid,remote,job_id);assert len(parked)==2
   for row in parked:
    script(sid,"location.hash='#generators/'+arguments[0]",[row['generatorId']]);wait(lambda:script(sid,"return !!document.getElementById('deployment-review')"));click(sid,'#deployment-review');wait(lambda:'Protected original chat opened' in script(sid,"return document.getElementById('deployment-detail').textContent"));assert asyncjs(sid,"return (await browser.tabs.query({active:true,currentWindow:true}))[0].id;")==row['tabId'];click(sid,'#deployment-ai-check');wait(lambda:script(sid,"return document.getElementById('deployment-state').textContent.includes('explicit readiness attestation')"))
   handles=call('GET',f'/session/{sid}/window/handles');assert all(h in handles for h in [editor,*[r['handle'] for r in parked]]);assert len([r for r in provider.ai_records if r['action']=='SEND'])==3;receipt['checks'].append('three-real-protected-parked-native-tabs/seeded-prior-review-checkpoints/production-Review-and-Check-each/exact-tab-focusing/no-two-review-cap/no-tab-recycling')
   detail(sid,SLUG);click(sid,'#deployment-cancel');wait(lambda:deployment(sid)['j']['deployment'].get('cancelRequestedAt'));assert deployment(sid)['g']['writerHold']['jobId']==job_id and deployment(sid)['j']['deployment']['ai']['chatDigest'];assert len(provider.save_requests)==2;before_ai=list(provider.ai_records);close_dashboard(sid);old=hard_stop(sid,profile);sid=None;sid,_=session15(binary,profile);assert not old.intersection(pids(profile));toolbar(sid);dashboard(sid);wait(lambda:deployment(sid)['j']['recovery']['code']=='AI_INSPECTION_REQUIRED',90);assert deployment(sid)['j']['id']==job_id and deployment(sid)['j']['deployment']['cancelRequestedAt'];assert provider.ai_records==before_ai and len(provider.save_requests)==2 and stored(provider)==expected;assert remote.snapshot()['operations']==[] and all(r['method']=='GET' for r in remote.requests());assert provider.unexpected==[];receipt['checks'].append('actual-Cancel-fences-future-effects/retains-writer-source-tabs/forced-process-restart/durable-cancel-inspection/no-new-chat-send-save-publication-Git-write');receipt['result']='PASS'
  except Exception as error:
   receipt['error']=str(error)
   if sid:
    try:call('POST',f'/session/{sid}/window',{'handle':call('GET',f'/session/{sid}/window/handles')[0]});toolbar(sid);dashboard(sid);receipt['page']=script(sid,"return document.body.innerText");receipt['state']=deployment(sid);(OUT/'p25-failure.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')))
    except Exception:pass
   print(json.dumps(receipt),flush=True);raise
  finally:
   provider.release_ack.set();receipt.update(aiRecords=provider.ai_records,saveRequests=provider.save_requests,uploads=provider.uploads,serverHashes={p:hashlib.sha256(b).hexdigest() for p,b in stored(provider).items()})
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();remote.close();provider.close();(OUT/'installed-develop-review.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
