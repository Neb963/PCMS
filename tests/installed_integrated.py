"""R08: one clean persistent profile, seven enabled production packages.

All native/HTTPS/Git services are independent disposable local fixtures.
Component crash, lost-ACK and dirty-editor journeys remain separate checks.
"""
# Load creation before native-source helpers so their normal cooperative
# provider inheritance retains the independent creation endpoints.
import account_fixture as fixture_module
BaseProvider=fixture_module.Provider
from installed_creation import Provider as CreationProvider
from installed_develop_complete import AiProvider,finish_review,check_git
from installed_deployer import *
from installed_directory import Provider as DirectoryProvider,FRAME,ORDER,check,measured
from installed_refresh_markers import refresh,verified,measured_response,assert_bytes
from installed_refresh_clock import settings_clock
from installed_discover import discover,choose,activate,top,AVAILABLE,RESERVED
from installed_discover_preparation import import_batch
from installed_creator import target
from installed_accounts import account
from installed_backup_export import request_export,completed,file_receipt,read_archive
from installed_backup_sessions import backup_page,inspect_paused
from installed_restore import restore,select_archive,confirm,census,unrelated,assert_unrelated
from installed_journal import journal,inspect as journal_state,read_zip
from installed_search_contract import run as search_contract
from installed_long_session import modules

NEW='chain-free-name';TAKEN='chain-reserved-name';UNKNOWN='chain-unknown-name'

class Provider(DirectoryProvider,AiProvider):
 def body(self):
  if not hasattr(self,'parsed_body'):self.parsed_body=super().body()
  return self.parsed_body
 def do_GET(self):
  f=self.server.fixture;host=self.headers.get('Host','').split(':')[0];name=self.path.lstrip('/')
  if host not in ['perchance.org',FRAME,'user.uploads.dev'] or host=='perchance.org' and self.path=='/':return BaseProvider.do_GET(self)
  if host=='perchance.org' and name in [NEW,TAKEN,UNKNOWN] or host=='perchance.org' and name.startswith('temporary-created-'):
   with f.lock:f.slug_reads.append({'slug':name,'routeId':self.route});exists=name in f.model
   body='<div id="outputEl">Independent created output</div>' if exists else RESERVED if name==TAKEN else '<p>Unrecognized provider response</p>' if name==UNKNOWN else AVAILABLE
   return self.send(('<!doctype html><meta charset="utf-8"><title>Integrated slug fixture</title>'+body).encode(),'text/html; charset=utf-8')
  return super().do_GET()
 def do_POST(self):
  f=self.server.fixture;endpoint=self.path.rsplit('/',1)[-1]
  if self.path=='/fixture/signin':return BaseProvider.do_POST(self)
  if endpoint not in ['getGeneratorsByUser','checkGeneratorOwnership','getGeneratorPageData','save','changeGeneratorName']:return super().do_POST()
  b=self.body()
  with f.lock:
   # Provider credentials are account-specific and remain valid after a
   # legitimate restore to a fresh protected route/container.
   user=next((u for u in f.logins.values() if b.get('email')==u['email'] and b.get('sessionToken')==u['sessionToken']),None)
   if endpoint=='getGeneratorsByUser':
    f.reads.append({'routeId':self.route,'valid':bool(user)});names=[n for n in f.owned if user and f.owners.get(n)==user['email']]
    return self.send({'status':'success','generators':[{'name':n,'isPrivate':f.model[n]['isPrivate']} for n in names],'generatorFolderMap':{}} if user else {'status':'session-token-error'})
   if endpoint=='checkGeneratorOwnership':return self.send({'status':'is-owner' if user and f.owners.get(b.get('generatorName'))==user['email'] else 'is-not-owner'})
   if endpoint=='getGeneratorPageData':
    name=b.get('generatorName');return self.send({'status':'success','generator':f.model[name]} if name in f.model else {'status':'generator-does-not-exist'})
   if endpoint=='save' and b.get('generator',{}).get('name')=='minimal':
    assert user;f.owners['temporary-created-'+str(f.created+1)]=user['email'];creation=True
   elif endpoint=='changeGeneratorName':
    assert user and f.owners.get(b.get('currentName'))==user['email'];f.owners[b['newName']]=f.owners.pop(b['currentName']);creation=True
   else:creation=False
  if creation:return CreationProvider.do_POST(self)
  return super().do_POST()

account_fixture.Provider=Provider

def complete_restore(sid):
 def get():
  s=restore(sid)
  if s['control']['state']=='COMPLETE':return s
  if s['job']['state']=='FAILED':raise AssertionError(('RESTORE_FAILED',s['control'].get('code'),s['job'].get('recovery')))
  return None
 return wait(get,240)

