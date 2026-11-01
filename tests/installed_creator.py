"""P16 B: actual folder intake, protected ownership adoption and account UI.
Native/SOCKS/provider and bare-Git fixtures stay disposable and local.
"""
from installed_discover_preparation import session15
from installed_packages import *
from installed_accounts import add,settle,login
from installed_lifecycle import permission_choice
from installed_journal import set_input,close_dashboard
from installed_git_catalog import connections,generators
from account_fixture import Fixture
import account_fixture
from git_write_https_fixture import GitWriteFixture,git,put_blob,put_tree,put_commit,tree,commit,head
from git_https_fixture import TOKEN,declaration

class Provider(account_fixture.Provider):
 def do_POST(self):
  if self.path not in ['/api/checkGeneratorOwnership','/api/getGeneratorPageData','/api/getGeneratorsByUser']:return super().do_POST()
  f=self.server.fixture;body=self.body();slug=body.get('generatorName')
  with f.lock:
   user=f.logins.get(self.route);valid=user and body.get('email')==user['email'] and body.get('sessionToken')==user['sessionToken']
   if self.path=='/api/getGeneratorsByUser':
    f.reads.append({'routeId':self.route,'valid':bool(valid)});names=['remote-sentinel']+(['existing-sentinel'] if valid and user['email']=='second@fixture.test' else []);return self.send({'status':'success','generators':[{'name':n,'isPrivate':True} for n in names],'generatorFolderMap':{}} if valid else {'status':'session-token-error'})
   f.ownership_reads.append({'path':self.path,'slug':slug,'routeId':self.route,'valid':bool(valid)})
   if self.path=='/api/checkGeneratorOwnership':
    if not valid:return self.send({'status':'session-token-error'})
    if slug=='pending-unknown' and user['email']=='first@fixture.test':return self.send({'status':'incomplete-inventory'})
    return self.send({'status':'is-owner' if slug=='existing-sentinel' and user['email']=='second@fixture.test' else 'is-not-owner'})
   if slug=='existing-sentinel':return self.send({'status':'success','generator':{'name':slug,'publicId':'owned-stable-17','isPrivate':True}})
   return self.send({'status':'generator-does-not-exist'})
account_fixture.Provider=Provider

def inspect_creator(sid):
 return asyncjs(sid,"""const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore();let cursor=null,rows=[],jobs=[];do{const p=await c.list({table:'generators',cursor});for(const r of p.rows)rows.push(await c.read('generators',r.id));cursor=p.cursor;}while(cursor);for(const g of rows)if(g.creatorJobId)jobs.push(await c.read('jobs',g.creatorJobId));const status=await c.queue.status();c.close();return {rows,jobs,status};""")
def target(sid,slug):return next((g for g in inspect_creator(sid)['rows'] if g['slug']==slug),None)
def detail(sid,slug):
 generators(sid);set_input(sid,'#catalog-search',slug);wait(lambda:script(sid,"const rows=[...document.querySelectorAll('#generator-list a')];return rows.length===1&&rows[0].textContent.startsWith(arguments[0]+' ·')",[slug]));click(sid,'#generator-list a');wait(lambda:script(sid,"return document.querySelector('#records h2')?.textContent===arguments[0]&&!!document.getElementById('creator-state')?.textContent",[slug]))
def add_pending(remote):
 old=head(remote.root);c=commit(remote.root,old);entries=tree(remote.root,c['tree']['sha']);gens=next(e for e in entries if e['path']=='generators');folders=tree(remote.root,gens['sha'])
 for slug in ['pending-one','pending-unknown']:
  folder=put_tree(remote.root,[{'path':'DEPLOYMENT.md','mode':'100644','type':'blob','sha':put_blob(remote.root,declaration().encode())},{'path':'main.pjs','mode':'100644','type':'blob','sha':put_blob(remote.root,('source sentinel '+slug).encode())}]);folders.append({'path':slug,'mode':'040000','type':'tree','sha':folder})
 gens['sha']=put_tree(remote.root,folders);actor={'name':'Independent fixture','email':'fixture@example.test','date':'2023-11-14T22:14:00.000Z'};tip=put_commit(remote.root,{'tree':put_tree(remote.root,entries),'parents':[old],'author':actor,'committer':actor,'message':'Independent pending folders\n'});git(remote.root,'update-ref','refs/heads/main',tip,old)

