"""P02 B/S: built actions -> real IDB, cold restart and injected quota.
Uses P01's proven installer/toolbar helpers; no routes/provider operations.
"""
from installed_host import *

def click(sid,selector):
    element=call('POST',f'/session/{sid}/element',{'using':'css selector','value':selector})
    call('POST',f'/session/{sid}/element/'+element['element-6066-11e4-a52e-4f735466cecf']+'/click',{})

def asyncjs(sid,source,args=None):
    return script(sid,"const done=arguments[arguments.length-1];(async()=>{"+source+"})().then(done,e=>done({error:e.name+':'+e.message}));",args,True)

def main():
    binary=pathlib.Path(os.environ['FIREFOX_BINARY']);driver=pathlib.Path(os.environ['GECKODRIVER_BINARY']);xpi=pathlib.Path(sys.argv[1]).resolve()
    assert not any(v for k,v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
    receipt={'tier':'B/S','source':json.loads((xpi.parent/'identity.json').read_text())['source'],'xpiSha256':hashlib.sha256(xpi.read_bytes()).hexdigest(),'checks':[]}
    assert receipt['xpiSha256']==json.loads((xpi.parent/'identity.json').read_text())['xpiSha256']
    with tempfile.TemporaryDirectory(prefix='pcms-records-') as tmp:
        root=pathlib.Path(tmp);profile=root/'profile';profile.mkdir();home=root/'home';home.mkdir()
        env={**os.environ,'HOME':str(home),'XDG_CONFIG_HOME':str(home/'.config'),'XDG_DATA_HOME':str(home/'.local/share'),'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'}
        log=open(OUT/'driver.log','w');proc=subprocess.Popen([str(driver),'--port','44448','--allow-system-access'],env=env,stdout=log,stderr=subprocess.STDOUT);sid=None
        try:
            wait(driver_ready,15);sid,caps=session(binary,profile)
            receipt.update(browserVersion=caps['browserVersion'],buildId=caps.get('moz:buildID'))
            assert int(caps['browserVersion'].split('.')[0])>=155
            assert call('POST',f'/session/{sid}/moz/addon/install',{'path':str(xpi),'temporary':False})==ID
            toolbar(sid);dashboard(sid);status(sid,'BRIDGE_MISSING')
            context(sid,'chrome');prefs=script(sid,"return {sandbox:Services.prefs.getIntPref('security.sandbox.content.level'),remote:Services.appinfo.browserTabsRemoteAutostart}");assert prefs['sandbox']>=4 and prefs['remote'];receipt['sandbox']=prefs;context(sid,'content')
            wait(lambda:script(sid,"return !!document.querySelector('[data-count=accounts]')"))
            # Fixture setup invokes the packaged private data service, not a
            # shipped test route or alternate storage implementation. UI is
            # subsequently observed against independent raw IDB records.
            seeded=asyncjs(sid,"""
              const {openCore}=await import(browser.runtime.getURL('core/records.mjs'));const c=await openCore();
              const source=await c.source([{path:'main.pjs',bytes:new TextEncoder().encode('fixture\\r\\n')},{path:'index.html',bytes:new Uint8Array([60,112,62,255])},{path:'src/zażółć.bin',bytes:new Uint8Array([0,255,128,1])}]);
              await c.mutate(Array.from({length:50},(_,i)=>({table:'accounts',id:'account-'+i,value:{label:'Fixture '+i,state:'READY'}})),{step:'FIXTURE_SETUP',result:'COMPLETE'});
              await c.mutate(Array.from({length:1000},(_,i)=>({table:'generators',id:'generator-'+String(i).padStart(4,'0'),value:{slug:'fixture-'+i,sourceManifest:source.manifestId},refs:source.refs})),{step:'FIXTURE_SETUP',result:'COMPLETE'});
              await c.releasePin(source.pinId);
              await c.credentials.set('github','fixture-secret-sentinel');
              c.close();return {manifest:source.manifestId};
            """);assert 'manifest' in seeded,seeded
            click(sid,'nav a[href="#accounts"]');click(sid,'nav a[href="#home"]')
            wait(lambda:script(sid,"return document.querySelector('[data-count=generators]')?.textContent")=='1000 Generators')
            assert script(sid,"return document.querySelector('[data-count=accounts]').textContent")=='50 Accounts'
            click(sid,'nav a[href="#settings"]');wait(lambda:script(sid,"return !!document.getElementById('journal-filter')"))
            element=call('POST',f'/session/{sid}/element',{'using':'css selector','value':'#journal-filter'})
            call('POST',f'/session/{sid}/element/'+element['element-6066-11e4-a52e-4f735466cecf']+'/value',{'text':'SAVE_VIEW'})
            click(sid,'#save-view');wait(lambda:script(sid,"return document.getElementById('view-result').textContent")=='Saved')
            assert 'fixture-secret-sentinel' not in script(sid,"return document.body.textContent")
            independent=asyncjs(sid,"""
              const db=await new Promise((r,j)=>{const q=indexedDB.open('pcms-core');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});
              const get=(s,k)=>new Promise((r,j)=>{const q=db.transaction(s).objectStore(s).get(k);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});
              const root=await get('meta','root'),view=await get('views',[root.dataset,'shell-view']);db.close();
              return {filter:view.value.journalFilter,sequence:view.sequence};
            """);assert independent['filter']=='SAVE_VIEW',independent
            receipt['checks'].append('visible-Home-counts/50-accounts/1000-generators/Save-view/independent-IDB/no-secret')
            # A real closed dashboard followed by actual process termination.
            call('POST',f'/session/{sid}/window/new',{'type':'tab'});dashboard(sid);call('DELETE',f'/session/{sid}/window')
            prior=stop(sid,profile);sid=None
            sid,_=session(binary,profile);assert not prior.intersection(pids(profile));toolbar(sid);dashboard(sid);status(sid,'BRIDGE_MISSING')
            wait(lambda:script(sid,"return document.getElementById('journal-filter')?.value")=='SAVE_VIEW')
            cold=asyncjs(sid,"""
              const {openCore}=await import(browser.runtime.getURL('core/records.mjs'));const c=await openCore();
              const manifest=await c.verifySource(arguments[0]);const bin=await c.bytes(manifest.find(x=>x.path.endsWith('.bin')).blobId);
              let cursor=null,ids=[];do{const p=await c.list({table:'generators',cursor,limit:73});ids.push(...p.rows.map(x=>x.id));cursor=p.cursor;}while(cursor);
              c.close();return {binary:[...bin],ids:ids.length,unique:new Set(ids).size};
            """,[seeded['manifest']]);assert cold=={'binary':[0,255,128,1],'ids':1000,'unique':1000},cold
            receipt['checks'].append('dashboard-closed/real-process-restart/exact-binary-source/stable-complete-paging/draft-restored')
            injected=asyncjs(sid,"""
              const bg=await browser.runtime.getBackgroundPage();
              const p=bg.IDBObjectStore.prototype,original=p.put;
              p.put=function(value){if(this.name==='views')throw new DOMException('fixture private quota detail','QuotaExceededError');return original.call(this,value);};
              return {injected:true};
            """);assert injected=={'injected':True},injected
            click(sid,'#save-view');wait(lambda:script(sid,"return document.querySelector('#view-result [role=alert]')?.dataset.code")=='STORAGE_FULL')
            assert 'Earlier data is kept' in script(sid,"return document.getElementById('view-result').textContent")
            assert 'private quota' not in script(sid,"return document.body.textContent")
            retained=asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs'));const c=await openCore();const v=await c.view('shell-view');c.close();return v;")
            assert retained['journalFilter']=='SAVE_VIEW',retained
            receipt['checks'].append('actual-background-IDB-put-quota-fault/useful-UI-error/previous-data-retained/no-error-secret')
            (OUT/'records.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')))
            receipt['result']='PASS'
        except Exception as error:
            receipt['error']=str(error)
            if sid:
                try:(OUT/'records-failure.png').write_bytes(base64.b64decode(call('GET',f'/session/{sid}/screenshot')))
                except Exception:pass
            raise
        finally:
            if sid:
                try:stop(sid,profile)
                except Exception:pass
            proc.terminate();proc.wait(timeout=10);log.close();(OUT/'installed-records.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps(receipt),flush=True)

if __name__=='__main__':main()
