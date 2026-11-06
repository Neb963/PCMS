"""R06: independent installed pixel capture; functional receipts remain separate."""
from installed_ui_continuity import *
from visual_capture import matrix,capture,viewport,state_matrix
from installed_accounts import page as account_page
from installed_directory import Provider as DirectoryProvider,FRAME,ORDER,check as check_directory,measured
from installed_refresh_clock import settings_clock,state as refresh_state,page as refresh_page
import threading
account_fixture.Provider=DirectoryProvider

class VisualFixture(Fixture):
 def __init__(self,*args,**kwargs):
  self.pause_prepare=True;self.prepare_entered=threading.Event();self.prepare_release=threading.Event()
  super().__init__(*args,**kwargs)
 def native(self,message):
  with self.lock:pause=message.get('command')=='prepare_exit' and self.pause_prepare;self.pause_prepare=False if pause else self.pause_prepare
  if pause:
   self.prepare_entered.set()
   if not self.prepare_release.wait(20):return {'ok':False,'error':'FIXTURE_VISUAL_PREPARE_BARRIER_EXPIRED'}
  return super().native(message)

def real_sleep(sid,provider,owner,expected,receipt):
 settings_clock(sid,1/120,1/20)
 asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),a=await c.read('accounts',arguments[0]);await c.mutate([{table:'generators',id:arguments[1],value:{slug:arguments[1],remoteId:'public_source-stable-18',accountId:a.id,ownerPrincipal:a.expectedPrincipal,creatorState:'OWNED',listing:'PUBLIC',state:'OWNED'}}],{step:'FIXTURE_PREVIOUS_OWNED',result:'COMPLETE'});c.close();return true;",[owner,SLUG])
 click(sid,'nav a[href="#generators"]');wait(lambda:script(sid,"return !!document.getElementById('catalog-search')"));set_input(sid,'#catalog-search',SLUG);wait(lambda:script(sid,"return !!document.querySelector('#generator-list a[href=\"#generators/'+arguments[0]+'\"]')",[SLUG]));click(sid,'#generator-list a[href="#generators/'+SLUG+'"]');wait(lambda:script(sid,"const b=document.getElementById('source-open');return b&&!b.disabled;"));click(sid,'#source-open');editor(sid);dashboard(sid);click(sid,'nav a[href="#generators"]');wait(lambda:script(sid,"return !!document.querySelector('#generator-list a[href=\"#generators/'+arguments[0]+'\"]')",[SLUG]));click(sid,'#generator-list a[href="#generators/'+SLUG+'"]');wait(lambda:script(sid,"const b=document.getElementById('source-inspect');return b&&!b.disabled;"));click(sid,'#source-inspect');source=wait(lambda:completed_source(sid),90);assert source['generator']['sourceState']=='VERIFIED' and source['generator']['listing']=='PUBLIC';assert {p:base64.b64decode(v) for p,v in source['bytes'].items()}==expected
 asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),g=await c.read('generators',arguments[0]);await c.mutate([{table:'generators',id:g.id,expectedRev:g.rev,refs:g.refs,value:{...g,poolMember:true,pool:{schema:1,member:true,sourceManifest:g.sourceManifest,addedAt:Date.now()},refreshCycle:{schema:1,cycleId:crypto.randomUUID(),phase:'PENDING',activeUsedMs:0}}}],{step:'FIXTURE_QUALIFIED_P22_POOL',result:'COMPLETE'});c.close();return true;",[SLUG])
 check_directory(sid);wait(lambda:measured(sid),100)
 def sleeping():
  return next((r for r in refresh_state(sid)['rows'] if r['id']==SLUG and r['cycle']['phase']=='SLEEP'),None)
 started=time.monotonic();row=wait(sleeping,90);cycle=row['cycle'];assert cycle['activeUsedMs']==cycle['activeDurationMs']==30000 and cycle['sleepDurationMs']==180000 and cycle['sleepUntil']>cycle['sleptAt'];assert stored(provider)==expected and provider.save_requests==[]
 refresh_page(sid);wait(lambda:script(sid,"return document.getElementById('refresher-counts')?.textContent.includes('1 Sleep')"));state_matrix(sid,'refresher-real-sleep',receipt);assert stored(provider)==expected and provider.save_requests==[];receipt['sleep']={'cycleId':cycle['cycleId'],'activeUsedMs':cycle['activeUsedMs'],'sleepDurationMs':cycle['sleepDurationMs'],'waitSeconds':time.monotonic()-started,'sourceManifest':source['generator']['sourceManifest']};receipt['checks'].append('actual-protected-source-readback/qualified-P22-pool/real-Settings/directory/30s-adjacent-eligible-Active/actual-Sleep/no-clock-edit/no-provider-save/full-byte-preservation')

