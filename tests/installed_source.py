"""P18 B: production read-only source/UI against independent native/CDN bytes.
Two exact protected editor documents, dirty human text, previous source/restart.
"""
from installed_creator import session15,detail,inspect_creator
from installed_accounts import add,settle,login
from installed_lifecycle import permission_choice
from installed_journal import set_input
from installed_git_catalog import connections
from installed_packages import *
from account_fixture import Fixture
import account_fixture
from git_write_https_fixture import GitWriteFixture
from git_https_fixture import TOKEN
SLUG='existing-sentinel'
HUMAN='Human unsaved source\nKeep this exact editor text.\n'

class Provider(account_fixture.Provider):
 def do_GET(self):
  f=self.server.fixture;host=self.headers.get('Host','').split(':')[0]
  if host=='user.uploads.dev':
   with f.lock:
    key=self.path.removeprefix('/file/');entry=next((v for v in f.assets.values() if v['key']==key),None);f.asset_reads.append({'key':key,'routeId':self.route,'path':self.path});data=f.bytes.get(key)
    if not entry or data is None:return self.send(b'',status=404)
    if f.short_asset:data=data[:-1]
   return self.send(data,'application/octet-stream')
  if host=='perchance.org' and self.path=='/'+SLUG:
   with f.lock:g=json.loads(json.dumps(f.generator));files={path:base64.b64encode(f.bytes[v['key']]).decode() for path,v in f.assets.items()}
   script_text='''window.__editorReady=true;window.userOwnsThisGenerator=true;window.__saveInFlight=false;window.editorCollabInitialSyncIsPending=false;window.__collabRoomFailed=false;window.collabEditKeyIsIncorrect=false;window.menuBar={saveState:'saved'};window.saveCheckpointManager={isDivergenceBlocked:()=>false};window.app={data:{generator:GENERATOR},saveGenerator(){fetch('/fixture/forbidden-save',{method:'POST'});throw Error('SAVE_MUST_NOT_RUN')}};function doc(text){return {text,clean:true,getValue(){return this.text},isClean(){return this.clean},iterLinkedDocs(fn){},setValue(){fetch('/fixture/forbidden-set',{method:'POST'});throw Error('SETTER_MUST_NOT_RUN')}}}const model=doc(app.data.generator.modelText),html=doc(app.data.generator.outputTemplate);window.modelTextEditor={getDoc:()=>model,getValue:()=>model.text,isClean:()=>model.clean};window.outputTemplateEditor={getDoc:()=>html,getValue:()=>html.text,isClean:()=>html.clean};const files=FILES;window.srcState={list:()=>Object.keys(files),readFile:async path=>Uint8Array.from(atob(files[path]),c=>c.charCodeAt(0)),isDirty:async()=>false,hasPending:()=>false,conflictPaths:()=>[]};const field=document.getElementById('fixture-source-model');field.value=model.text;field.addEventListener('input',()=>{model.text=field.value;model.clean=false;menuBar.saveState='unsaved'});'''.replace('GENERATOR',json.dumps(g)).replace('FILES',json.dumps(files)).replace('</',r'<\/')
   return self.send(('<!doctype html><meta charset="utf-8"><title>Independent native editor fixture</title><h1>Protected source editor</h1><label>Model source<textarea id="fixture-source-model" rows="8" cols="65"></textarea></label><p><a id="fixture-open-another" href="/'+SLUG+'#edit" target="_blank">Open another editor document</a></p><script>'+script_text+'</script>').encode(),'text/html; charset=utf-8')
  return super().do_GET()
 def do_POST(self):
  if self.path not in ['/api/getGeneratorsByUser','/api/checkGeneratorOwnership','/api/getGeneratorPageData']:return super().do_POST()
  f=self.server.fixture;b=self.body()
  with f.lock:
   user=f.logins.get(self.route);valid=user and b.get('email')==user['email'] and b.get('sessionToken')==user['sessionToken']
   if self.path=='/api/getGeneratorsByUser':
    f.reads.append({'routeId':self.route,'valid':bool(valid)});return self.send({'status':'success','generators':[{'name':SLUG,'isPrivate':True}],'generatorFolderMap':{}} if valid else {'status':'session-token-error'})
   if self.path=='/api/checkGeneratorOwnership':return self.send({'status':'is-owner' if valid and b.get('generatorName')==SLUG else 'is-not-owner'})
   return self.send({'status':'success','generator':f.generator} if b.get('generatorName')==SLUG else {'status':'generator-does-not-exist'})
account_fixture.Provider=Provider

def source_state(sid):
 return asyncjs(sid,"""const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore();let cursor=null,found=null;do{const p=await c.list({table:'generators',cursor});for(const r of p.rows)if(r.slug==='existing-sentinel')found=await c.read('generators',r.id);cursor=p.cursor;}while(cursor);if(!found){c.close();return null;}const job=found.sourceJobId?await c.read('jobs',found.sourceJobId):null,files=found.sourceManifest?await c.verifySource(found.sourceManifest):[],previous=found.previousGood?await c.verifySource(found.previousGood):[];const bytes={};for(const f of files){let raw='';const data=await c.bytes(f.blobId);for(const b of data)raw+=String.fromCharCode(b);bytes[f.path]=btoa(raw);}c.close();return {generator:found,job,files,previous,bytes};""")
