// Scoped-tree and operation-trailer mechanics adapt pinned Alpha git-writeback:
// https://github.com/Neb963/PCMS-Alpha/blob/c5b23b77f50db7ffe50e2ef705a8bf0b5879e36e/src/runtime/git-writeback.mjs
// This planner has no token, HTTP writes, queue or provider authority.
import {requireCore as check,sha256} from './records.mjs';
import {gitBlob,gitObjectOid,gitTreeOid,gitSha,decodeGitBlob,verifyGitTree} from './git-reader.mjs';
import {parseDeploymentMarker,INITIAL_MARKER} from './deployment-marker.mjs';
const SOURCE=path=>path==='main.pjs'||path==='index.html'||path.startsWith('src/');
const INPUTS=new Set(['DEPLOYMENT.md','specification.md','ui.md','agents.md','prompt.md']);
export const safeGitPath=path=>typeof path==='string'&&path.isWellFormed()&&path!==''&&!path.startsWith('/')&&!/[\\\0]/.test(path)&&path.split('/').every(p=>p!==''&&p!=='.'&&p!=='..');
const regular=e=>e?.type==='blob'&&['100644','100755'].includes(e.mode);
const sorted=object=>Object.fromEntries(Object.entries(object??{}).sort(([a],[b])=>a<b?-1:a>b?1:0));
export function normalizeGitRequest(request){
 check(request&&typeof request==='object'&&!Array.isArray(request)&&Object.keys(request).every(k=>['kind','slug','folder','version','action','sourceManifest','ownedPaths','expectedInputs','expectedAffected'].includes(k)),'GIT_REQUEST_INVALID');
 check(['PREPARE','SOURCE','DONE'].includes(request.kind)&&typeof request.slug==='string'&&/^[a-z0-9][a-z0-9-]*$/.test(request.slug),'GIT_REQUEST_INVALID');
 const out={kind:request.kind,slug:request.slug,folder:'generators/'+request.slug};check(request.folder==null||request.folder===out.folder,'GIT_TARGET_SCOPE_DENIED');
 if(request.kind==='PREPARE'){check(Object.keys(request).every(k=>['kind','slug','folder'].includes(k)),'GIT_REQUEST_INVALID');return out;}
 check(typeof request.version==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(request.version)&&['DEVELOP','DEPLOY'].includes(request.action),'GIT_REQUEST_INVALID');Object.assign(out,{version:request.version,action:request.action});
 for(const name of ['expectedInputs','expectedAffected']){const map=request[name];check(map&&typeof map==='object'&&!Array.isArray(map),'GIT_PRECONDITION_REQUIRED');for(const [path,sha]of Object.entries(map)){check(safeGitPath(path)&&(INPUTS.has(path)||SOURCE(path))&&(sha===null||gitSha(sha)),'GIT_PRECONDITION_INVALID');}out[name]=sorted(map);}
 check(gitSha(out.expectedInputs['DEPLOYMENT.md']),'GIT_PRECONDITION_REQUIRED');
 if(request.kind==='SOURCE'){check(typeof request.sourceManifest==='string'&&/^[a-f0-9]{64}$/.test(request.sourceManifest)&&Array.isArray(request.ownedPaths)&&request.ownedPaths.every(p=>safeGitPath(p)&&SOURCE(p))&&new Set(request.ownedPaths).size===request.ownedPaths.length,'GIT_SOURCE_INVALID');out.sourceManifest=request.sourceManifest;out.ownedPaths=[...request.ownedPaths].sort();}
 else check(Object.keys(out.expectedAffected).length===1&&out.expectedAffected['DEPLOYMENT.md']===out.expectedInputs['DEPLOYMENT.md'],'GIT_PRECONDITION_INVALID');
 return out;
}
export async function requestSignature(request){return sha256(new TextEncoder().encode(JSON.stringify(normalizeGitRequest(request))));}
export async function createGitGraph(rootSha,get){
 const nodes=new Map();
 async function node(prefix=''){
  if(nodes.has(prefix))return nodes.get(prefix);let sha=rootSha;
  if(prefix){const split=prefix.lastIndexOf('/'),parent=await node(split<0?'':prefix.slice(0,split)),entry=parent?.entries.find(e=>e.path===prefix.slice(split+1));if(!entry)return null;check(entry.type==='tree'&&entry.mode==='040000','GIT_PATH_NOT_DIRECTORY');sha=entry.sha;}
  const body=await get('trees',sha);check(body?.sha===sha&&body.truncated===false&&Array.isArray(body.tree),'GIT_TREE_INCOMPLETE');await verifyGitTree(body.tree,sha);
  const seen=new Set();for(const e of body.tree){check(safeGitPath(e.path)&&!e.path.includes('/')&&!seen.has(e.path),'GIT_TREE_INVALID');seen.add(e.path);}
  const value={sha,entries:body.tree.map(e=>({...e}))};nodes.set(prefix,value);return value;
 }
 async function entry(path){check(safeGitPath(path),'GIT_PATH_INVALID');const at=path.lastIndexOf('/'),parent=await node(at<0?'':path.slice(0,at));return parent?.entries.find(e=>e.path===path.slice(at+1))??null;}
 async function source(folder){const result={};for(const path of ['main.pjs','index.html']){const e=await entry(folder+'/'+path);if(e){check(regular(e),'GIT_SOURCE_NOT_REGULAR');result[path]={sha:e.sha,mode:e.mode};}}
  const pending=[folder+'/src'];while(pending.length){const prefix=pending.pop(),n=await node(prefix);if(!n)continue;for(const e of n.entries){const path=prefix+'/'+e.path;if(e.type==='tree'){check(e.mode==='040000','GIT_SOURCE_NOT_REGULAR');pending.push(path);}else{check(regular(e),'GIT_SOURCE_NOT_REGULAR');result[path.slice(folder.length+1)]={sha:e.sha,mode:e.mode};}}}return result;
 }
 await node();return {nodes,node,entry,source};
}
export async function planGitWrite({request,head,rootSha,get,sourceFiles=[],operationId,time}){
 const q=normalizeGitRequest(request);check(gitSha(head)&&gitSha(rootSha)&&typeof operationId==='string'&&/^[A-Za-z0-9._:-]+$/.test(operationId)&&Number.isFinite(time),'GIT_PLAN_INVALID');
 const graph=await createGitGraph(rootSha,get),folderEntry=await graph.entry(q.folder),desired=[],before={};
 if(q.kind==='PREPARE'){check(!folderEntry,'GIT_FOLDER_EXISTS');desired.push({path:'DEPLOYMENT.md',bytes:new TextEncoder().encode(INITIAL_MARKER)});}
 else{
  check(folderEntry?.type==='tree','GIT_FOLDER_MISSING');
  for(const [path,expected]of Object.entries(q.expectedInputs)){const e=await graph.entry(q.folder+'/'+path);check((e?.sha??null)===expected,'GIT_INPUT_CHANGED');if(e)check(regular(e),'GIT_INPUT_NOT_REGULAR');}
  for(const [path,expected]of Object.entries(q.expectedAffected)){check(q.kind==='SOURCE'?SOURCE(path):path==='DEPLOYMENT.md','GIT_WRITE_SCOPE_DENIED');const e=await graph.entry(q.folder+'/'+path);check((e?.sha??null)===expected,'GIT_AFFECTED_CHANGED');if(e)check(regular(e),'GIT_SOURCE_NOT_REGULAR');}
  const markerEntry=await graph.entry(q.folder+'/DEPLOYMENT.md'),markerBytes=await decodeGitBlob(await get('blobs',markerEntry.sha),markerEntry.sha),marker=parseDeploymentMarker(markerBytes);
  check(marker.ok&&marker.version===q.version&&marker.action===q.action&&marker.status==='READY','GIT_DECLARATION_CHANGED');
  if(q.action==='DEVELOP')for(const path of ['specification.md','ui.md','agents.md','prompt.md'])check(gitSha(q.expectedInputs[path]),'GIT_INPUT_MAP_REQUIRED');
  if(q.kind==='DONE'){const text=new TextDecoder('utf-8',{fatal:true}).decode(markerBytes);desired.push({path:'DEPLOYMENT.md',bytes:new TextEncoder().encode(text.replace(/Status: READY(?=\r?\n?$)/,'Status: DONE'))});}
  else{
   check(Array.isArray(sourceFiles)&&sourceFiles.length>=2,'GIT_SOURCE_INVALID');const seen=new Set();for(const file of sourceFiles){check(safeGitPath(file.path)&&SOURCE(file.path)&&!seen.has(file.path)&&ArrayBuffer.isView(file.bytes)&&Object.prototype.toString.call(file.bytes)==='[object Uint8Array]','GIT_SOURCE_INVALID');seen.add(file.path);desired.push({path:file.path,bytes:new Uint8Array(file.bytes),blobId:file.blobId});}
   check(seen.has('main.pjs')&&seen.has('index.html'),'GIT_SOURCE_INCOMPLETE');
   Object.assign(before,await graph.source(q.folder));const owned=new Set(q.ownedPaths);
   for(const path of Object.keys(before))check(owned.has(path),'GIT_UNOWNED_SOURCE');
   for(const path of new Set([...owned,...seen]))check(Object.hasOwn(q.expectedAffected,path),'GIT_PRECONDITION_REQUIRED');
   if(q.action==='DEPLOY')for(const path of Object.keys(before))check(Object.hasOwn(q.expectedInputs,path),'GIT_INPUT_MAP_REQUIRED');
   for(const path of owned)if(!seen.has(path))desired.push({path,deleted:true});
  }
 }
 const changed=new Set(),objects=[],outputs={},knownBlobs=new Set([...graph.nodes.values()].flatMap(n=>n.entries.filter(regular).map(e=>e.sha)));
 async function mutable(prefix){let n=await graph.node(prefix);if(n)return n;const parentAt=prefix.lastIndexOf('/'),parent=await mutable(parentAt<0?'':prefix.slice(0,parentAt)),name=prefix.slice(parentAt+1);check(!parent.entries.some(e=>e.path===name),'GIT_PATH_COLLISION');n={sha:null,entries:[]};graph.nodes.set(prefix,n);return n;}
 for(const file of desired){const full=q.folder+'/'+file.path,parentAt=full.lastIndexOf('/'),prefix=full.slice(0,parentAt),name=full.slice(parentAt+1),parent=await mutable(prefix),old=parent.entries.find(e=>e.path===name);check(!old||regular(old),'GIT_PATH_COLLISION');
  if(file.deleted&&!old){outputs[file.path]=null;continue;}parent.entries=parent.entries.filter(e=>e.path!==name);if(file.deleted)outputs[file.path]=null;else{const sha=await gitBlob(file.bytes),mode=old?.mode??'100644';outputs[file.path]={sha,mode};parent.entries.push({path:name,type:'blob',mode,sha,size:file.bytes.length});if(!knownBlobs.has(sha)){objects.push({kind:'blobs',sha,bytes:file.bytes,blobId:file.blobId});knownBlobs.add(sha);}}
  let p=prefix;while(true){changed.add(p);if(!p)break;p=p.includes('/')?p.slice(0,p.lastIndexOf('/')):'';}
 }
 const targetTree={};for(const prefix of [...changed].sort((a,b)=>b.split('/').length-a.split('/').length||b.length-a.length)){
  const n=graph.nodes.get(prefix);check(n,'GIT_PLAN_INVALID');const sha=await gitTreeOid(n.entries);targetTree[prefix]=sha;
  if(sha!==n.sha){const old=n.sha?await get('trees',n.sha):{tree:[]},newEntries=new Map(n.entries.map(e=>[e.path,e])),oldEntries=new Map(old.tree.map(e=>[e.path,e])),patch=[];for(const name of new Set([...newEntries.keys(),...oldEntries.keys()])){const a=oldEntries.get(name),b=newEntries.get(name);if(a?.sha!==b?.sha||a?.mode!==b?.mode)patch.push(b?{path:name,mode:b.mode,type:b.type,sha:b.sha}:{path:name,mode:a.mode,type:a.type,sha:null});}objects.push({kind:'trees',sha,body:{...n.sha?{base_tree:n.sha}:{},tree:patch},entries:n.entries});}
  if(prefix){const split=prefix.lastIndexOf('/'),parentPrefix=split<0?'':prefix.slice(0,split),parent=await mutable(parentPrefix),name=prefix.slice(split+1);parent.entries=parent.entries.filter(e=>e.path!==name);if(n.entries.length)parent.entries.push({path:name,mode:'040000',type:'tree',sha});}
 }
 const tree=targetTree[''];check(gitSha(tree),'GIT_PLAN_INVALID');const stamp=new Date(Math.floor(time/1000)*1000).toISOString(),seconds=Math.floor(time/1000),identity={name:'PCMS',email:'pcms@local.invalid',date:stamp},message='PCMS '+q.kind+' '+q.folder+'\n\nPCMS-Operation: '+operationId+'\n',raw='tree '+tree+'\nparent '+head+'\nauthor PCMS <pcms@local.invalid> '+seconds+' +0000\ncommitter PCMS <pcms@local.invalid> '+seconds+' +0000\n\n'+message,candidate=await gitObjectOid('commit',new TextEncoder().encode(raw));
 objects.push({kind:'commits',sha:candidate,body:{tree,parents:[head],message,author:identity,committer:identity}});
 const source=q.kind==='SOURCE'?Object.fromEntries(Object.entries(outputs).filter(([,v])=>v!==null)):await graph.source(q.folder);
 return {schema:1,request:q,baseHead:head,baseTree:rootSha,tree,candidate,operationId,time,objects,outputs,source,signature:await requestSignature(request),protectedInputs:sorted(q.expectedInputs),folderTree:targetTree[q.folder]??folderEntry?.sha??null};
}