def final_catalog_page(sid,owner,receipt):
 count=1005
 assert asyncjs(sid,"""const {openCore}=await import(browser.runtime.getURL('core/records.mjs'));
  const c=await openCore();try{const [n,accountId]=arguments;
  await c.mutate(Array.from({length:n},(_,i)=>{const id='paging-example-'+String(i).padStart(4,'0');
   return {table:'generators',id,value:{slug:id,folder:'generators/'+id,folderPresent:'YES',
    allocationAccountId:accountId,creatorState:'RESERVED',state:'FOLDER_ONLY'}};}),{step:'VISUAL_FIXTURE_PAGING',result:'COMPLETE'});
  return true;}finally{c.close();}""",[count,owner])
 click(sid,'nav a[href="#generators"]')
 wait(lambda:script(sid,"return !!document.getElementById('catalog-search')"))
 set_input(sid,'#catalog-search','paging-example-')
 def page():
  return script(sid,"""const l=document.getElementById('generator-list'),b=document.getElementById('catalog-next');
   return l?.getAttribute('aria-busy')==='false'&&b&&!b.disabled?
    {ids:[...l.querySelectorAll('input.row-select')].map(e=>e.dataset.generator),next:!b.hidden}:null;""")
 expected=['paging-example-'+str(i).zfill(4) for i in range(count)]
 seen=[];pages=0
 for start in range(0,count,50):
  ids=expected[start:start+50]
  result=wait(lambda:(lambda p:p if p and p['ids'] and p['ids'][0]==ids[0] else None)(page()),30)
  assert result=={'ids':ids,'next':start+50<count},result
  seen.extend(result['ids']);pages+=1
  if start==0:click(sid,'#generator-list input.row-select')
  if result['next']:click(sid,'#catalog-next')
 assert seen==expected and pages==21
 click(sid,'#generator-list input[data-generator="paging-example-1004"]')
 click(sid,'nav a[href="#work"]')
 wait(lambda:script(sid,"return document.getElementById('records').dataset.routeReady==='work'"))
 click(sid,'nav a[href="#generators"]')
 def final():
  return page()=={'ids':expected[-5:],'next':False} and script(sid,"""return document.getElementById('catalog-selection-count').textContent==='2 selected'
    &&document.querySelector('input[data-generator="paging-example-1004"]')?.checked
    &&document.getElementById('catalog-search').value==='paging-example-';""")
 state_matrix(sid,'generators-final-page',receipt,prepare=lambda:wait(final,30))
 receipt['catalogPaging']={'records':count,'pages':pages,'first':seen[0],'last':seen[-1],
                           'finalPage':seen[-5:],'selected':['paging-example-0000','paging-example-1004']}
 receipt['checks'].append('1,005 persisted records through 21 visible pages with no gaps or duplicates, cross-page selection and navigation continuity')