def catalog(sid):
 script(sid,"location.hash='#generators'");wait(lambda:script(sid,"return !!document.getElementById('catalog-check')"));click(sid,'#catalog-check')

def done(sid,version):
 return wait(lambda:(lambda s:s if s['j'] and s['j']['state']=='COMPLETE' and s['j']['deployment']['phase']=='COMPLETE' and s['j']['deployment']['version']==version else None)(deployment(sid)),150)

def ready_unicode_deploy(remote):
 old=ready(remote,version='chain-deploy',include_binary=True);body=commit(remote.root,old);entries=tree(remote.root,body['tree']['sha']);gens=next(e for e in entries if e['path']=='generators');folders=tree(remote.root,gens['sha']);folder=next(e for e in folders if e['path']==SLUG);files=tree(remote.root,folder['sha']);src=next(e for e in files if e['path']=='src');assets=tree(remote.root,src['sha']);assets.append({'path':'雪.bin','type':'blob','mode':'100644','sha':put_blob(remote.root,bytes([255,0,128,42]))});src['sha']=put_tree(remote.root,assets);folder['sha']=put_tree(remote.root,files);gens['sha']=put_tree(remote.root,folders);body.update(tree=put_tree(remote.root,entries),parents=[old],message='Independent Unicode binary candidate\n');tip=put_commit(remote.root,body);git(remote.root,'update-ref','refs/heads/main',tip,old)

