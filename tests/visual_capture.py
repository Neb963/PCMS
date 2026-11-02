"""Capture real installed Firefox pixels. Capture is NOT a vision verdict.
Only deterministic independent fixture data belongs in these public receipts.
"""
from installed_host import call,script,wait,OUT
import base64,hashlib,json,time

def viewport(sid,width):
 from installed_records import asyncjs
 result=asyncjs(sid,"const t=await browser.tabs.getCurrent();await browser.tabs.setZoom(t.id,1);return true;");assert result is True,result
 call('POST',f'/session/{sid}/window/rect',{'width':width,'height':885})
 actual=script(sid,'return innerWidth;')
 if actual>width+2:
  # Firefox's native window has a 500px floor. Real browser zoom exercises
  # a ~390 CSS-pixel viewport without replacing DOM or altering screenshot pixels.
  zoom=actual/width;result=asyncjs(sid,"const t=await browser.tabs.getCurrent();await browser.tabs.setZoom(t.id,arguments[0]);return true;",[zoom]);assert result is True,result
  call('POST',f'/session/{sid}/window/rect',{'height':round(800*zoom+85)})
 if width<500:assert script(sid,'return innerWidth;')<=420,'NARROW_VIEWPORT_UNAVAILABLE'

def capture(sid,label,receipt):
 wait(lambda:script(sid,"return document.getElementById('records').dataset.routeReady===(location.hash.slice(1)||'home')&&document.getElementById('records').getAttribute('aria-busy')==='false';"),45)
 script(sid,'window.scrollTo(0,0);')
 directory=OUT/'visual'/receipt.get('visualSuite','shared-ui');directory.mkdir(parents=True,exist_ok=True)
 state=script(sid,"return {route:location.hash,width:innerWidth,height:innerHeight,outerWidth,outerHeight,scrollX,scrollY,documentWidth:document.documentElement.scrollWidth,devicePixelRatio,platform:navigator.platform}")
 assert state['documentWidth']<=state['width']+1,('HORIZONTAL_OVERFLOW',label,state)
 navigation=script(sid,"const a=document.querySelector('nav a[aria-current=\"page\"]'),nav=a?.closest('nav');if(!nav)return null;const r=a.getBoundingClientRect(),n=nav.getBoundingClientRect();return {left:r.left,right:r.right,navLeft:n.left,navRight:n.right};")
 assert navigation is None or navigation['left']>=navigation['navLeft']-1 and navigation['right']<=navigation['navRight']+1,('ACTIVE_NAVIGATION_CLIPPED',label,navigation)
 hidden=script(sid,"return [...document.querySelectorAll('[hidden]')].filter(e=>e.getClientRects().length>0).map(e=>({tag:e.tagName,id:e.id}));")
 assert hidden==[],('VISIBLE_HIDDEN_CONTROL',label,hidden)
 for mode,endpoint in [('viewport','screenshot'),('full','moz/screenshot/full')]:
  data=base64.b64decode(call('GET',f'/session/{sid}/'+endpoint));name=f'{label}-{state["width"]}-{mode}.png';(directory/name).write_bytes(data)
  receipt.setdefault('screenshots',[]).append({'path':str(directory.relative_to(OUT)/name),'sha256':hashlib.sha256(data).hexdigest(),'source':receipt['source'],'xpiSha256':receipt['xpiSha256'],'browserVersion':receipt.get('browserVersion'),'buildId':receipt.get('buildId'),'mode':mode,'state':state,'capturedAt':time.time()})
 (directory/'manifest.json').write_text(json.dumps(receipt['screenshots'],indent=2)+'\n')

def state_matrix(sid,label,receipt):
 # Called only after the owning installed journey verified this actual state.
 # Keep every pixel and its real viewport; never replace the operational DOM.
 previous=receipt.get('visualSuite');receipt['visualSuite']='journey-'+label
 try:
  for width in [1280,560,390]:
   viewport(sid,width);capture(sid,label,receipt)
 finally:
  viewport(sid,1280)
  if previous is None:receipt.pop('visualSuite',None)
  else:receipt['visualSuite']=previous

