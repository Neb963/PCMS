"""P19 B: unmodified XPI -> packaged Deployer/Core/donor -> native/server.
Independent source bytes/version/request oracle, persistent profile, crash/restart.
All routes and services terminate in the disposable local fixture.
"""
from installed_source import Provider as ReadProvider,source_state,completed_source,editor,SLUG,HUMAN
from installed_creator import session15,detail
from installed_accounts import add,settle,login,inspect as inspect_accounts
from installed_lifecycle import permission_choice
from installed_journal import set_input,close_dashboard
from installed_git_catalog import connections
from installed_packages import *
from account_fixture import Fixture
import account_fixture,signal,threading
from git_write_https_fixture import GitWriteFixture
from git_https_fixture import TOKEN
NATIVE=(pathlib.Path(__file__).parent/'native_source_fixture.js').read_text()
_base_dashboard=dashboard
def dashboard(sid):
 handle=_base_dashboard(sid);wait(lambda:script(sid,"return !!document.querySelector('nav a[href=\"#settings\"]')"),20);return handle


class Provider(ReadProvider):
 def do_GET(self):
  f=self.server.fixture;host=self.headers.get('Host','').split(':')[0]
  if host=='perchance.org' and self.path=='/'+SLUG:
   with f.lock:
    g=json.loads(json.dumps(f.generator));version=dict(f.version);files={p:base64.b64encode(f.bytes[e['key']]).decode() for p,e in f.assets.items()};f.page_reads+=1
   js='window.generatorLastSaveTime='+str(version['time'])+';window.generatorSaveCount='+str(version['saveCount'])+';const INITIAL_VERSION='+json.dumps(version)+';const INITIAL_GENERATOR='+json.dumps(g)+';const INITIAL_FILES='+json.dumps(files)+';'+NATIVE
   return self.send(('<!doctype html><meta charset="utf-8"><title>Native source save fixture</title><h1>Protected native editor</h1><label>Model<textarea id="fixture-source-model"></textarea></label><a id="fixture-open-another" target="_blank" href="/'+SLUG+'#edit">Open another editor</a><script>'+js.replace('</',r'<\/')+'</script>').encode(),'text/html; charset=utf-8')
  return super().do_GET()
 def do_POST(self):
  f=self.server.fixture
  if self.path not in ['/api/save','/fixture/upload']:
   if self.path=='/api/getGeneratorPageData':
    with f.lock:f.metadata_reads+=1;unavailable=f.readback_outage
    if unavailable:return self.send({'status':'unavailable'},status=503)
   return super().do_POST()
  b=self.body()
  with f.lock:
   if self.path=='/fixture/upload':
    data=base64.b64decode(b['base64']);key=hashlib.md5(data).hexdigest()+'.bin';f.bytes[key]=data;f.uploads.append({'path':b['path'],'hash':hashlib.sha256(data).hexdigest(),'route':self.route});return self.send({'key':key,'size':len(data)})
   user=f.logins.get(self.route);valid=user and b.get('email')==user['email'] and b.get('sessionToken')==user['sessionToken'];f.save_requests.append({'route':self.route,'valid':bool(valid),'time':b.get('lastKnownSaveTime'),'count':b.get('lastKnownSaveCount'),'forced':b.get('forceSaveDespiteStaleness') is not None,'topManifest':'srcManifest' in b,'nestedManifest':'srcManifest' in b.get('generator',{}),'paths':sorted(b.get('srcManifest',{}))})
   assert valid and user['email']=='source@fixture.test';assert b.get('forceSaveDespiteStaleness') is None and 'srcManifest' not in b['generator'];assert b['generator']['name']==SLUG and isinstance(b['generator']['isPrivate'],bool)
   if f.race:
    f.race=False;f.generator['modelText']='Independent external editor changed source\n';f.version={'time':f.version['time']+1,'saveCount':f.version['saveCount']+1}
   if b.get('lastKnownSaveTime')!=f.version['time'] or b.get('lastKnownSaveCount')!=f.version['saveCount']:return self.send({'status':'stale',**f.version,'sourceRevision':hashlib.sha256(json.dumps(f.generator,sort_keys=True).encode()).hexdigest()})
   manifest=b['srcManifest'];assert isinstance(manifest,dict)
   for p,e in manifest.items():assert isinstance(p,str) and e['key'] in f.bytes and e['size']==len(f.bytes[e['key']])
   f.assets=manifest;f.generator.update(isPrivate=b['generator']['isPrivate'],modelText=b['generator']['modelText'],outputTemplate=b['generator']['outputTemplate'],srcManifest=manifest);f.version={'time':f.version['time']+1,'saveCount':f.version['saveCount']+1};reply={'status':'saved',**f.version,'sourceRevision':hashlib.sha256(json.dumps(f.generator,sort_keys=True).encode()).hexdigest()};delay=f.delay_after_apply and len(f.save_requests)>=getattr(f,'delay_save_number',1)
   if delay:f.applied.set()
  if delay:f.release_ack.wait(40)
  try:return self.send(reply)
  except (BrokenPipeError,ConnectionResetError):pass