def main():
 binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve();identity=json.loads((xpi.parent/'identity.json').read_text());assert not identity['dirty'];assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
 receipt={'tier':'B/pixel-capture-NOT-vision-verdict','visualSuite':'visual-only','source':identity['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]};assert receipt['xpiSha256']==identity['xpiSha256']
 with tempfile.TemporaryDirectory(prefix='pcms-visual-') as tmp:
  root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();home=root/'home';home.mkdir();provider=VisualFixture(root,extra_hosts=['user.uploads.dev',FRAME]);expected=configure(provider);expected['main.pjs']=b'output\r\n  Hello [animal]\r\nanimal\r\n  cat\r\n  dog';provider.generator['modelText']=expected['main.pjs'].decode();provider.generator['isPrivate']=False;provider.directory_mode='complete';provider.directory_reads=[];provider.directory_advances=[];provider.marker_order=(['pinned-other','pinned-second',SLUG]+[s for s in ORDER if s not in ['pinned-other',SLUG]])[:-1];provider.start_catalog();provider.install_bridge(home,root)
  env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'};log=open(OUT/'visual-driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None
  try:
   supplement=os.environ.get('PCMS_VISUAL_SUPPLEMENT')=='1'
   wait(driver_ready,15);sid,caps=account_session(binary,profile);receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'));assert int(caps['browserVersion'].split('.')[0])>=155 and caps['acceptInsecureCerts'] is False
   context(sid,'chrome');script(sid,"Components.classes['@mozilla.org/security/x509certdb;1'].getService(Components.interfaces.nsIX509CertDB).addCertFromBase64(arguments[0],'C,,');return true;",[base64.b64encode(provider.ca).decode()]);prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];receipt['sandbox']=prefs;context(sid,'content');assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID;toolbar(sid);dashboard(sid)
   wait(lambda:script(sid,"return document.getElementById('queue-status').textContent==='Running'"));state_matrix(sid,'home-permission-needed',receipt)
   click(sid,'#pause-core');wait(lambda:script(sid,"return document.getElementById('queue-status').textContent==='Paused'"));state_matrix(sid,'home-permission-needed-paused',receipt);click(sid,'#pause-core');wait(lambda:script(sid,"return document.getElementById('queue-status').textContent==='Running'"))
   for width in [1280,560,390]:
    viewport(sid,width);click(sid,'nav a[href="#generators"]');wait(lambda:script(sid,"return !!document.getElementById('catalog-search')"));capture(sid,'generators-empty',receipt)
   settings(sid);wait(lambda:script(sid,"return !!document.getElementById('allow-userscripts')"));click(sid,'#allow-userscripts');permission_choice(sid,True);wait(lambda:script(sid,"return !document.getElementById('allow-userscripts')"))
   click(sid,'nav a[href="#home"]');wait(lambda:script(sid,"return document.body.dataset.startup==='HOST_ONLY'&&document.querySelector('.status').hidden;"));state_matrix(sid,'home-healthy-idle',receipt)
   click(sid,'#pause-core');wait(lambda:script(sid,"return document.getElementById('queue-status').textContent==='Paused'"));state_matrix(sid,'home-healthy-paused',receipt);click(sid,'#pause-core');wait(lambda:script(sid,"return document.getElementById('queue-status').textContent==='Running'"))
   owner=add(sid,'Continuity owner');assert provider.prepare_entered.wait(15),'FIXTURE_PREPARE_NOT_OBSERVED'
   try:
    wait(lambda:script(sid,"return document.getElementById('account-state')?.textContent.startsWith('Preparing')"));state_matrix(sid,'account-real-preparing',receipt)
   finally:provider.prepare_release.set()
   settle(sid,owner,'LOGIN_REQUIRED');login(sid,owner,'visual@fixture.test');state_matrix(sid,'account-awaiting-confirm',receipt);click(sid,'#account-confirm');settle(sid,owner,'READY')
   if not supplement:matrix(sid,receipt,click,set_input,owner)
   viewport(sid,1280)
   real_sleep(sid,provider,owner,expected,receipt)
   if supplement:
    click(sid,'nav a[href="#home"]')
    def measured_home():
     return script(sid,r"const s=document.getElementById('home-directory')?.textContent;return /^Directory measured · Top 50: \d+ · Top 100: \d+ · Full list: \d+ · \d+ displayed$/.test(s);")
    state_matrix(sid,'home-directory-measured',receipt,prepare=lambda:wait(measured_home,30))
    receipt['checks'].append('Home real directory observation: separate Top 50, Top 100 and full-list counts at all widths')
    final_catalog_page(sid,owner,receipt)
   account_page(sid,owner);click(sid,'#account-archive');settle(sid,owner,'ARCHIVED')
   def archived():
    return script(sid,"const s=document.getElementById('account-state'),b=document.getElementById('account-reactivate'),row=document.querySelector('#account-list a[href=\"#accounts/'+arguments[0]+'\"]');return s?.textContent==='Archived'&&b&&!b.hidden&&!b.disabled&&!document.getElementById('account-open')?.getClientRects().length&&row?.textContent.includes(' · Archived · ')&&!row.textContent.includes(' · Ready · ');",[owner])
   state_matrix(sid,'account-archived',receipt,prepare=lambda:wait(archived,30))
   receipt['checks'].append('settled archived projection and enabled Reactivate at each viewport')
   receipt['result']='CAPTURED — VISION REVIEW REQUIRED'
  except Exception as error:
   receipt['error']=str(error)
   if sid:
    try:receipt['page']=script(sid,'return document.body.innerText')
    except Exception:pass
   raise
  finally:
   provider.prepare_release.set()
   if sid:
    try:stop(sid,profile)
    except Exception:pass
   proc.terminate();proc.wait(timeout=10);log.close();provider.close();(OUT/'installed-visual.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
