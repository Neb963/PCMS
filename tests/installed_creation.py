"""P17 B: production folder -> private create -> rename, both receipt losses.
Independent native-protocol/provider/bare-Git fixtures; no external forwarding.
"""
from installed_creator import session15,inspect_creator,target,detail
from installed_accounts import add,settle,login,page as account_page
from installed_lifecycle import permission_choice
from installed_journal import set_input
from installed_git_catalog import connections
from installed_packages import *
from installed_discover import AVAILABLE,RESERVED
from account_fixture import Fixture
import account_fixture
from git_write_https_fixture import GitWriteFixture,git,put_blob,put_tree,put_commit,tree,commit,head
from git_https_fixture import TOKEN,declaration

class Provider(account_fixture.Provider):
 def do_GET(self):
  f=self.server.fixture;host=self.headers.get('Host','').split(':')[0];name=self.path.lstrip('/')
  if host=='perchance.org' and name in ['lost-create-name','lost-rename-name','ambiguous-name','reserved-name'] or host=='perchance.org' and name.startswith('temporary-created-'):
   with f.lock:f.slug_reads.append({'slug':name,'routeId':self.route});exists=name in f.model
   html='<div id="outputEl">Independent saved generator output</div>' if exists else RESERVED if name=='reserved-name' else AVAILABLE
   return self.send(('<!doctype html><meta charset="utf-8"><title>Disposable creation fixture</title>'+html).encode(),'text/html; charset=utf-8')
  return super().do_GET()
 def do_POST(self):
  if self.path not in ['/api/getGeneratorsByUser','/api/checkGeneratorOwnership','/api/getGeneratorPageData','/api/save','/api/changeGeneratorName']:return super().do_POST()
  f=self.server.fixture;b=self.body();endpoint=self.path.rsplit('/',1)[-1]
  with f.lock:
   user=f.logins.get(self.route);valid=user and b.get('email')==user['email'] and b.get('sessionToken')==user['sessionToken']
   if endpoint!='getGeneratorPageData' and not valid:f.unexpected.append('WRONG_CREATION_PRINCIPAL');return self.send({'status':'session-token-error'})
   if endpoint=='getGeneratorsByUser':
    f.reads.append({'routeId':self.route,'valid':bool(valid)});names=[n for n in f.owned if not (f.hide=='CREATE' and n.startswith('temporary-created-')) and not(f.hide=='RENAME' and n==f.active_slug)];return self.send({'status':'success','generators':[{'name':n,'isPrivate':f.model[n]['isPrivate']} for n in names],'generatorFolderMap':{}})
   if endpoint=='checkGeneratorOwnership':return self.send({'status':'is-owner' if b.get('generatorName') in f.owned else 'is-not-owner'})
   if endpoint=='getGeneratorPageData':
    name=b.get('generatorName')
    if f.hide=='RENAME' and name==f.active_slug:return self.send({'status':'server-error'})
    return self.send({'status':'success','generator':f.model[name]} if name in f.model else {'status':'generator-does-not-exist'})
   if endpoint=='save':
    g=b.get('generator');assert set(g)=={'name','isPrivate','modelText','outputTemplate'};assert b.get('srcManifest')==[] and g['name']=='minimal' and g['isPrivate'] is True and g['modelText']=='' and g['outputTemplate']=='';f.created+=1;name='temporary-created-'+str(f.created);value={**g,'name':name,'publicId':'created-stable-'+str(f.created),'srcManifest':[]};f.model[name]=value;f.owned.add(name);f.writes.append({'kind':'CREATE','name':name,'remoteId':value['publicId'],'target':f.active_slug,'routeId':self.route});response={'status':'created','name':name};kind='CREATE'
    if f.ambiguous:
     other='temporary-created-unrelated';f.model[other]={**value,'name':other,'publicId':'unrelated-concurrent-id'};f.owned.add(other)
   else:
    old=b.get('currentName');new=b.get('newName');assert old in f.owned and old.startswith('temporary-created-') and new==f.active_slug
    if new in f.model:return self.send({'status':'name-taken'})
    value=f.model.pop(old);f.owned.remove(old);f.model[new]={**value,'name':new};f.owned.add(new);f.writes.append({'kind':'RENAME','old':old,'name':new,'remoteId':value['publicId'],'routeId':self.route});response={'status':'success'};kind='RENAME'
   if f.loss==kind:
    f.loss=None;f.hide=None if f.ambiguous else kind;self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length','512');self.send_header('Connection','close');self.end_headers();self.wfile.write(b'{');self.wfile.flush();self.close_connection=True;return
   return self.send(response)
account_fixture.Provider=Provider

def add_folder(remote,slug):
 old=head(remote.root);c=commit(remote.root,old);entries=tree(remote.root,c['tree']['sha']);gens=next(e for e in entries if e['path']=='generators');folders=tree(remote.root,gens['sha']);folder=put_tree(remote.root,[{'path':'DEPLOYMENT.md','mode':'100644','type':'blob','sha':put_blob(remote.root,declaration().encode())},{'path':'main.pjs','mode':'100644','type':'blob','sha':put_blob(remote.root,('Git source sentinel '+slug).encode())}]);folders.append({'path':slug,'mode':'040000','type':'tree','sha':folder});gens['sha']=put_tree(remote.root,folders);actor={'name':'Independent fixture','email':'fixture@example.test','date':'2023-11-14T22:15:00.000Z'};tip=put_commit(remote.root,{'tree':put_tree(remote.root,entries),'parents':[old],'author':actor,'committer':actor,'message':'Independent folder '+slug+'\n'});git(remote.root,'update-ref','refs/heads/main',tip,old)
def check_main(sid):
 click(sid,'nav a[href="#generators"]');wait(lambda:script(sid,"return !!document.getElementById('catalog-check')"));click(sid,'#catalog-check')
def unknown(sid,slug,kind):
 s=inspect_creator(sid);g=next((g for g in s['rows'] if g['slug']==slug),None)
 return next((j for j in s['jobs'] if g and j['id']==g['creatorJobId'] and j['state']=='HELD' and j.get('effect',{}).get('boundary')=='POSSIBLE' and j['effect']['kind']==kind),None)
def restart_recover(sid,profile,binary,owner,provider,slug):
 prior=stop(sid,profile);sid,_=session15(binary,profile);assert not prior.intersection(pids(profile));toolbar(sid);dashboard(sid);account_page(sid,owner);click(sid,'#account-open');settle(sid,owner,'READY');dashboard(sid)
 with provider.lock:provider.hide=None
 detail(sid,slug);click(sid,'#creator-check');wait(lambda:target(sid,slug).get('creatorState')=='CREATED',60);wait(lambda:'Created' in script(sid,"return document.getElementById('creator-state').textContent"),15);return sid

def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve();identity=json.loads((xpi.parent/'identity.json').read_text());assert not identity['dirty'];assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
 receipt={'tier':'B/installed-Creator/independent-protected-provider-and-bare-Git','source':identity['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]};assert receipt['xpiSha256']==identity['xpiSha256']
 with tempfile.TemporaryDirectory(prefix='pcms-create-') as tmp:
  root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();home=root/'home';home.mkdir();provider=Fixture(root);provider.model={'minimal':{'name':'minimal','publicId':'native-template','isPrivate':False,'modelText':'native template','outputTemplate':'<p>Template</p>','srcManifest':{}},'existing-sentinel':{'name':'existing-sentinel','publicId':'existing-stable','isPrivate':True,'modelText':'Existing source stays byte exact\n','outputTemplate':'<p>Keep existing HTML</p>','srcManifest':{'src/unicode-雪.bin':'binary-sentinel'}}};provider.owned={'existing-sentinel'};existing=json.loads(json.dumps(provider.model['existing-sentinel']));provider.active_slug='lost-create-name';provider.loss='CREATE';provider.hide=None;provider.created=0;provider.writes=[];provider.slug_reads=[];provider.ambiguous=False;provider.install_bridge(home,root);remote=GitWriteFixture(root);add_folder(remote,provider.active_slug);remote.controls(race=None,lose_applied_ref=False,hide_applied_commits=False)
  (root/'fixture-socks-catalog.json').write_text(json.dumps([{'online':True,'hostname':'fixture-'+str(i),'ipv4_address':'10.124.0.'+str(i),'port':1080,'location':{'country':'Fixture','city':'Local'}} for i in range(1,9)]));remote.start();env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'};log=open(OUT/'driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None
  try:
   wait(driver_ready,15);sid,caps=session15(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'));assert int(caps['browserVersion'].split('.')[0])>=155 and caps['acceptInsecureCerts'] is False;context(sid,'chrome')
   for ca in [provider.ca,remote.ca]:script(sid,"Components.classes['@mozilla.org/security/x509certdb;1'].getService(Components.interfaces.nsIX509CertDB).addCertFromBase64(arguments[0],'C,,');return true;",[base64.b64encode(ca).decode()])
   prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];receipt['sandbox']=prefs;context(sid,'content');assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid);settings(sid);wait(lambda:script(sid,"return !!document.getElementById('allow-userscripts')"));click(sid,'#allow-userscripts');permission_choice(sid,True);wait(lambda:script(sid,"return !document.getElementById('allow-userscripts')"))
   owner=add(sid,'Creator fixture owner');settle(sid,owner,'LOGIN_REQUIRED');login(sid,owner,'creator@fixture.test');click(sid,'#account-confirm');settle(sid,owner,'READY');connections(sid);set_input(sid,'#git-repository','fixture/catalog');set_input(sid,'#git-token',TOKEN);click(sid,'#git-save');wait(lambda:'Connection saved' in script(sid,"return document.getElementById('git-result').textContent"));j=wait(lambda:unknown(sid,'lost-create-name','PERCHANCE_CREATE'),90);first_job=j['id'];first_operation=j['effect']['operationId'];assert len(provider.writes)==1;detail(sid,'lost-create-name');assert script(sid,"return document.getElementById('creator-override').hidden");sid=restart_recover(sid,profile,binary,owner,provider,'lost-create-name');g=target(sid,'lost-create-name');assert g['creatorJobId']==first_job and g['remoteId']=='public_created-stable-1' and g['listing']=='UNLISTED' and g['allocation'] is None;assert len(provider.writes)==2;assert len([e for e in next(j for j in inspect_creator(sid)['jobs'] if j['id']==first_job)['effects'] if e['operationId']==first_operation])==1
   receipt['checks'].append('actual-folder/Available/private-template/empty-top-level-manifest/create-body-loss/real-Firefox-restart/actual-account-Open-and-recorded-check/same-operation/one-create-one-rename/exact-stable-ID/unlisted/source-preserved')
   with provider.lock:provider.active_slug='lost-rename-name';provider.loss='RENAME'
   add_folder(remote,'lost-rename-name');check_main(sid);j=wait(lambda:unknown(sid,'lost-rename-name','PERCHANCE_RENAME'),90);second_job=j['id'];second_operation=j['effect']['operationId'];assert len(provider.writes)==4;sid=restart_recover(sid,profile,binary,owner,provider,'lost-rename-name');g=target(sid,'lost-rename-name');assert g['creatorJobId']==second_job and g['remoteId']=='public_created-stable-2' and g['listing']=='UNLISTED';assert len(provider.writes)==4;assert len([e for e in next(j for j in inspect_creator(sid)['jobs'] if j['id']==second_job)['effects'] if e['operationId']==second_operation])==1
   receipt['checks'].append('second-folder/rename-body-loss/real-process-restart/read-both-names/same-stable-ID/one-rename/no-create-or-rename-replay')
   with provider.lock:provider.active_slug='ambiguous-name';provider.loss='CREATE';provider.ambiguous=True
   add_folder(remote,'ambiguous-name');check_main(sid);j=wait(lambda:unknown(sid,'ambiguous-name','PERCHANCE_CREATE'),90);assert len(provider.writes)==5;detail(sid,'ambiguous-name');wait(lambda:script(sid,"return document.querySelectorAll('#creator-inspections button').length>=3"));count=len(provider.writes);click(sid,'#creator-inspections button[data-slug="temporary-created-3"]');dashboard(sid);detail(sid,'ambiguous-name');click(sid,'#creator-check');time.sleep(1);assert unknown(sid,'ambiguous-name','PERCHANCE_CREATE') and len(provider.writes)==count;assert target(sid,'ambiguous-name')['allocation'] and not target(sid,'ambiguous-name').get('remoteId')
   add_folder(remote,'reserved-name');check_main(sid);wait(lambda:target(sid,'reserved-name') and target(sid,'reserved-name').get('creatorHoldCode')=='CREATOR_SLUG_TAKEN',60);assert len(provider.writes)==5;assert provider.created==3;assert provider.model['existing-sentinel']==existing;assert provider.unexpected==[];assert all(r['method']=='GET' for r in remote.requests());assert all(w['routeId']==provider.writes[0]['routeId'] for w in provider.writes);assert provider.model['lost-create-name']['modelText']==provider.model['lost-rename-name']['modelText']=='';assert provider.model['lost-create-name']['srcManifest']==provider.model['lost-rename-name']['srcManifest']==[]
   receipt['checks'].append('ambiguous-inventory/actual-protected-inspection-and-check/retained-reservation/no-replay/independent-Reserved-target-continues-queue/no-write/no-existing-source-or-Git-change');receipt['writes']=provider.writes;receipt['slugReads']=provider.slug_reads;receipt['result']='PASS'
  except Exception as error:
   receipt['error']=str(error);receipt['writes']=provider.writes;receipt['slugReads']=provider.slug_reads;receipt['unexpected']=provider.unexpected
   if sid:
    try:dashboard(sid);receipt['page']=script(sid,"return document.body.innerText");receipt['state']=inspect_creator(sid)
    except Exception:pass
   print(json.dumps(receipt),flush=True);raise
  finally:
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();remote.close();provider.close();(OUT/'installed-creation.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
