"""Extra installed search evidence on real Core/IDB; no provider effects.
The only fault hooks are test-side RPC delivery and an IDB transaction boundary.
They never replace production queries, rows, DOM or navigation handlers.
"""
from installed_records import asyncjs,click
from installed_host import call,script,wait
from installed_journal import set_input
import time

def run(sid,receipt):
 script(sid,"window.scrollTo(0,0)")
 if script(sid,"return document.getElementById('queue-status').textContent==='Running'"):
  click(sid,'#pause-core');wait(lambda:script(sid,"return document.getElementById('queue-status').textContent==='Paused'"))
 seeded=asyncjs(sid,"""const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore();await c.mutate([
 {table:'accounts',id:'search-account-one',value:{label:'Żółć 雪 search owner',state:'ARCHIVED'}},
 {table:'accounts',id:'search-account-two',value:{label:'Żółć 雪 search owner',state:'ARCHIVED'}},
 {table:'generators',id:'search-slow',value:{slug:'slow-needle',accountId:'search-account-one',folder:'generators/slow-needle',listing:'UNLISTED',state:'FOLDER_ONLY'}},
 {table:'generators',id:'search-fast',value:{slug:'fast-needle',accountId:'search-account-one',folder:'generators/fast-needle',listing:'PUBLIC',state:'FOLDER_ONLY'}},
 {table:'jobs',id:'search-completed-job',value:{moduleId:'pcms-deployer',generation:1,jobSchema:1,kind:'SOURCE_INSPECT',targetId:'search-fast',accountId:'search-account-one',state:'COMPLETE',step:'COMPLETE'}}
 ],{step:'SEARCH_FIXTURE_RECORDS',result:'COMPLETE'});const sequence=(await c.status()).sequence;c.close();return sequence;""")
 assert isinstance(seeded,int) and seeded>0,seeded
 installed=asyncjs(sid,"""const bg=await browser.runtime.getBackgroundPage();if(bg.__searchProbe)throw Error('DUPLICATE_SEARCH_PROBE');const p=bg.__searchProbe={requests:[],responses:[],ports:[],delayed:false,fail:false,failed:0};
 const transaction=bg.IDBDatabase.prototype.transaction;p.transaction=transaction;
 bg.IDBDatabase.prototype.transaction=function(names,...rest){if(this.name==='pcms-core'&&p.fail&&Array.from(typeof names==='string'?[names]:names).includes('versions')){p.fail=false;p.failed++;throw new bg.DOMException('Synthetic IndexedDB transaction unavailable','InvalidStateError');}return transaction.call(this,names,...rest);};
 p.listener=port=>{if(port.name!=='pcms-core-rpc')return;p.ports.push(port);const requests=new Map(),send=port.postMessage.bind(port);
 port.onMessage.addListener(m=>{if(m.operation==='ui.search'){requests.set(m.rpcId,m.query);p.requests.push({id:m.rpcId,query:m.query,at:Date.now()});}});
 port.postMessage=packet=>{const query=requests.get(packet.rpcId);if(query===undefined)return send(packet);const deliver=()=>{p.responses.push({id:packet.rpcId,query,ok:packet.response.ok,code:packet.response.code??null,at:Date.now()});send(packet);};if(query==='slow-needle'&&p.delayed)setTimeout(deliver,1400);else deliver();};};
 bg.browser.runtime.onConnect.addListener(p.listener);return true;""")
 assert installed is True,installed
 try:
  call('POST',f'/session/{sid}/refresh',{})
  wait(lambda:script(sid,"return !!document.getElementById('global-search')&&document.getElementById('records').getAttribute('aria-busy')==='false'"),40)
  def search(query,expected=None):
   start=time.monotonic();set_input(sid,'#global-search',query);click(sid,'#global-search-form button[type="submit"]')
   wait(lambda:script(sid,"return !['Searching…',''].includes(document.getElementById('global-search-status').textContent)"),30)
   links=script(sid,"return [...document.querySelectorAll('#global-results a')].map(a=>a.getAttribute('href'))")
   if expected is not None:assert sorted(links)==sorted(expected),(query,links)
   return {'query':query,'hrefs':links,'elapsedMs':(time.monotonic()-start)*1000}
  results=[]
  results.append(search('ŻÓŁĆ 雪 search owner'))
  assert '#accounts/search-account-one' in results[-1]['hrefs'] and '#accounts/search-account-two' in results[-1]['hrefs']
  assert '#generators/search-fast' in results[-1]['hrefs'] and '#work/search-completed-job' in results[-1]['hrefs']
  results.append(search('generators/fast-needle',['#generators/search-fast','#work/search-completed-job']))
  click(sid,'#global-results a[href="#generators/search-fast"]');wait(lambda:script(sid,"return location.hash==='#generators/search-fast'&&document.getElementById('generator-detail')!==null"))
  results.append(search('search-completed-job',['#work/search-completed-job']))
  click(sid,'#global-results a');wait(lambda:script(sid,"return location.hash==='#work/search-completed-job'&&document.getElementById('work-job-state')!==null"))
  results.append(search('no-such-synthetic-result-991',[]));assert script(sid,"return document.getElementById('global-search-status').textContent")=='No matching items.'
  asyncjs(sid,"(await browser.runtime.getBackgroundPage()).__searchProbe.delayed=true;return true;")
  set_input(sid,'#global-search','slow-needle');click(sid,'#global-search-form button[type="submit"]')
  wait(lambda:asyncjs(sid,"return (await browser.runtime.getBackgroundPage()).__searchProbe.requests.some(r=>r.query==='slow-needle');"))
  results.append(search('fast-needle',['#generators/search-fast','#work/search-completed-job']))
  wait(lambda:asyncjs(sid,"const p=(await browser.runtime.getBackgroundPage()).__searchProbe;return p.responses.some(r=>r.query==='slow-needle')&&p.responses.some(r=>r.query==='fast-needle');"),15)
  assert script(sid,"return document.getElementById('global-search').value==='fast-needle'&&[...document.querySelectorAll('#global-results a')].every(a=>!a.getAttribute('href').includes('search-slow'))")
  # Invalidate the real immutable-query cache, then fail one actual IDB read.
  armed=asyncjs(sid,"""const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore();await c.mutate([{table:'generators',id:'search-invalidation',value:{slug:'invalidation-only',state:'FOLDER_ONLY'}}],{step:'SEARCH_FIXTURE_INVALIDATE',result:'COMPLETE'});c.close();(await browser.runtime.getBackgroundPage()).__searchProbe.fail=true;return true;""")
  assert armed is True
  set_input(sid,'#global-search','fast-needle');click(sid,'#global-search-form button[type="submit"]')
  wait(lambda:script(sid,"return document.getElementById('global-search-status').textContent==='Search unavailable: STORAGE_UNAVAILABLE'"),30)
  assert script(sid,"return document.getElementById('global-search').value==='fast-needle'&&document.querySelectorAll('#global-results a').length===0")
  results.append(search('fast-needle',['#generators/search-fast','#work/search-completed-job']))
  probe=asyncjs(sid,"const p=(await browser.runtime.getBackgroundPage()).__searchProbe;return {requests:p.requests,responses:p.responses,failed:p.failed};")
  assert probe['failed']==1 and any(not r['ok'] and r['code']=='STORAGE_UNAVAILABLE' for r in probe['responses']),probe
  slow=next(r for r in probe['responses'] if r['query']=='slow-needle');assert any(r['query']=='fast-needle' and r['at']<slow['at'] for r in probe['responses']),probe
  diagnostics=asyncjs(sid,"""const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore();const p=await c.list({table:'events',first:arguments[0],search:'UI_QUERY',limit:200});c.close();return p.rows.filter(r=>r.diagnostics?.action==='GLOBAL_SEARCH').map(r=>({operationId:r.operationId,result:r.result,code:r.code,diagnostics:r.diagnostics}));""",[seeded])
  assert any(r.get('code')=='STORAGE_UNAVAILABLE' and r['result']=='FAILED' for r in diagnostics),diagnostics
  receipt['searchContract']={'scope':'real packaged DOM/RPC/Core/IndexedDB; synthetic records; delivery/IDB fault injection only','queries':results,'delivery':probe,'causalEvents':diagnostics}
  receipt['checks'].append('R05-real-IDB/Unicode-case/duplicate-label-distinct-ID/folder-job-exact-navigation/no-match/out-of-order-valid-Core-replies/stale-result-fence/actual-IDB-boundary-failure/explicit-error-preserved-input/retry/default-causal-record')
 finally:
  asyncjs(sid,"const bg=await browser.runtime.getBackgroundPage(),p=bg.__searchProbe;if(p){bg.IDBDatabase.prototype.transaction=p.transaction;bg.browser.runtime.onConnect.removeListener(p.listener);p.delayed=false;p.fail=false;delete bg.__searchProbe;}return true;")