account_fixture.Provider=Provider

def configure(f):
 f.assets={};f.bytes={};f.asset_reads=[];f.short_asset=False;f.version={'time':1793542499908,'saveCount':2};f.save_requests=[];f.uploads=[];f.race=False;f.delay_after_apply=False;f.applied=threading.Event();f.release_ack=threading.Event();f.readback_outage=False;f.metadata_reads=0;f.page_reads=0
 initial={'main.pjs':b'baseline model\r\n','index.html':b'<!doctype html>\r\n<p>Baseline</p>','src/keep.bin':bytes([0,255,17,42]),'src/nested/change.txt':b'old text\r\n','src/delete.bin':bytes(range(256))}
 for path,data in initial.items():
  if path.startswith('src/'):
   key=hashlib.md5(data).hexdigest()+'.bin';f.bytes[key]=data;f.assets[path[4:]]={'key':key,'size':len(data)}
 f.generator={'name':SLUG,'publicId':'source-stable-18','isPrivate':True,'modelText':initial['main.pjs'].decode(),'outputTemplate':initial['index.html'].decode(),'srcManifest':f.assets}
 return initial

def stored(f):
 with f.lock:return {'main.pjs':f.generator['modelText'].encode(),'index.html':f.generator['outputTemplate'].encode(),**{'src/'+p:f.bytes[e['key']] for p,e in f.assets.items()}}
def write_candidate(root,name,files):
 directory=root/name;directory.mkdir()
 for p,b in files.items():target=directory/p;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(b)
 return directory
def choose_source(sid,directory):
 # Firefox WebDriver supports real files but hangs in the headless native
 # folder-confirmation dialog. Populate its real FileList, then supply only
 # the platform folder-relative metadata. No product/RPC/save code is mocked.
 paths=sorted(p for p in directory.rglob('*') if p.is_file());relative=[directory.name+'/'+p.relative_to(directory).as_posix() for p in paths];old=save_state(sid)['j']
 script(sid,"document.getElementById('source-save-input').removeAttribute('webkitdirectory');return true;")
 element=call('POST',f'/session/{sid}/element',{'using':'css selector','value':'#source-save-input'})['element-6066-11e4-a52e-4f735466cecf'];call('POST',f'/session/{sid}/element/{element}/value',{'text':'\n'.join(str(p) for p in paths)})
 loaded=asyncjs(sid,"""const input=document.getElementById('source-save-input'),paths=arguments[0],result=[];if(input.files.length!==paths.length)throw Error('FILE_COUNT');for(let i=0;i<input.files.length;i++){const f=input.files[i];if(f.name!==paths[i].split('/').at(-1))throw Error('FILE_ORDER');Object.defineProperty(f,'webkitRelativePath',{value:paths[i],configurable:true});result.push({path:f.webkitRelativePath,sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',await f.arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join('')});}input.setAttribute('webkitdirectory','');input.dispatchEvent(new Event('change',{bubbles:true}));return result;""",[relative]);assert loaded==[{'path':p,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()} for p,file in zip(relative,paths)]
 wait(lambda:script(sid,"return !document.getElementById('source-save-submit').disabled"));click(sid,'#source-save-submit');wait(lambda:(lambda j:j and (not old or j['id']!=old['id'] or j['rev']>old['rev']))(save_state(sid)['j']),20);print('P19 source selection recorded',flush=True)
def save_state(sid):
 return asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore();let p=await c.list({table:'generators'}),g=null;for(const r of p.rows)if(r.slug==='existing-sentinel')g=await c.read('generators',r.id);const j=g?.sourceSaveJobId?await c.read('jobs',g.sourceSaveJobId):null;c.close();return {g,j};")
def wait_save(sid,state='COMPLETE'):
 def get():
  s=save_state(sid)
  if s['j'] and s['j']['state']=='HELD' and s['g'].get('sourceSaveCode') and state=='COMPLETE':raise AssertionError(('SOURCE_SAVE_HELD',s))
  return s if s['j'] and s['j']['state']==state else None
 return wait(get,100)
def hard_stop(sid,profile):
 old=pids(profile);assert old
 for pid in old:
  try:os.kill(pid,signal.SIGKILL)
  except ProcessLookupError:pass
 wait(lambda:not pids(profile),15)
 try:call('DELETE',f'/session/{sid}')
 except Exception:pass
 return old

