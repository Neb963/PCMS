// Independent Git object/history backend for the packaged writer. No product
// reducers/planners are used to compute object IDs, ancestry or ref outcomes.
import {createHash} from 'node:crypto';
import {fixtureToken} from './git-model.mjs';
const oid=(kind,b)=>createHash('sha1').update(kind+' '+b.length+'\0').update(b).digest('hex');
export function gitWriteModel(){
 const objects=new Map(),calls=[];let tip=null,lose=null,hide=false,beforeRef=null,block=null,denied=null;
 const response=(body,status=200)=>({status,headers:{get:()=>null},json:async()=>structuredClone(body)});
 function blob(bytes){bytes=Buffer.from(bytes);const sha=oid('blob',bytes);objects.set('blobs/'+sha,{sha,size:bytes.length,encoding:'base64',content:bytes.toString('base64')});return sha;}
 function tree(entries){const sorted=[...entries].sort((a,b)=>Buffer.compare(Buffer.from(a.path+(a.type==='tree'?'/':'')),Buffer.from(b.path+(b.type==='tree'?'/':'')))),bytes=Buffer.concat(sorted.map(e=>Buffer.concat([Buffer.from((e.mode==='040000'?'40000':e.mode)+' '+e.path+'\0'),Buffer.from(e.sha,'hex')]))),sha=oid('tree',bytes);objects.set('trees/'+sha,{sha,truncated:false,tree:sorted});return sha;}
 function commit(body){const a=body.author,c=body.committer,raw=Buffer.from('tree '+body.tree+'\n'+body.parents.map(p=>'parent '+p+'\n').join('')+'author '+a.name+' <'+a.email+'> '+Math.floor(Date.parse(a.date)/1000)+' +0000\ncommitter '+c.name+' <'+c.email+'> '+Math.floor(Date.parse(c.date)/1000)+' +0000\n\n'+body.message),sha=oid('commit',raw);objects.set('commits/'+sha,{sha,tree:{sha:body.tree},parents:body.parents.map(sha=>({sha})),message:body.message,author:a,committer:c});return sha;}
 const actor={name:'Independent fixture',email:'fixture@example.test',date:'2023-11-14T22:13:20.000Z'};
 function setFiles(files,parent=tip){const root={children:new Map()};for(const [path,v]of Object.entries(files)){const value=typeof v==='string'||ArrayBuffer.isView(v)?{bytes:v}:v,parts=path.split('/');let node=root;for(const p of parts.slice(0,-1)){if(!node.children.has(p))node.children.set(p,{children:new Map()});node=node.children.get(p);}node.children.set(parts.at(-1),{mode:value.mode??'100644',type:'blob',sha:blob(value.bytes)});}
  function build(node){return tree([...node.children].map(([path,v])=>v.children?{path,mode:'040000',type:'tree',sha:build(v)}:{path,...v}));}
  tip=commit({tree:build(root),parents:parent?[parent]:[],author:actor,committer:actor,message:'Independent fixture history\n'});return tip;
 }
 function files(head=tip){const result={};function walk(sha,prefix=''){for(const e of objects.get('trees/'+sha).tree)if(e.type==='tree')walk(e.sha,prefix+e.path+'/');else result[prefix+e.path]={bytes:Buffer.from(objects.get('blobs/'+e.sha).content,'base64'),mode:e.mode,sha:e.sha};}walk(objects.get('commits/'+head).tree.sha);return result;}
 function edit(path,bytes){const all=files();all[path]={bytes};return setFiles(all);}
 function ancestors(head){const result=new Set(),pending=[head];while(pending.length){const sha=pending.pop();if(result.has(sha))continue;const row=objects.get('commits/'+sha);if(!row)throw Error('INDEPENDENT_HISTORY_MISSING');result.add(sha);pending.push(...row.parents.map(p=>p.sha));}return result;}
 async function transport(url,options){const u=new URL(url),path=u.pathname.replace('/repos/fixture/catalog','');if(u.origin!=='https://api.github.com'||!u.pathname.startsWith('/repos/fixture/catalog')||options.headers.Authorization!=='Bearer '+fixtureToken||options.credentials!=='omit'||options.redirect!=='error')throw Error('UNSCOPED_OR_UNAUTHENTICATED');const method=options.method??'GET';
  if(method==='GET'){if(path==='/git/ref/heads/main')return response({ref:'refs/heads/main',object:{type:'commit',sha:tip}});if(path.startsWith('/compare/')){const [base,head]=path.slice('/compare/'.length).split('...'),a=ancestors(base),b=ancestors(head),common=[...a].find(x=>b.has(x));if(!common)return response({},409);return response({base_commit:{sha:base},merge_base_commit:{sha:common},status:base===head?'identical':b.has(base)?'ahead':a.has(head)?'behind':'diverged'});}const body=objects.get(path.slice('/git/'.length));return body&&!hide?response(body):response({},404);}
  const kind=path==='/git/refs/heads/main'?'ref':path.slice('/git/'.length),body=JSON.parse(options.body);if(!['blobs','trees','commits','ref'].includes(kind)||method!==(kind==='ref'?'PATCH':'POST'))throw Error('UNSCOPED_WRITE');
  calls.push({kind,body});if(denied===kind)return response({},403);
  if(block?.kind===kind){block.started();await block.pending;block=null;}
  if(lose==='before-ref'&&kind==='ref'){lose=null;throw Error('lost before independent ref effect');}
  let sha;if(kind==='blobs'){if(body.encoding!=='base64')return response({},422);sha=blob(Buffer.from(body.content,'base64'));}
  if(kind==='trees'){const entries=new Map((body.base_tree?objects.get('trees/'+body.base_tree).tree:[]).map(e=>[e.path,e]));for(const e of body.tree){if(e.path.includes('/')||!objects.has((e.type==='tree'?'trees':'blobs')+'/'+e.sha)&&e.sha!==null)throw Error('BAD_INDEPENDENT_TREE_WRITE');if(e.sha===null)entries.delete(e.path);else entries.set(e.path,e);}sha=tree([...entries.values()]);}
  if(kind==='commits')sha=commit(body);
  if(kind==='ref'){if(body.force!==false||Object.keys(body).sort().join(',')!=='force,sha')throw Error('FORCED_OR_FAKE_CAS_REF');if(beforeRef){const hook=beforeRef;beforeRef=null;hook();}if(!ancestors(body.sha).has(tip))return response({},422);tip=body.sha;sha=tip;}
  if(lose===kind){lose=null;throw Error('lost after independent effect');}
  return kind==='ref'?response({ref:'refs/heads/main',object:{type:'commit',sha}}):response({sha},201);
 }
 return {objects,calls,transport,setFiles,files,edit,get head(){return tip;},lose:kind=>lose=kind,hide:value=>hide=value,deny:kind=>denied=kind,beforeRef:fn=>beforeRef=fn,reachableOperations:()=>[...ancestors(tip)].map(sha=>objects.get('commits/'+sha)).filter(c=>c.message.includes('PCMS-Operation:')),block:kind=>{let started,finish;const begin=new Promise(r=>started=r),pending=new Promise(r=>finish=r);block={kind,started,pending};return {begin,finish};}};
}
