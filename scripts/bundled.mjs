// Deterministic, locally packaged first-party module baselines. No provider
// workflow or deceptive UI is activated before its implementing phase.
import {zipSync,strToU8} from 'fflate';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const FIRST_PARTY=[
 ['pcms-accounts','Accounts'],['pcms-discover','Discover'],
 ['pcms-creator','Creator'],['pcms-deployer','Deployer'],
 ['pcms-refresher','Refresher'],['pcms-journal','Journal'],
 ['pcms-backup','Backup']
];
// Background initialization is inert. Unexpected queued jobs are held, not
// represented as completed work or dispatched to a provider.
const pending=`PCMS.defineModule({
 start(){},
 runStep(){return {kind:'hold',reason:'MODULE_NOT_IMPLEMENTED',recovery:{action:'OPEN_MODULES'}};},
 reconcile(job){return {kind:'checkpoint',checkpoint:job.checkpoint??null};},
 stop(){}
});\n`;
const journal=`PCMS.defineModule({
 start(){},
 async runStep(job,api){const result=await api.action({name:'journal.export'});return result.state==='COMPLETE'?{kind:'complete',checkpoint:{fileId:result.fileId}}:{kind:'hold',reason:result.code||'DOWNLOAD_PENDING',recovery:{action:'OPEN_JOURNAL'},checkpoint:{fileId:result.fileId}};},
 async reconcile(job,api){const result=await api.query({name:'journal.status'});if(result.state==='NOT_STARTED')return {kind:'checkpoint',checkpoint:job.checkpoint};return result.state==='COMPLETE'?{kind:'complete',checkpoint:{fileId:result.fileId}}:{kind:'hold',reason:result.code||'DOWNLOAD_PENDING',recovery:{action:'OPEN_JOURNAL'},checkpoint:{fileId:result.fileId}};},
 stop(){}
});\n`;
const stamp=new Date('1980-01-01T00:00:00.000Z');
export function bundledPackage(id,name){
 const isJournal=id==='pcms-journal',background=strToU8(isJournal?journal:pending);
 const manifest={format:1,id,name,version:isJournal?'0.2.0':'0.1.0',coreApi:1,jobSchema:1,
  readsJobSchemas:[1],capabilities:isJournal?['journal.query','journal.export']:[],entries:{background:'background.js'},
  pages:[],settingsSchema:1,files:[{path:'background.js',bytes:background.length,sha256:sha(background)}]};
 const manifestBytes=strToU8(JSON.stringify(manifest));
 const zip=zipSync({'module.json':[manifestBytes,{mtime:stamp}],
  'background.js':[background,{mtime:stamp}]},{level:6});
 return {id,name,manifest,zip,manifestHash:sha(manifestBytes),packageHash:sha(zip)};
}
export async function writeBundledPackages(stage){
 const output=path.join(stage,'bundled');await mkdir(output,{recursive:true});
 const packages=FIRST_PARTY.map(([id,name])=>bundledPackage(id,name));
 for(const item of packages)await writeFile(path.join(output,item.id+'.zip'),item.zip);
 await writeFile(path.join(output,'registry.json'),JSON.stringify({schema:1,packages:packages.map(({id,packageHash,manifestHash})=>({id,packageHash,manifestHash}))},null,2)+'\n');
 return packages;
}