def editor(sid):
 def find():
  for handle in call('GET',f'/session/{sid}/window/handles'):
   call('POST',f'/session/{sid}/window',{'handle':handle})
   if script(sid,"return location.href")=='https://perchance.org/'+SLUG+'#edit' and script(sid,"return !!document.getElementById('fixture-source-model')"):return handle
  return None
 return wait(find,30)
def file_rows(sid):return script(sid,"return [...document.querySelectorAll('#source-files button')].map(b=>({path:b.dataset.sourcePath,text:b.textContent}))")
def select_file(sid,path):
 wait(lambda:any(r['path']==path for r in file_rows(sid)));element=call('POST',f'/session/{sid}/element',{'using':'xpath','value':"//ul[@id='source-files']//button[@data-source-path="+json.dumps(path,ensure_ascii=False)+"]"})['element-6066-11e4-a52e-4f735466cecf'];call('POST',f'/session/{sid}/element/'+element+'/click',{});wait(lambda:path in script(sid,"return document.getElementById('source-file-state').textContent"))
def configure_model(f):
 f.assets={};f.bytes={}
 for i,path in enumerate(['Case.txt','case.txt','binary 雪.bin']+['files/asset-'+str(n).zfill(3)+'.bin' for n in range(48)]):
  data=bytes([i,255,0]) if path.endswith('.bin') else ('Exact '+path+'\r\n').encode();key=hashlib.md5(('fixture:'+path).encode()).hexdigest()+'.bin';f.bytes[key]=data;f.assets[path]={'key':key,'size':len(data),'sha256':hashlib.sha256(data).hexdigest()}
 f.generator={'name':SLUG,'publicId':'source-stable-18','isPrivate':True,'modelText':'saved model\r\nZażółć 雪\n','outputTemplate':'<!doctype html>\r\n<p>Independent HTML</p>\n','srcManifest':f.assets};f.asset_reads=[];f.short_asset=False