def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve();identity=json.loads((xpi.parent/'identity.json').read_text());assert not identity['dirty'];assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
 receipt={'tier':'B/installed-P19/packaged-native-source/independent-server','source':identity['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]};assert receipt['xpiSha256']==identity['xpiSha256']
 with tempfile.TemporaryDirectory(prefix='pcms-p19-') as tmp:
  root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();home=root/'home';home.mkdir();provider=Fixture(root,extra_hosts=['user.uploads.dev']);initial=configure(provider);provider.install_bridge(home,root);remote=GitWriteFixture(root);baseline=remote.snapshot();remote.controls(race=None,lose_applied_ref=False,hide_applied_commits=False);(root/'fixture-socks-catalog.json').write_text(json.dumps([{'online':True,'hostname':'fixture-'+str(i),'ipv4_address':'10.124.0.'+str(i),'port':1080,'location':{'country':'Fixture','city':'Local'}} for i in range(1,9)]));remote.start();env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'};log=open(OUT/'driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None
  candidate={'main.pjs':'Selected exact candidate\r\n雪\n'.encode(),'index.html':b'<!doctype html>\r\n<p>Selected candidate</p>','src/keep.bin':initial['src/keep.bin'],'src/nested/change.txt':b'updated exact text\r\n','src/new.bin':bytes([0,128,255,1])};folder=write_candidate(root,'candidate',candidate)
  try:
   wait(driver_ready,15);sid,caps=session15(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'));assert int(caps['browserVersion'].split('.')[0])>=155 and caps['acceptInsecureCerts'] is False;context(sid,'chrome')
   for ca in [provider.ca,remote.ca]:script(sid,"Components.classes['@mozilla.org/security/x509certdb;1'].getService(Components.interfaces.nsIX509CertDB).addCertFromBase64(arguments[0],'C,,');return true;",[base64.b64encode(ca).decode()])
   prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];receipt['sandbox']=prefs;context(sid,'content');assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid);settings(sid);wait(lambda:script(sid,"return !!document.getElementById('allow-userscripts')"));click(sid,'#allow-userscripts');permission_choice(sid,True);wait(lambda:script(sid,"return !document.getElementById('allow-userscripts')"))
   owner=add(sid,'Source save fixture owner');settle(sid,owner,'LOGIN_REQUIRED');login(sid,owner,'source@fixture.test');click(sid,'#account-confirm');settle(sid,owner,'READY');connections(sid);set_input(sid,'#git-repository','fixture/catalog');set_input(sid,'#git-token',TOKEN);click(sid,'#git-save');wait(lambda:'Connection saved' in script(sid,"return document.getElementById('git-result').textContent"));wait(lambda:source_state(sid) and source_state(sid)['generator'].get('remoteId')=='public_source-stable-18',45);detail(sid,SLUG);wait(lambda:script(sid,"return !!document.getElementById('source-open')&&!document.getElementById('source-open').disabled"));click(sid,'#source-open');first=editor(sid)
   before=set(call('GET',f'/session/{sid}/window/handles'));click(sid,'#fixture-open-another');second=wait(lambda:next((h for h in call('GET',f'/session/{sid}/window/handles') if h not in before),None));call('POST',f'/session/{sid}/window',{'handle':second});wait(lambda:script(sid,"return !!document.getElementById('fixture-source-model')"));set_input(sid,'#fixture-source-model',HUMAN);dashboard(sid);detail(sid,SLUG);click(sid,'#source-inspect');wait(lambda:completed_source(sid),100)
   choose_source(sid,folder);blocked=wait_save(sid,'HELD');assert blocked['g']['sourceSaveCode']=='EDITOR_DIRTY' and provider.save_requests==[] and provider.uploads==[];assert stored(provider)==initial
   call('POST',f'/session/{sid}/window',{'handle':second});assert script(sid,"return modelTextEditor.getValue()")==HUMAN;call('DELETE',f'/session/{sid}/window');dashboard(sid);detail(sid,SLUG);before_rev=save_state(sid)['j']['rev'];click(sid,'#source-save-check');wait(lambda:save_state(sid)['j']['rev']>before_rev);s=wait_save(sid);assert stored(provider)==candidate and len(provider.save_requests)==1 and provider.version['saveCount']==3 and provider.generator['isPrivate'];assert s['g']['writerHold'] is None;receipt['checks'].append('actual-File-input-with-controlled-folder-metadata/packaged-module-Core-donor/native-top-level-manifest/single-request/full-roots-nested-binary-add-edit-delete/dirty-second-editor-kept-and-blocked/independent-bytes-counts')
   click(sid,'#source-save-work');wait(lambda:script(sid,"return !!document.getElementById('source-work-generator')"));click(sid,'#source-work-generator');wait(lambda:script(sid,"return !!document.getElementById('source-save-restore')&&!document.getElementById('source-save-restore').disabled"));prior_job=save_state(sid)['j']['id'];click(sid,'#source-save-restore');wait(lambda:save_state(sid)['j']['id']!=prior_job);s=wait_save(sid);assert stored(provider)==initial and len(provider.save_requests)==2 and provider.version['saveCount']==4 and provider.generator['isPrivate'];receipt['checks'].append('real-Work-to-exact-generator/previous-good-restore-through-same-guard/full-independent-baseline-bytes/no-relist')
   provider.delay_after_apply=True;choose_source(sid,folder);assert provider.applied.wait(45),'SAVE_NOT_APPLIED';assert stored(provider)==candidate and len(provider.save_requests)==3;possible=save_state(sid)['j'];assert possible['effect']['boundary']=='POSSIBLE';original_job=possible['id'];original_operation=possible['effect']['operationId']
   # Force process death while the actual request is applied but unanswered.
   close_dashboard(sid);old=hard_stop(sid,profile);sid=None;provider.delay_after_apply=False;provider.release_ack.set();reads=provider.metadata_reads;asset_reads=len(provider.asset_reads);sid,_=session15(binary,profile);assert not old.intersection(pids(profile));wait(lambda:provider.metadata_reads>reads and len(provider.asset_reads)>asset_reads,60);assert len(provider.save_requests)==3
   toolbar(sid);dashboard(sid);detail(sid,SLUG);s=wait(lambda:save_state(sid),20)
   s=wait_save(sid);assert s['j']['id']==original_job and s['j']['effect']['operationId']==original_operation and s['j']['effect']['boundary']=='OBSERVED' and stored(provider)==candidate and len(provider.save_requests)==3;receipt['checks'].append('forced-Firefox-process-interruption-after-application-before-ACK/POSSIBLE-durable/real-persistent-profile-restart/dashboard-closed-background-readback/exactly-one-unknown-effect/no-replay')
   # A later stale attempt keeps the independent external revision and both sources.
   click(sid,'#source-open');first=editor(sid);dashboard(sid);detail(sid,SLUG);provider.race=True;other={**candidate,'main.pjs':b'next selected version\n'};other_folder=write_candidate(root,'next-candidate',other);choose_source(sid,other_folder);s=wait_save(sid,'HELD');assert s['g']['sourceSaveCode']=='SOURCE_STALE' and s['j']['effect']['disposition']=='REJECTED';assert len(provider.save_requests)==4 and provider.generator['modelText']=='Independent external editor changed source\n' and provider.generator['isPrivate'];assert s['j']['save']['candidateManifest']!=s['j']['save']['baselineManifest'];assert s['j']['save']['readback']['manifestId']!=s['j']['save']['candidateManifest'];wait(lambda:'newer' in script(sid,"return document.getElementById('source-save-state').textContent"));click(sid,'#source-save-files button');wait(lambda:'SHA-256' in script(sid,"return document.getElementById('source-save-preview').textContent"));call('POST',f'/session/{sid}/window/rect',{'width':440,'height':900});(OUT/'p19-conflict.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')));receipt['checks'].append('server-enforced-stale-rejection/no-force-no-second-request/exact-candidate-base-server-conflict-UI/retained-source-preview')
   assert all(r['valid'] and r['topManifest'] and not r['nestedManifest'] and not r['forced'] for r in provider.save_requests);assert len({r['route'] for r in provider.save_requests})==1;assert provider.unexpected==[] and remote.snapshot()['head']==baseline['head'] and remote.snapshot()['files']==baseline['files'] and all(r['method']=='GET' for r in remote.requests());receipt['checks'].append('owner-route-container-binding/intact-unrelated-generator-Git-files/no-live-service/no-fixture-in-XPI');receipt['result']='PASS'
  except Exception as error:
   receipt['error']=str(error)
   if sid:
    try:toolbar(sid);dashboard(sid);receipt['accounts']=[{'id':a['id'],'state':a['state'],'code':a.get('holdCode'),'stage':a.get('flow',{}).get('stage'),'work':a.get('work')} for a in inspect_accounts(sid)['accounts']];receipt['page']=script(sid,"return document.body.innerText");receipt['state']=save_state(sid);(OUT/'p19-failure.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')))
    except Exception:pass
   print(json.dumps(receipt),flush=True);raise
  finally:
   provider.release_ack.set();receipt.update(saveRequests=provider.save_requests,uploads=provider.uploads,metadataReads=provider.metadata_reads,pageReads=provider.page_reads,serverVersion=provider.version,serverHashes={p:hashlib.sha256(b).hexdigest() for p,b in stored(provider).items()})
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();remote.close();provider.close();(OUT/'installed-source-save.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