def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve();identity=json.loads((xpi.parent/'identity.json').read_text());assert not identity['dirty'];assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
 receipt={'tier':'B/DSK-one-profile-seven-module-rehearsal','source':identity['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]};assert receipt['xpiSha256']==identity['xpiSha256']
 with tempfile.TemporaryDirectory(prefix='pcms-integrated-') as tmp:
  root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();home=root/'home';home.mkdir();disk=root/'downloads';disk.mkdir();provider=Fixture(root,extra_hosts=['user.uploads.dev',FRAME]);initial=configure(provider);provider.generator['isPrivate']=False;provider.unicode_native_paths=True;receipt['nativePathPolicy']='explicit synthetic Unicode-accepting native fixture; default rejecting policy separately retained; no live alphabet assertion';provider.model={SLUG:provider.generator,'minimal':{'name':'minimal','publicId':'native-template','isPrivate':False,'modelText':'native template','outputTemplate':'<p>Template</p>','srcManifest':{}}};provider.owned={SLUG};provider.owners={SLUG:'source@fixture.test'};provider.active_slug=NEW;provider.loss=None;provider.hide=None;provider.created=0;provider.writes=[];provider.slug_reads=[];provider.ambiguous=False;provider.ai_records=[];provider.directory_mode='complete';provider.directory_reads=[];provider.directory_advances=[];provider.marker_order=(['pinned-other','pinned-second',SLUG]+[s for s in ORDER if s not in ['pinned-other',SLUG]])[:-1];provider.install_bridge(home,root);remote=GitWriteFixture(root);remote.controls(race=None,lose_applied_ref=False,hide_applied_commits=False);baseline=remote.snapshot()
  (root/'fixture-socks-catalog.json').write_text(json.dumps([{'online':True,'hostname':'fixture-'+str(i),'ipv4_address':'10.124.0.'+str(i),'port':1080,'location':{'country':'Fixture','city':'Local'}} for i in range(1,9)]));remote.start();env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'};log=open(OUT/'integrated-driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None
  try:
   wait(driver_ready,15);sid,caps=session15(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'));assert int(caps['browserVersion'].split('.')[0])>=155 and caps['acceptInsecureCerts'] is False;context(sid,'chrome')
   for ca in [provider.ca,remote.ca]:script(sid,"Components.classes['@mozilla.org/security/x509certdb;1'].getService(Components.interfaces.nsIX509CertDB).addCertFromBase64(arguments[0],'C,,');return true;",[base64.b64encode(ca).decode()])
   script(sid,"Services.prefs.setStringPref('browser.download.dir',arguments[0]);Services.prefs.setIntPref('browser.download.folderList',2);Services.prefs.setBoolPref('browser.download.useDownloadDir',true);return true;",[str(disk)]);prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];receipt['sandbox']=prefs;context(sid,'content');assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid);settings(sid);wait(lambda:script(sid,"const b=document.getElementById('allow-userscripts');return b&&!b.hidden&&!b.disabled;"));click(sid,'#allow-userscripts');permission_choice(sid,True);wait(lambda:script(sid,"return !document.getElementById('allow-userscripts')"))
   ids=[]
   for label in ['Integrated source owner','Integrated second owner']:
    owner=add(sid,label);settle(sid,owner,'LOGIN_REQUIRED');ids.append(owner)
   for owner,email in zip(sorted(ids),['source@fixture.test','second@fixture.test']):
    from installed_accounts import page as account_page
    account_page(sid,owner);login(sid,owner,email);click(sid,'#account-confirm');settle(sid,owner,'READY')
   owners=[account(sid,id) for id in ids];assert len({a['expectedPrincipal'] for a in owners})==2 and len({a['routeId'] for a in owners})==2 and len({a['containerId'] for a in owners})==2;assert len(modules(sid))==7 and all(m['enabled'] for m in modules(sid));receipt['checks'].append('one-persistent-clean-profile/two-real-UI-Confirm/distinct-principals-containers-routes/seven-enabled')
   connections(sid);set_input(sid,'#git-repository','fixture/catalog');set_input(sid,'#git-token',TOKEN);click(sid,'#git-save');wait(lambda:'Connection saved' in script(sid,"return document.getElementById('git-result').textContent"));discover(sid);import_batch(sid,NEW+'\n'+TAKEN+'\n'+UNKNOWN,ids[0]);wait(lambda:'UNKNOWN' in script(sid,"return document.getElementById('discover-state').textContent"),75);top(sid)
   created=wait(lambda:(lambda g:g if g and g.get('creatorState')=='CREATED' else None)(target(sid,NEW)),120);assert created['listing']=='UNLISTED' and created['allocation'] is None and provider.created==1 and [w['kind'] for w in provider.writes]==['CREATE','RENAME'];snapshot=remote.snapshot();folder='generators/'+NEW+'/';assert [p for p in snapshot['files'] if p.startswith(folder)]==[folder+'DEPLOYMENT.md'];assert base64.b64decode(snapshot['files'][folder+'DEPLOYMENT.md']['bytes'])==b'Format: PCMS-1\nVersion: v1\nAction: DEVELOP\nStatus: NOT_READY\n';assert not any(p.startswith(('generators/'+TAKEN+'/','generators/'+UNKNOWN+'/')) for p in snapshot['files']);receipt['checks'].append('actual-Discover-Available-Taken-Unknown/marker-only-Git-preparation/automatic-Creator/one-private-create-and-rename/unlisted-stable-identity/no-negative-folder-or-provider-write')
   ready_unicode_deploy(remote);catalog(sid);deployed=done(sid,'chain-deploy');expected={'main.pjs':b'pinned candidate not saved in P20\n','index.html':b'<p>Pinned selected candidate</p>','src/new.bin':bytes([0,255,128,17]),'src/雪.bin':bytes([255,0,128,42])};assert stored(provider)==expected and not provider.generator['isPrivate'] and deployed['g']['poolMember'] and deployed['g']['writerHold'] is None;assert len(provider.save_requests)==3;cycle=deployed['g']['refreshCycle']['cycleId'];receipt['checks'].append('same-profile/separate-DEPLOY-folder/unlist-full-PJS-HTML-binary-Unicode-source/publication-pool-DONE/independent-bytes/writer-release')
   ready(remote,version='chain-develop',action='DEVELOP');catalog(sid);wait(lambda:len(provider.ai_records)==2,120);wait(lambda:(deployment(sid)['j'] or {}).get('deployment',{}).get('phase')=='AI_RUNNING',90);finish_review(sid,'Integrated accepted 雪','<p>Integrated accepted 🐈</p>');developed=done(sid,'chain-develop');expected.update({'main.pjs':'Integrated accepted 雪'.encode(),'index.html':'<p>Integrated accepted 🐈</p>'.encode(),'src/reviewed.bin':bytes([0,255,128,17,42]),**{'src/'+p:INSTRUCTIONS[p] for p in ['specification.md','ui.md','agents.md']}});assert stored(provider)==expected and not provider.generator['isPrivate'] and developed['g']['refreshCycle']['cycleId']==cycle;check_git(remote,expected,INSTRUCTIONS,4);assert remote.snapshot()['files']['README.md']==baseline['files']['README.md'];assert provider.ai_records==[{'action':'NEW_CHAT'},{'action':'SEND','text':INSTRUCTIONS['prompt.md'].decode()},{'action':'STOP'}],provider.ai_records;receipt['checks'].append('same-generator-DEVELOP-update/distinct-src-instructions/exact-native-prompt/real-human-review-Finish/full-source-Git-SOURCE/publication-pool-DONE/preserved-cycle-and-root-instructions')
   settings_clock(sid,1,1);check(sid);wait(lambda:measured(sid),100);refresh(sid,provider);saved=verified(sid,1);marker=saved['g']['refreshMarker']['id'];assert_bytes(provider,expected,marker,1);receipt['measuredResponse']=measured_response(sid,saved);receipt['checks'].append('same-profile/actual-rendered-directory/fixed-pin-filter-scope/automatic-Refresher/both-markers/full-byte-neutrality/measured-response')
   search_contract(sid,receipt);journal(sid);before={f['id'] for f in journal_state(sid)['files']};click(sid,'#export-journal');export=wait(lambda:next((f for f in journal_state(sid)['files'] if f['id'] not in before and f['state']=='COMPLETE'),None),60);jm,events=read_zip(disk/export['filename']);assert any(e.get('step')=='UI_QUERY' and e.get('code')=='STORAGE_UNAVAILABLE' for e in events);journal_raw=b''.join(zipfile.ZipFile(disk/export['filename']).read(n) for n in ['manifest.json','events.jsonl','diagnostics.json']);assert TOKEN.encode() not in journal_raw and 'Integrated accepted 雪'.encode() not in journal_raw and all(u['sessionToken'].encode() not in journal_raw for u in provider.logins.values());receipt['journal']={'sha256':export['sha256'],'first':jm['first'],'last':jm['last'],'count':jm['count']};receipt['checks'].append('actual-IDB-query-fault/default-causal-Journal/real-Export/independent-disk-CRC-hashes/no-missing-sequence')
   backup_page(sid);backup=request_export(sid);assert completed(sid,backup['jobId'])['state']=='COMPLETE';bf=file_receipt(sid,backup['jobId']);path=disk/bf['filename'];manifest,values,binaries=read_archive(path);assert len(manifest['logicalMappings'])==2 and len(values['records/modules.ndjson'])==7 and all(m['enabled'] for m in values['records/modules.ndjson']);archive_hash=hashlib.sha256(path.read_bytes()).hexdigest();assert archive_hash==bf['sha256'];archived_source=next(g for g in values['records/generators.ndjson'] if g.get('slug')==SLUG);expected_hashes={p:hashlib.sha256(b).hexdigest() for p,b in stored(provider).items()};before_saves=len(provider.save_requests);before_git=len(remote.snapshot()['operations']);sentinel=unrelated(sid,'Integrated unrelated');prior=census(sid);old_dataset=restore(sid)['root']['dataset'];select_archive(sid,path);confirm(sid);restored=complete_restore(sid);control=restored['control'];assert restored['root']['dataset']==control['newDataset'] and control['newDataset']!=old_dataset and restored['root']['paused'] and not restored['root'].get('restoreHold');assert len(control['mappings'])==2 and all(m['allocationReceipt']['fresh'] and m['destinationContainerId'] not in prior for m in control['mappings']);assert all(p['route']['state']=='VALIDATED' and p['login']['state']=='VALIDATED' for p in control['participants']);assert all(m['enabled'] for m in modules(sid));assert_unrelated(sid,sentinel)
   restored_source=target(sid,SLUG);assert restored_source['sourceManifest']==archived_source['sourceManifest'] and restored_source['previousGood']==archived_source['previousGood'];actual_hashes=asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),files=await c.verifySource(arguments[0]);c.close();return Object.fromEntries(files.map(f=>[f.path,f.sha256]));",[restored_source['sourceManifest']]);assert actual_hashes==expected_hashes;assert len(provider.save_requests)==before_saves and len(remote.snapshot()['operations'])==before_git;assert hashlib.sha256(path.read_bytes()).hexdigest()==archive_hash;assert provider.unexpected==[] and all(r.get('force') is not True for r in remote.requests());receipt['backup']={'sha256':archive_hash,'bytes':bf['bytes'],'freshMappings':2,'enabledModules':7};receipt['checks'].append('same-profile/full-production-Backup/all-entry-disk-hashes/real-File-Confirm/complete-restore/fresh-containers/validated-distinct-logins-routes/seven-enabled/Pause/unrelated-preserved');receipt['result']='PASS'
  except Exception as error:
   receipt['error']=str(error);receipt['aiRecords']=provider.ai_records;receipt['serverHashes']={p:hashlib.sha256(b).hexdigest() for p,b in stored(provider).items()}
   if sid:
    try:top(sid);dashboard(sid);receipt['page']=script(sid,'return document.body.innerText');receipt['deployment']=deployment(sid);receipt['restore']=restore(sid)
    except Exception:pass
   print(json.dumps(receipt),flush=True);raise
  finally:
   provider.release_ack.set();receipt['writes']=provider.writes;receipt['saves']=provider.save_requests;receipt['gitOperations']=remote.snapshot()['operations'];receipt['unexpected']=provider.unexpected
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();remote.close();provider.close();(OUT/'installed-integrated.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