def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve();identity=json.loads((xpi.parent/'identity.json').read_text());assert not identity['dirty'];assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
 receipt={'tier':'B/installed-source/independent-protected-provider-CDN/real-editor-documents','source':identity['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]};assert receipt['xpiSha256']==identity['xpiSha256']
 with tempfile.TemporaryDirectory(prefix='pcms-source-') as tmp:
  root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();home=root/'home';home.mkdir();provider=Fixture(root,extra_hosts=['user.uploads.dev']);configure_model(provider);initial=json.loads(json.dumps(provider.generator));initial_files={**{'main.pjs':provider.generator['modelText'].encode(),'index.html':provider.generator['outputTemplate'].encode()},**{'src/'+p:provider.bytes[v['key']] for p,v in provider.assets.items()}};provider.install_bridge(home,root);remote=GitWriteFixture(root);baseline=remote.snapshot();remote.controls(race=None,lose_applied_ref=False,hide_applied_commits=False);(root/'fixture-socks-catalog.json').write_text(json.dumps([{'online':True,'hostname':'fixture-'+str(i),'ipv4_address':'10.124.0.'+str(i),'port':1080,'location':{'country':'Fixture','city':'Local'}} for i in range(1,9)]));remote.start();env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'};log=open(OUT/'driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None
  try:
   wait(driver_ready,15);sid,caps=session15(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'));assert int(caps['browserVersion'].split('.')[0])>=155 and caps['acceptInsecureCerts'] is False;context(sid,'chrome')
   for ca in [provider.ca,remote.ca]:script(sid,"Components.classes['@mozilla.org/security/x509certdb;1'].getService(Components.interfaces.nsIX509CertDB).addCertFromBase64(arguments[0],'C,,');return true;",[base64.b64encode(ca).decode()])
   prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];receipt['sandbox']=prefs;context(sid,'content');assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid);settings(sid);wait(lambda:script(sid,"return !!document.getElementById('allow-userscripts')"));click(sid,'#allow-userscripts');permission_choice(sid,True);wait(lambda:script(sid,"return !document.getElementById('allow-userscripts')"))
   owner=add(sid,'Source fixture owner');settle(sid,owner,'LOGIN_REQUIRED');login(sid,owner,'source@fixture.test');click(sid,'#account-confirm');settle(sid,owner,'READY');connections(sid);set_input(sid,'#git-repository','fixture/catalog');set_input(sid,'#git-token',TOKEN);click(sid,'#git-save');wait(lambda:'Connection saved' in script(sid,"return document.getElementById('git-result').textContent"));wait(lambda:source_state(sid) and source_state(sid)['generator'].get('remoteId')=='public_source-stable-18',45);detail(sid,SLUG);wait(lambda:script(sid,"return !!document.getElementById('source-open')&&!document.getElementById('source-open').disabled"));click(sid,'#source-open');editor(sid);before=set(call('GET',f'/session/{sid}/window/handles'));click(sid,'#fixture-open-another');second=wait(lambda:next((h for h in call('GET',f'/session/{sid}/window/handles') if h not in before),None));call('POST',f'/session/{sid}/window',{'handle':second});wait(lambda:script(sid,"return !!document.getElementById('fixture-source-model')"));set_input(sid,'#fixture-source-model',HUMAN);assert script(sid,"return document.getElementById('fixture-source-model').value")==HUMAN;dashboard(sid);detail(sid,SLUG);click(sid,'#source-inspect');s=wait(lambda:next((v for v in [source_state(sid)] if v and v['job'] and v['job']['state']=='COMPLETE'),None),180)
   assert s['generator']['sourceState']=='EDITOR_ATTENTION' and s['generator']['sourceHoldCode']=='EDITOR_DIRTY';assert len(s['generator']['sourceEditors'])==2 and sum(not e['clean'] for e in s['generator']['sourceEditors'])==1;assert set(s['bytes'])==set(initial_files) and all(base64.b64decode(s['bytes'][p])==b for p,b in initial_files.items());first_manifest=s['generator']['sourceManifest'];assert len(s['files'])==53;wait(lambda:'Editor needs attention' in script(sid,"return document.getElementById('source-state').textContent"));wait(lambda:len(file_rows(sid))==50);click(sid,'#source-files-next');wait(lambda:len(file_rows(sid))==3);set_input(sid,'#source-search','asset-047');wait(lambda:len(file_rows(sid))==1 and file_rows(sid)[0]['path']=='src/files/asset-047.bin');select_file(sid,'src/files/asset-047.bin');expected=hashlib.sha256(initial_files['src/files/asset-047.bin']).hexdigest();wait(lambda:expected in script(sid,"return document.getElementById('source-file-state').textContent"));call('POST',f'/session/{sid}/window',{'handle':second});assert script(sid,"return document.getElementById('fixture-source-model').value")==HUMAN;dashboard(sid);detail(sid,SLUG);assert provider.generator==initial and provider.unexpected==[]
   receipt['checks'].append('actual-protected-Open-editor/second-exact-target-document/real-human-dirty-input/all-documents-detected/no-setter-Save-or-reload/independent-53-file-root-CDN-binary-Unicode-case-newline-bytes/actual-later-page-search-viewer')
   with provider.lock:provider.short_asset=True;provider.generator['modelText']='new saved source\r\n'
   click(sid,'#source-inspect');wait(lambda:source_state(sid)['generator'].get('sourceHoldCode')=='SOURCE_ASSET_LENGTH',45);assert source_state(sid)['generator']['sourceManifest']==first_manifest
   with provider.lock:provider.short_asset=False;del provider.assets['binary 雪.bin']
   click(sid,'#source-check');s=wait(lambda:next((v for v in [source_state(sid)] if v['job']['state']=='COMPLETE' and v['generator']['sourceManifest']!=first_manifest),None),180);assert s['generator']['previousGood']==first_manifest and len(s['files'])==52;assert base64.b64decode(s['bytes']['main.pjs'])==b'new saved source\r\n';set_input(sid,'#source-search','binary 雪');wait(lambda:len(file_rows(sid))==1 and 'DELETED' in file_rows(sid)[0]['text']);select_file(sid,'src/binary 雪.bin');assert script(sid,"return document.getElementById('source-version').value")=='previous';expected=hashlib.sha256(initial_files['src/binary 雪.bin']).hexdigest();wait(lambda:expected in script(sid,"return document.getElementById('source-file-state').textContent"));saved_job=s['job']['id'];asset_count=len(provider.asset_reads);prior=stop(sid,profile);sid=None;sid,_=session15(binary,profile);assert not prior.intersection(pids(profile));toolbar(sid);dashboard(sid);detail(sid,SLUG);wait(lambda:script(sid,"return document.getElementById('source-search').value==='binary 雪'&&document.getElementById('source-version').value==='previous'"));wait(lambda:expected in script(sid,"return document.getElementById('source-file-state').textContent"));s=source_state(sid);assert s['job']['id']==saved_job and s['generator']['previousGood']==first_manifest and len(provider.asset_reads)==asset_count;assert provider.unexpected==[] and remote.snapshot()['head']==baseline['head'] and remote.snapshot()['files']==baseline['files'];assert all(r['method']=='GET' for r in remote.requests());assert len({r['routeId'] for r in provider.asset_reads})==1
   receipt['checks'].append('short-asset-rejected/previous-complete-snapshot-kept/new-saved-source-and-complete-deletion/previous-good-bytes/real-Firefox-restart/file-version-search-selection-kept/no-refetch/no-provider-or-Git-writes');receipt['files']=len(s['files']);receipt['assetReads']=provider.asset_reads;receipt['result']='PASS'
  except Exception as error:
   receipt['error']=str(error);receipt['assetReads']=provider.asset_reads;receipt['unexpected']=provider.unexpected
   if sid:
    try:dashboard(sid);receipt['page']=script(sid,"return document.body.innerText");receipt['state']=source_state(sid)
    except Exception:pass
   print(json.dumps(receipt),flush=True);raise
  finally:
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();remote.close();provider.close();(OUT/'installed-source.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