def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve();identity=json.loads((xpi.parent/'identity.json').read_text());assert not identity['dirty'];assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
 receipt={'tier':'B/installed-Creator/protected-ownership/independent-provider-and-bare-Git','source':identity['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]};assert receipt['xpiSha256']==identity['xpiSha256']
 with tempfile.TemporaryDirectory(prefix='pcms-creator-') as tmp:
  root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();home=root/'home';home.mkdir();provider=Fixture(root);provider.ownership_reads=[];provider.inventory['existing-sentinel']={'publicId':'owned-stable-17','isPrivate':True,'files':{'main.pjs':'external owner source\n','index.html':'<p>Do not change</p>','src/binary.bin':'AAH/'}};provider_before=json.loads(json.dumps(provider.inventory));provider.install_bridge(home,root);remote=GitWriteFixture(root);add_pending(remote);baseline=remote.snapshot();remote.controls(race=None,lose_applied_ref=False,hide_applied_commits=False)
  (root/'fixture-socks-catalog.json').write_text(json.dumps([{'online':True,'hostname':'fixture-'+str(i),'ipv4_address':'10.124.0.'+str(i),'port':1080,'location':{'country':'Fixture','city':'Local'}} for i in range(1,9)]));remote.start()
  env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'};log=open(OUT/'driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None
  try:
   wait(driver_ready,15);sid,caps=session15(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'));assert int(caps['browserVersion'].split('.')[0])>=155 and caps['acceptInsecureCerts'] is False
   context(sid,'chrome')
   for ca in [provider.ca,remote.ca]:script(sid,"Components.classes['@mozilla.org/security/x509certdb;1'].getService(Components.interfaces.nsIX509CertDB).addCertFromBase64(arguments[0],'C,,');return true;",[base64.b64encode(ca).decode()])
   prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];receipt['sandbox']=prefs;context(sid,'content')
   assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid);settings(sid);wait(lambda:script(sid,"return !!document.getElementById('allow-userscripts')"));click(sid,'#allow-userscripts');permission_choice(sid,True);wait(lambda:script(sid,"return !document.getElementById('allow-userscripts')"))
   first=add(sid,'First owner fixture');settle(sid,first,'LOGIN_REQUIRED');login(sid,first,'first@fixture.test');click(sid,'#account-confirm');settle(sid,first,'READY');second=add(sid,'Second owner fixture');settle(sid,second,'LOGIN_REQUIRED');login(sid,second,'second@fixture.test');click(sid,'#account-confirm');settle(sid,second,'READY')
   assert inspect_creator(sid)['rows']==[];connections(sid);set_input(sid,'#git-repository','fixture/catalog');set_input(sid,'#git-token',TOKEN);click(sid,'#git-save');wait(lambda:'Connection saved' in script(sid,"return document.getElementById('git-result').textContent"));close_dashboard(sid)
   # Background intake/adoption completes without the dashboard; no direct Core writes.
   wait(lambda:len(provider.ownership_reads)>=7,60);toolbar(sid);dashboard(sid);s=wait(lambda:next((v for v in [inspect_creator(sid)] if len(v['rows'])==3 and all(g.get('creatorState') in ['OWNED','RESERVED'] for g in v['rows'])),None),60);owned=next(g for g in s['rows'] if g['slug']=='existing-sentinel');assert owned['accountId']==second and owned['remoteId']=='public_owned-stable-17' and owned['listing']=='UNLISTED' and owned['markerStatus']=='NOT_READY';assert next(j for j in s['jobs'] if j['id']==owned['creatorJobId'])['state']=='COMPLETE';assert len([r for r in provider.ownership_reads if r['slug']=='existing-sentinel' and r['path']=='/api/checkGeneratorOwnership'])==3
   detail(sid,'existing-sentinel');assert 'owned-stable-17' in script(sid,"return document.getElementById('creator-facts').textContent");assert 'UNLISTED' in script(sid,"return document.getElementById('creator-facts').textContent");assert script(sid,"return document.getElementById('creator-override').hidden")
   click(sid,'#creator-detail a[href="#work/'+owned['creatorJobId']+'"]');wait(lambda:script(sid,"return !!document.getElementById('creator-work-generator')"));click(sid,'#creator-work-generator');wait(lambda:script(sid,"return document.getElementById('creator-facts')?.textContent.includes('owned-stable-17')"))
   receipt['checks'].append('actual-valid-NOT_READY-Git-intake/closed-dashboard/remote-managed-owner-absent-locally/fresh-confirmed-stable-ID/adoption/no-source-or-listing-change')
   detail(sid,'pending-unknown');wait(lambda:'Account reserved' in script(sid,"return document.getElementById('creator-state').textContent"));assert 'UNKNOWN' in script(sid,"return document.getElementById('creator-observations').textContent");pending=target(sid,'pending-unknown');jobid=pending['creatorJobId'];old=pending['allocation']['accountId'];selected=first if old==second else second
   click(sid,'#creator-account option[value="'+selected+'"]');click(sid,'nav a[href="#home"]');detail(sid,'pending-unknown');assert script(sid,"return document.getElementById('creator-account').value")==selected;click(sid,'#creator-override');wait(lambda:'saved' in script(sid,"return document.getElementById('creator-result').textContent").lower());pending=target(sid,'pending-unknown');assert pending['allocation']['accountId']==selected and pending['creatorJobId']==jobid;epoch=pending['allocation']['epoch'];assert not pending.get('remoteId')
   click(sid,'#pause-core');wait(lambda:inspect_creator(sid)['status']['paused']);reads=len(provider.ownership_reads);click(sid,'#creator-check');wait(lambda:'queued' in script(sid,"return document.getElementById('creator-result').textContent").lower());time.sleep(1);assert len(provider.ownership_reads)==reads
   prior=stop(sid,profile);sid=None;sid,_=session15(binary,profile);assert not prior.intersection(pids(profile));toolbar(sid);dashboard(sid);detail(sid,'pending-unknown');assert inspect_creator(sid)['status']['paused'];pending=target(sid,'pending-unknown');assert pending['creatorJobId']==jobid and pending['allocation']['accountId']==selected and pending['allocation']['epoch']==epoch;click(sid,'#pause-core');wait(lambda:target(sid,'pending-unknown').get('creatorState')=='RESERVED',45);pending=target(sid,'pending-unknown');assert pending['allocation']['epoch']==epoch and pending['creatorJobId']==jobid
   s=inspect_creator(sid);assert len(s['jobs'])==3 and len({j['id'] for j in s['jobs']})==3;assert len([g for g in s['rows'] if g.get('allocation')])==2;assert provider.inventory==provider_before and provider.receipt()['unexpected']==[];assert remote.snapshot()['head']==baseline['head'] and remote.snapshot()['files']==baseline['files'];assert all(r['method']=='GET' for r in remote.requests());assert all(r['valid'] for r in provider.ownership_reads if r['path']=='/api/checkGeneratorOwnership')
   receipt['checks'].append('Unknown-not-a-creation-veto/actual-account-dropdown/draft-navigation/atomic-override/Pause-recheck-no-dispatch/real-process-restart/same-job-reservation/no-duplicate-allocation/no-provider-or-Git-writes');receipt['ownershipReads']=provider.ownership_reads;receipt['generators']=[{k:g.get(k) for k in ['id','slug','creatorJobId','creatorState','remoteId','allocationAccountId']} for g in s['rows']];receipt['result']='PASS'
  except Exception as error:
   receipt['error']=str(error);receipt['ownershipReads']=provider.ownership_reads;receipt['unexpected']=provider.receipt()['unexpected']
   if sid:
    try:dashboard(sid);receipt['page']=script(sid,"return document.body.innerText");receipt['state']=inspect_creator(sid)
    except Exception:pass
   print(json.dumps(receipt),flush=True);raise
  finally:
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();remote.close();provider.close();(OUT/'installed-creator.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
