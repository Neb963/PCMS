// Independent Git objects and read-only HTTPS model; no production helpers.
import {createHash} from 'node:crypto';
export const fixtureToken='disposable-fixture-github-token';
const oid=(type,bytes)=>createHash('sha1').update(type+' '+bytes.length+'\0').update(bytes).digest('hex');
export function gitModel(){
 const objects=new Map(),requests=[];let currentHead=null,truncate=false,failure=null;
 const blob=text=>{const bytes=Buffer.from(text),sha=oid('blob',bytes);objects.set('blobs/'+sha,{sha,size:bytes.length,encoding:'base64',content:bytes.toString('base64')});return {path:'',mode:'100644',type:'blob',sha,size:bytes.length};};
 const tree=entries=>{const sorted=[...entries].sort((a,b)=>Buffer.compare(Buffer.from(a.path+(a.type==='tree'?'/':'')),Buffer.from(b.path+(b.type==='tree'?'/':''))));const bytes=Buffer.concat(sorted.map(e=>Buffer.concat([Buffer.from((e.mode==='040000'?'40000':e.mode)+' '+e.path+'\0'),Buffer.from(e.sha,'hex')]))),sha=oid('tree',bytes);objects.set('trees/'+sha,{sha,truncated:false,tree:sorted});return {path:'',mode:'040000',type:'tree',sha};};
 function setFolders(folders){const dirs=Object.entries(folders).map(([slug,text])=>{const entries=[{...blob('source sentinel '+slug),path:'main.pjs'}];if(text!==null)entries.push({...blob(text),path:'DEPLOYMENT.md'});return {...tree(entries),path:slug};}),root=tree([{...tree(dirs),path:'generators'},{...blob('unrelated root sentinel'),path:'README.md'}]);const bytes=Buffer.from('tree '+root.sha+'\n'+(currentHead?'parent '+currentHead+'\n':'')+'author Fixture <fixture@example.test> 1700000000 +0000\ncommitter Fixture <fixture@example.test> 1700000000 +0000\n\nFixture catalog\n'),sha=oid('commit',bytes);objects.set('commits/'+sha,{sha,tree:{sha:root.sha}});currentHead=sha;return sha;}
 const flatten=(sha,prefix='')=>objects.get('trees/'+sha).tree.flatMap(e=>{const row={...e,path:prefix+e.path};return [row,...e.type==='tree'?flatten(e.sha,row.path+'/'):[]];});
 const response=(body,status=200,headers={})=>({status,headers:{get:k=>headers[k.toLowerCase()]??null},json:async()=>structuredClone(body)});
 async function transport(url,options){const u=new URL(url),path=u.pathname.replace('/repos/fixture/catalog','');if(u.origin!=='https://api.github.com'||!u.pathname.startsWith('/repos/fixture/catalog')||options.method!=='GET'||options.credentials!=='omit'||options.redirect!=='error')throw Error('OUT_OF_SCOPE_READ');if(options.headers.Authorization!=='Bearer '+fixtureToken)return response({},401);requests.push(path+u.search);if(failure&&(failure.path===path||failure.path==='*'))return response({},failure.status,failure.headers??{});
  if(path==='')return response({id:314159,full_name:'fixture/catalog',private:true});if(path==='/git/ref/heads/main'){const etag='"'+currentHead+'"';return options.headers['If-None-Match']===etag?response(null,304,{etag}):response({ref:'refs/heads/main',object:{type:'commit',sha:currentHead}},200,{etag});}
  const key=path.slice('/git/'.length),object=objects.get(key);if(!object)return response({},404);if(u.search==='?recursive=1')return response({...object,truncated:truncate,tree:flatten(object.sha).slice(0,truncate?2:undefined)});return response(object);
 }
 return {setFolders,transport,requests,objects,get head(){return currentHead;},truncate:v=>truncate=v,fail:v=>failure=v};
}
