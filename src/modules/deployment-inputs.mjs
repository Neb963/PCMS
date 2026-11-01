import {requireCore as check,sha256} from '../core/records.mjs';
import {createGitReader,decodeGitBlob,verifyGitTree,gitSha} from '../core/git-reader.mjs';
import {parseDeploymentMarker} from '../core/deployment-marker.mjs';
import {sourcePaths,lfsPointer} from '../core/source-set.mjs';

// Immutable, verified input objects. This reader never changes a ref or uses a
// mutable path download. Catalog revision is checked again by the caller.
export function createDeploymentInputs({core,read=createGitReader()}){
 return async (g,{fresh=false}={})=>{
  const connection=(await core.view('git-catalog'))?.connection;
  check(connection?.repositoryId===g.repositoryId,'GIT_REPOSITORY_CHANGED');
  check(gitSha(g.folderTreeSha)&&gitSha(g.catalogHead),'GIT_INPUT_MAP_REQUIRED');
  const token=await core.credentials.get('github:'+g.repositoryId),cache=new Map();
  const object=async(kind,sha)=>{const key=kind+':'+sha;if(!cache.has(key)){
   const body=(await read({repository:connection.repository,token,path:'/git/'+kind+'/'+sha})).body;
   check(body?.sha===sha,'GIT_OBJECT_INVALID');cache.set(key,body);
  }return cache.get(key);};
  const tree=async sha=>{const body=await object('trees',sha);check(body.truncated===false&&Array.isArray(body.tree),'GIT_TREE_INCOMPLETE');await verifyGitTree(body.tree,sha);return body.tree;};
  if(fresh){
   const ref=(await read({repository:connection.repository,token,path:'/git/ref/heads/main'})).body;
   check(ref?.ref==='refs/heads/main'&&ref.object?.type==='commit'&&gitSha(ref.object.sha),'GIT_MAIN_UNVERIFIED');
   const commit=await object('commits',ref.object.sha);check(gitSha(commit.tree?.sha),'GIT_MAIN_UNVERIFIED');
   let sha=commit.tree.sha;for(const name of g.folder.split('/')){const e=(await tree(sha)).find(e=>e.path===name);check(e?.type==='tree'&&e.mode==='040000','GIT_FOLDER_MISSING');sha=e.sha;}
   g={...g,folderTreeSha:sha,catalogHead:ref.object.sha};
  }
  const entries=await tree(g.folderTreeSha),marker=entries.find(e=>e.path==='DEPLOYMENT.md');
  const regular=e=>e?.type==='blob'&&['100644','100755'].includes(e.mode);
  check(regular(marker)&&(fresh||marker.sha===g.markerSha),'GIT_DECLARATION_CHANGED');
  const parsed=parseDeploymentMarker(await decodeGitBlob(await object('blobs',marker.sha),marker.sha));
  check(parsed.ok&&(fresh||parsed.version===g.markerVersion&&parsed.action===g.markerAction&&parsed.status===g.markerStatus),'GIT_DECLARATION_CHANGED');
  const wanted=[];
  if(parsed.action==='DEVELOP')for(const path of ['specification.md','ui.md','agents.md','prompt.md']){const e=entries.find(e=>e.path===path);check(regular(e),'DEVELOP_INPUT_MISSING');wanted.push({...e,path});}
  else {
   for(const path of ['main.pjs','index.html']){const e=entries.find(e=>e.path===path);check(regular(e),'DEPLOY_SOURCE_MISSING');wanted.push({...e,path});}
   const src=entries.find(e=>e.path==='src'),pending=[];if(src){check(src.type==='tree'&&src.mode==='040000','GIT_SOURCE_NOT_REGULAR');pending.push({sha:src.sha,prefix:'src/'});}
   while(pending.length){const {sha,prefix}=pending.pop();for(const e of await tree(sha)){
    check(typeof e.path==='string'&&!e.path.includes('/')&&e.path!=='.'&&e.path!=='..','SOURCE_PATH_UNSUPPORTED');
    if(e.type==='tree'){check(e.mode==='040000','GIT_SOURCE_NOT_REGULAR');pending.push({sha:e.sha,prefix:prefix+e.path+'/'});}else{check(regular(e),'GIT_SOURCE_NOT_REGULAR');wanted.push({...e,path:prefix+e.path});}
   }}sourcePaths(wanted.map(e=>e.path));
  }
  const files=[];for(const e of wanted.sort((a,b)=>a.path<b.path?-1:1)){
   const bytes=await decodeGitBlob(await object('blobs',e.sha),e.sha);check(!lfsPointer(bytes),'SOURCE_LFS_POINTER');
   if(parsed.action==='DEVELOP'||['main.pjs','index.html'].includes(e.path))try{new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{check(false,'SOURCE_TEXT_UNSUPPORTED');}
   files.push({path:e.path,bytes,gitSha:e.sha});
  }
  const inputHash=await sha256(new TextEncoder().encode(JSON.stringify([parsed.action,...await Promise.all(files.map(async f=>[f.path,f.bytes.length,await sha256(f.bytes)]))])));
  const source=await core.source(files);return {...source,inputHash,commit:g.catalogHead,version:parsed.version,action:parsed.action,status:parsed.status,expectedInputs:Object.fromEntries([['DEPLOYMENT.md',marker.sha],...files.map(f=>[f.path,f.gitSha])])};
 };
}
