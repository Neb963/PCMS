"""Real packaged render error -> fixed alert/retry -> default Core evidence.
Only one test-side DOM-construction boundary throws; no page DOM/query result
or product handler is replaced, and no account/provider effect is requested.
"""
from installed_host import script,wait,call,OUT
from installed_records import asyncjs,click
import base64,hashlib,json,time

def run(sid,receipt):
 first=asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),r=await c.status();c.close();return r.sequence+1;")
 script(sid,"const p=window.__renderFault={original:document.createElement,fired:0};document.createElement=function(tag,...args){if(tag==='select'&&location.hash==='#accounts'&&!p.fired){p.fired++;document.createElement=p.original;throw new TypeError('never-export-private-fixture');}return p.original.call(this,tag,...args);};")
 try:
  click(sid,'nav a[href="#accounts"]')
  wait(lambda:script(sid,"const m=document.getElementById('records');return m.dataset.renderError==='UI_RENDER_FAILED'&&!m.dataset.routeReady&&m.getAttribute('aria-busy')==='false'&&m.querySelector('[role=\"alert\"]')?.textContent.startsWith('This page could not be displayed.');"),30)
  assert script(sid,"return window.__renderFault.fired===1&&!document.body.innerText.includes('never-export-private-fixture')")
  state=script(sid,"return {route:location.hash,width:innerWidth,height:innerHeight,devicePixelRatio,documentWidth:document.documentElement.scrollWidth};");assert state['documentWidth']<=state['width']+1
  directory=OUT/'visual'/'journey-accounts-render-failure';directory.mkdir(parents=True,exist_ok=True);name='accounts-render-failure-'+str(state['width'])+'-viewport.png';pixels=base64.b64decode(call('GET',f'/session/{sid}/screenshot'));(directory/name).write_bytes(pixels)
  captured={'path':str((directory/name).relative_to(OUT)),'sha256':hashlib.sha256(pixels).hexdigest(),'source':receipt['source'],'xpiSha256':receipt['xpiSha256'],'browserVersion':receipt['browserVersion'],'buildId':receipt['buildId'],'state':state,'mode':'viewport','capturedAt':time.time()};receipt.setdefault('screenshots',[]).append(captured);(directory/'manifest.json').write_text(json.dumps([captured],indent=2)+'\n')
  click(sid,'#records button')
  wait(lambda:script(sid,"const m=document.getElementById('records');return m.dataset.routeReady==='accounts'&&!m.dataset.renderError&&m.getAttribute('aria-busy')==='false'&&!!document.getElementById('account-filter')&&!!document.getElementById('account-list');"),30)
  events=asyncjs(sid,"const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore(),r=await c.status(),p=await c.list({table:'events',search:'UI_RENDER',first:arguments[0],last:r.sequence,limit:200});c.close();return p.rows;",[first])
  assert len(events)==1 and events[0]['code']=='UI_RENDER_FAILED' and events[0]['diagnostics']['exceptionType']=='TYPE_ERROR' and events[0]['diagnostics']['action']=='UI_ACCOUNTS_RENDER',events
  receipt['checks'].append('actual-render-construction-TypeError/visible-fixed-alert/failed-not-ready/real-Reload-view/full-Accounts-controls-restored/one-typed-default-Core-record/no-provider-or-account-effect')
  return first
 finally:script(sid,"const p=window.__renderFault;if(p){document.createElement=p.original;delete window.__renderFault;}")