def matrix(sid,receipt,click,set_input,owner):
 # No raw source/user input or authority is injected into the UI. The fixtures
 # below are persisted Core records, rendered by the packaged UI/RPC queries.
 from installed_records import asyncjs
 seeded=asyncjs(sid,"""const {openCore}=await import(browser.runtime.getURL('core/records.mjs')),c=await openCore();const accountId=arguments[0],creator='visual-creator-wait',deploy='visual-deploy-wait',target='visual-generator-wait';await c.mutate([{table:'generators',id:target,value:{slug:'waiting-example',folder:'generators/waiting-example',folderPresent:'YES',markerVersion:'v1',markerAction:'DEPLOY',markerStatus:'READY',creatorJobId:creator,creatorState:'HELD',creatorHoldCode:'ACCOUNT_ROUTE_RECHECK_REQUIRED',allocationAccountId:accountId,deploymentJobId:deploy,deploymentState:'WAIT_CREATOR',state:'FOLDER_ONLY'}},{table:'jobs',id:creator,value:{moduleId:'pcms-creator',generation:1,jobSchema:1,kind:'CREATE',accountId,targetId:target,state:'HELD',recovery:{action:'OPEN_ACCOUNT',code:'ACCOUNT_ROUTE_RECHECK_REQUIRED'},creator:{schema:1,phase:'RESERVED',cycle:0,observations:[]}}},{table:'jobs',id:deploy,value:{moduleId:'pcms-deployer',generation:1,jobSchema:1,kind:'DEPLOY',targetId:target,state:'WAITING',step:'WAIT_CREATOR',dueAt:Date.now()+86400000,input:{commit:'a'.repeat(40)},deployment:{schema:1,phase:'WAIT_CREATOR',version:'v1',inputHash:'b'.repeat(64),creatorJobId:creator}}}],{step:'VISUAL_FIXTURE_WAIT',result:'WAITING'});await c.mutate(Array.from({length:1005},(_,i)=>({table:'generators',id:'visual-list-'+String(i).padStart(4,'0'),value:{slug:'screen-example-'+String(i).padStart(4,'0'),folder:'generators/screen-example-'+String(i).padStart(4,'0'),folderPresent:'YES',markerVersion:'v1',markerAction:'DEPLOY',markerStatus:'READY',allocationAccountId:accountId,creatorState:'RESERVED'}})),{step:'VISUAL_FIXTURE_LARGE_LIST',result:'COMPLETE'});c.close();return true;""",[owner])
 assert seeded is True,seeded
 receipt['visualFixture']='1005 synthetic persisted folder records plus real local account and held upstream dependency; no provider effects from visual records'
 set_input(sid,'#global-search','')
 for width in [1280,560,390]:
  viewport(sid,width)
  click(sid,'nav a[href="#generators"]');wait(lambda:script(sid,"return !!document.getElementById('catalog-search')"));set_input(sid,'#catalog-search','');
  if script(sid,"return !document.getElementById('catalog-clear-selection').disabled"):click(sid,'#catalog-clear-selection')
  from installed_discover import choose
  for selector in ['#catalog-filter','#catalog-account','#catalog-listing','#catalog-work']:choose(sid,selector,'')
  wait(lambda:script(sid,"return document.querySelectorAll('#generator-list input.row-select').length===50&&document.getElementById('generator-list').getAttribute('aria-busy')==='false'"),45)
  for title in ['Home','Generators','Accounts','Refresher','Work','Other','Settings']:
   click(sid,'nav a[href="#'+title.lower()+'"]');wait(lambda:script(sid,"return document.getElementById('heading').textContent===arguments[0]",[title]));capture(sid,title.lower(),receipt)
  for section in ['connections','modules','refresher','journal','backup','advanced']:
   click(sid,'nav a[href="#settings"]');wait(lambda:script(sid,"return !!document.getElementById('settings-search')"));set_input(sid,'#settings-search','');click(sid,'#records a[href="#settings/'+section+'"]');wait(lambda:script(sid,"return location.hash===arguments[0]&&document.getElementById('records').children.length>0",['#settings/'+section]));capture(sid,'settings-'+section,receipt)
  click(sid,'nav a[href="#accounts"]');wait(lambda:script(sid,"return !!document.querySelector('#account-list a[href=\"#accounts/'+arguments[0]+'\"]')",[owner]));click(sid,'#account-list a[href="#accounts/'+owner+'"]');wait(lambda:script(sid,"return !!document.getElementById('account-state')"));capture(sid,'account-ready',receipt)
  click(sid,'nav a[href="#work"]');wait(lambda:script(sid,"return !!document.getElementById('work-search')"));set_input(sid,'#work-search','waiting-example');wait(lambda:script(sid,"return !!document.querySelector('#work-list a[href=\"#work/visual-deploy-wait\"]')"));click(sid,'#work-list a[href="#work/visual-deploy-wait"]');wait(lambda:script(sid,"return !!document.getElementById('deployment-state')"));capture(sid,'work-deploy-wait',receipt)
  assert script(sid,"const e=document.getElementById('deployment-attestation');return !e||!e.getClientRects().length;")
  click(sid,'nav a[href="#other"]');wait(lambda:script(sid,"return !!document.getElementById('module-search')"));set_input(sid,'#module-search','');links=script(sid,"return [...document.querySelectorAll('#records a[href^=\"#module/\"]')].map(e=>e.getAttribute('href'));")
  for index,link in enumerate(links):
   click(sid,'#records a[href="'+link+'"]');wait(lambda:script(sid,"return document.querySelector('iframe.module-frame')?.getAttribute('aria-busy')==='false'"));capture(sid,'module-'+str(index),receipt);click(sid,'nav a[href="#other"]');wait(lambda:script(sid,"return !!document.getElementById('module-search')"))
  set_input(sid,'#global-search','Continuity owner');click(sid,'#global-search-form button[type="submit"]');wait(lambda:script(sid,"return document.querySelectorAll('#global-results li').length>0"));capture(sid,'global-results',receipt);set_input(sid,'#global-search','');script(sid,"document.getElementById('global-search-form').requestSubmit();")
