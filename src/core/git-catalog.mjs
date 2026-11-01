import {requireCore as check,publicError,sha256} from './records.mjs';
import {createGitReader,decodeGitBlob,verifyGitTree,gitSha,validRepository} from './git-reader.mjs';
import {parseDeploymentMarker} from './deployment-marker.mjs';
const VIEW='git-catalog',POLL=60000;
const empty=()=>({schema:1,connection:null,cache:{},scan:null,head:null,root:null,nextAt:null,code:null,observedAt:null});
const segment=v=>typeof v==='string'&&v!==''&&!['.','..'].includes(v)&&!/[\\/\0]/.test(v);
const regular=e=>e?.type==='blob'&&['100644','100755'].includes(e.mode);
function treeRows(body,sha){check(body?.sha===sha&&body.truncated===false&&Array.isArray(body.tree),'GIT_TREE_INCOMPLETE');const seen=new Set();for(const e of body.tree){check(segment(e.path)&&!seen.has(e.path)&&gitSha(e.sha)&&(['tree','blob','commit'].includes(e.type)),'GIT_TREE_INVALID');seen.add(e.path);if(e.type==='tree')check(e.mode==='040000','GIT_TREE_INVALID');}return body.tree;}
// A finite Core reader, not a workflow controller. Saved cursors are read
// positions only. Modules still own every create/source/publication operation.
export function createGitCatalog({core,transport=globalThis.fetch,clock=Date.now,requestBudget=4,rowBudget=32}){
 const read=createGitReader({transport,clock});let serial=Promise.resolve();
 const run=fn=>{const p=serial.then(fn,fn);serial=p.catch(()=>{});return p;};
 const load=async()=>await core.view(VIEW)??empty();
 const save=s=>core.saveView(VIEW,s,crypto.randomUUID());
 const token=c=>core.credentials.get('github:'+c.repositoryId);
 const publicState=s=>({configured:!!s.connection,repository:s.connection?.repository??'',repositoryId:s.connection?.repositoryId??null,readVerifiedAt:s.connection?.readVerifiedAt??null,code:s.code,head:s.head,observedAt:s.observedAt,nextAt:s.nextAt,pending:!!s.scan,scanStage:s.scan?.stage??null,scanned:s.scan?.rows?.length??0,folderCount:s.folderCount??null,writeAccess:'NOT_TESTED'});
 async function connection(repository,credential){
  check(validRepository(repository),'GIT_REPOSITORY_INVALID');const repo=(await read({repository,token:credential})).body;
  check(typeof repo?.full_name==='string'&&repo.full_name.toLowerCase()===repository.toLowerCase()&&(Number.isSafeInteger(repo.id)&&repo.id>0||typeof repo.id==='string'&&/^[0-9]+$/.test(repo.id)),'GIT_REPOSITORY_IDENTITY_UNVERIFIED');
  const ref=await read({repository:repo.full_name,token:credential,path:'/git/ref/heads/main'});check(ref.body?.ref==='refs/heads/main'&&ref.body.object?.type==='commit'&&gitSha(ref.body.object.sha),'GIT_MAIN_UNVERIFIED');return {connection:{repository:repo.full_name,repositoryId:String(repo.id),readVerifiedAt:clock()},head:ref.body.object.sha,etag:ref.etag};
 }
 async function configure({repository,credential}){
  repository=typeof repository==='string'?repository.trim():repository;const verified=await connection(repository,credential),s=await load(),same=s.connection?.repositoryId===verified.connection.repositoryId;
  await core.credentials.set('github:'+verified.connection.repositoryId,credential);
  const next={...same?s:empty(),connection:verified.connection,etag:verified.etag,code:null,nextAt:clock(),retryAt:null};
  if(!same||verified.head!==s.head)next.scan={head:verified.head,stage:'COMMIT',rows:[],cursor:0};await save(next);await core.record({targetId:'repository:'+verified.connection.repositoryId,step:'CONNECT_GIT',result:'COMPLETE'});return publicState(next);
 }
 async function reconnect(){const s=await load();check(s.connection,'GIT_CONNECTION_REQUIRED');if(s.retryAt>clock())return publicState(s);try{const v=await connection(s.connection.repository,await token(s.connection));check(v.connection.repositoryId===s.connection.repositoryId,'GIT_REPOSITORY_IDENTITY_CHANGED');s.connection=v.connection;s.code=null;s.etag=v.etag;if(v.head!==s.head&&!s.scan)s.scan={head:v.head,stage:'COMMIT',rows:[],cursor:0};s.nextAt=clock();await save(s);return publicState(s);}catch(error){s.code=error.code??publicError(error);s.retryAt=error.retryAt??null;s.nextAt=s.retryAt??clock()+POLL;await save(s);throw error;}}
 async function apply(s){
  const c=s.connection,seen=new Set(),changes=[];for(const row of s.scan.rows){const id='git:'+c.repositoryId+':'+await sha256(new TextEncoder().encode(row.folder)),old=await core.read('generators',id);check(!old||old.repositoryId===c.repositoryId&&old.folder===row.folder,'GIT_FOLDER_ID_CONFLICT');seen.add(id);
   const value={...old,generatorId:id,slug:row.slug,repositoryId:c.repositoryId,...row,...row.markerStatus==='DONE'&&old?.completedDeployment?.version===row.markerVersion&&old.completedDeployment.action===row.markerAction&&old.completedDeployment.doneFolderTreeSha===row.folderTreeSha?{gitState:'DONE'}:{},folderPresent:'YES',catalogHead:s.scan.head,catalogObservedAt:clock(),state:old?.state??(row.gitHoldCode?'HELD':'FOLDER_ONLY')};
   if(row.gitHoldCode&&!old?.holdCode)value.holdCode=row.gitHoldCode;
   if(!old||old.folderTreeSha!==value.folderTreeSha||old.folderPresent!=='YES')changes.push({table:'generators',id,expectedRev:old?.rev??0,value,refs:old?.refs??[]});
  }
  let cursor=null;do{const page=await core.list({table:'generators',cursor,filters:{repositoryId:c.repositoryId}});for(const p of page.rows)if(!seen.has(p.id)){const old=await core.read('generators',p.id);if(old.folderPresent!=='NO')changes.push({table:'generators',id:p.id,expectedRev:old.rev,value:{...old,folderPresent:'NO',gitState:'FOLDER_MISSING',gitHoldCode:'FOLDER_MISSING',state:'HELD',holdCode:'FOLDER_MISSING',catalogHead:s.scan.head,catalogObservedAt:clock()},refs:old.refs??[]});}cursor=page.cursor;}while(cursor);
  if(changes.length)await core.mutate(changes,{targetId:'repository:'+c.repositoryId,step:'OBSERVE_GIT_CATALOG',result:'COMPLETE'});
  s.head=s.scan.head;s.root=s.scan.root;s.folderCount=s.scan.rows.length;s.scan=null;s.observedAt=clock();s.nextAt=clock()+POLL;s.code=null;s.retryAt=null;
 }
 async function tick(force=false){
  const s=await load();if(!s.connection||s.retryAt>clock()||!force&&s.nextAt>clock())return publicState(s);let used=0,rows=0;
  const get=async(path,etag=null)=>{if(used>=requestBudget)throw {yield:true};used++;return read({repository:s.connection.repository,token:await token(s.connection),path,etag});};
  const object=async(kind,sha)=>{check(gitSha(sha),'GIT_OBJECT_INVALID');const key=kind+':'+sha;if(s.cache[key])return s.cache[key];const body=(await get('/git/'+kind+'/'+sha)).body;check(body?.sha===sha,'GIT_OBJECT_INVALID');if(kind==='blobs')await decodeGitBlob(body,sha);else if(kind==='trees'){treeRows(body,sha);await verifyGitTree(body.tree,sha);}s.cache[key]=body;return body;};
  try{
   if(!s.scan){const r=await get('/git/ref/heads/main',s.etag);s.etag=r.etag;if(r.status===304){s.nextAt=clock()+POLL;s.code=null;await save(s);return publicState(s);}check(r.body?.ref==='refs/heads/main'&&r.body.object?.type==='commit'&&gitSha(r.body.object.sha),'GIT_MAIN_UNVERIFIED');if(r.body.object.sha===s.head){s.nextAt=clock()+POLL;s.code=null;await save(s);return publicState(s);}s.scan={head:r.body.object.sha,stage:'COMMIT',rows:[],cursor:0};}
   const scan=s.scan;
   while(rows++<rowBudget){
    if(scan.stage==='COMMIT'){const commit=await object('commits',scan.head);check(gitSha(commit.tree?.sha),'GIT_MAIN_UNVERIFIED');scan.root=commit.tree.sha;scan.stage=s.root?'ROOT':'RECURSIVE';}
    else if(scan.stage==='RECURSIVE'){
     const body=(await get('/git/trees/'+scan.root+'?recursive=1')).body;check(body?.sha===scan.root&&Array.isArray(body.tree)&&typeof body.truncated==='boolean','GIT_TREE_INVALID');
     if(!body.truncated){const trees=new Map([['',scan.root]]),groups=new Map();for(const e of body.tree){check(typeof e.path==='string'&&e.path.split('/').every(segment)&&gitSha(e.sha),'GIT_TREE_INVALID');if(e.type==='tree'&&(e.path==='generators'||/^generators\/[^/]+$/.test(e.path)))trees.set(e.path,e.sha);const at=e.path.lastIndexOf('/'),prefix=at<0?'':e.path.slice(0,at);if(!groups.has(prefix))groups.set(prefix,[]);groups.get(prefix).push({...e,path:e.path.slice(at+1)});}
      for(const [prefix,sha]of trees){const tree={sha,truncated:false,tree:groups.get(prefix)??[]};treeRows(tree,sha);await verifyGitTree(tree.tree,sha);s.cache['trees:'+sha]=tree;}}
     scan.stage='ROOT';
    }else if(scan.stage==='ROOT'){
     const root=treeRows(await object('trees',scan.root),scan.root),entry=root.find(e=>e.path==='generators');if(entry)check(entry.type==='tree'&&entry.mode==='040000','GIT_ROOT_NOT_DIRECTORY');scan.generators=entry?.sha??null;scan.stage='FOLDERS';
    }else if(scan.stage==='FOLDERS'){
     const entries=scan.generators?treeRows(await object('trees',scan.generators),scan.generators):[];scan.folders=entries.filter(e=>e.type==='tree').sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);scan.stage='MARKERS';
    }else if(scan.stage==='MARKERS'){
     if(scan.cursor>=scan.folders.length){scan.stage='APPLY';continue;}
     const folder=scan.folders[scan.cursor],entries=treeRows(await object('trees',folder.sha),folder.sha),marker=entries.find(e=>e.path==='DEPLOYMENT.md');let parsed;
     if(!marker)parsed={ok:false,code:'MARKER_MISSING'};else if(!regular(marker))parsed={ok:false,code:'MARKER_NOT_FILE'};else parsed=parseDeploymentMarker(await decodeGitBlob(await object('blobs',marker.sha),marker.sha));
     if(!/^[a-z0-9][a-z0-9-]*$/.test(folder.path))parsed={ok:false,code:'FOLDER_NAME_INVALID'};
     scan.rows.push({slug:folder.path,folder:'generators/'+folder.path,folderTreeSha:folder.sha,markerSha:marker?.sha??null,markerVersion:parsed.version??null,markerAction:parsed.action??null,markerStatus:parsed.status??null,gitState:parsed.ok?(parsed.status==='DONE'?'DONE_UNVERIFIED':parsed.status):'DECLARATION_ERROR',gitHoldCode:parsed.ok?null:parsed.code});scan.cursor++;
    }else if(scan.stage==='APPLY'){await apply(s);break;}else check(false,'GIT_SCAN_INVALID');
   }
   if(s.scan)s.nextAt=clock()+1000;
  }catch(error){if(error.yield){s.nextAt=clock()+1000;}else{s.code=error.code??publicError(error);s.retryAt=error.retryAt??null;s.nextAt=s.retryAt??clock()+POLL;await core.record({targetId:'repository:'+s.connection.repositoryId,step:'OBSERVE_GIT_CATALOG',result:'HELD',code:s.code});}}
  await save(s);return publicState(s);
 }
 async function verifyRestored(){const s=await load();if(!s.connection)return {state:'NOT_CONFIGURED'};try{const v=await connection(s.connection.repository,await token(s.connection));check(v.connection.repositoryId===s.connection.repositoryId,'GIT_REPOSITORY_IDENTITY_CHANGED');s.connection=v.connection;s.code=null;s.retryAt=null;s.nextAt=clock();await save(s);return {state:'VALIDATED',observedAt:v.connection.readVerifiedAt};}catch(error){s.connection={...s.connection,readVerifiedAt:null};s.code=error.code??publicError(error);s.retryAt=error.retryAt??null;s.nextAt=s.retryAt??clock()+POLL;await save(s);return {state:'HELD',code:s.code};}}
 return {verifyRestored:()=>run(verifyRestored),initialize:async()=>publicState(await load()),configure:args=>run(()=>configure(args)),reconnect:()=>run(reconnect),tick:force=>run(()=>tick(force)),status:async()=>publicState(await load()),deadline:async()=>{const s=await load();return s.connection?s.nextAt:null;},async list(args={}){const s=await load();if(!s.connection)return {rows:[],cursor:null};return core.list({table:'generators',cursor:args.cursor,search:args.search??'',filters:{repositoryId:s.connection.repositoryId,...args.state?{gitState:args.state}:{}},limit:50});},get:id=>core.get('generators',id)};
}
