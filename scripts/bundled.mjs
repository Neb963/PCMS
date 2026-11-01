// Deterministic, locally packaged first-party module baselines. No provider
// workflow or deceptive UI is activated before its implementing phase.
import {bundledContract} from '../src/modules/bundled-contract.mjs';
import {zipSync,strToU8} from 'fflate';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {readFileSync} from 'node:fs';
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
 async runStep(job,api){return this.outcome(await api.action({name:job.kind==='CLEANUP'?'journal.cleanup':'journal.export'}));},
 async reconcile(job,api){const result=await api.query({name:job.kind==='CLEANUP'?'journal.cleanupStatus':'journal.status'});if(['NOT_STARTED','READY'].includes(result.state))return {kind:'checkpoint',checkpoint:job.checkpoint};return this.outcome(result);},
 outcome(result){if(result.state==='COMPLETE')return {kind:'complete',checkpoint:{fileId:result.fileId}};if(result.state==='WAITING')return {kind:'wait',dueAt:result.dueAt,checkpoint:{fileId:result.fileId}};return {kind:'hold',reason:result.code||'DOWNLOAD_PENDING',recovery:{action:'RECHECK'},checkpoint:{fileId:result.fileId}};},
 stop(){}
});\n`;
const accounts=`PCMS.defineModule({
 start(){},
 async runStep(job,api){return this.outcome(await api.action({name:'accounts.step'}));},
 async reconcile(job,api){return this.outcome(await api.query({name:'accounts.status'}));},
 outcome(result){if(result.state==='COMPLETE')return {kind:'complete',checkpoint:{accountId:result.accountId}};if(['READY','CONTINUE'].includes(result.state))return {kind:'checkpoint',checkpoint:{accountId:result.accountId}};return {kind:'hold',reason:result.code||'ACCOUNT_OUTCOME_UNKNOWN',recovery:{action:'RECHECK'},checkpoint:{accountId:result.accountId}};},
 stop(){}
});\n`;
const discover=`PCMS.defineModule({
 start(){},
 async runStep(job,api){return job.kind==='GIT_PREPARE'?this.gitOutcome(await api.action({name:'github.prepareFolder'})):this.outcome(await api.action({name:'discover.step'}));},
 async reconcile(job,api){return job.kind==='GIT_PREPARE'?this.gitOutcome(await api.query({name:'github.prepareFolderStatus'})):this.outcome(await api.query({name:'discover.status'}));},
 gitOutcome(result){if(result.state==='COMPLETE')return {kind:'complete',checkpoint:{commit:result.receipt.commit}};if(['READY','CONTINUE'].includes(result.state))return {kind:'checkpoint'};return {kind:'hold',reason:result.code||'GIT_WRITE_OUTCOME_UNKNOWN',recovery:{action:['DISCOVER_BATCH_PAUSED','BATCH_PAUSED'].includes(result.code)?'OPEN_DISCOVER':'CHECK_GIT'}};},
 outcome(result){if(result.state==='COMPLETE')return {kind:'complete'};if(['READY','WAITING'].includes(result.state))return {kind:'wait',dueAt:result.dueAt||Date.now()};return {kind:'hold',reason:result.code||'DISCOVER_NEEDS_ATTENTION',recovery:{action:'OPEN_DISCOVER'}};},
 stop(){}
});\n`;
const source=`PCMS.defineModule({
 start(){},
 async runStep(job,api){return this.outcome(await api.action({name:'source.step'}));},
 async reconcile(job,api){return this.outcome(await api.query({name:'source.status'}));},
 outcome(result){if(result.state==='COMPLETE')return {kind:'complete',checkpoint:{generatorId:result.generatorId}};if(result.state==='WAITING')return {kind:'wait',dueAt:result.dueAt};if(result.state==='CONTINUE')return {kind:'checkpoint',checkpoint:{phase:result.phase}};return {kind:'hold',reason:result.code||'SOURCE_NEEDS_ATTENTION',recovery:{action:'OPEN_SOURCE'}};},
 stop(){}
});\n`;
const creator=`PCMS.defineModule({
 start(){},
 async runStep(job,api){return this.outcome(await api.action({name:'creator.step'}));},
 async reconcile(job,api){return this.outcome(await api.query({name:'creator.status'}));},
 outcome(result){if(result.state==='COMPLETE')return {kind:'complete',checkpoint:{generatorId:result.generatorId}};if(result.state==='WAITING')return {kind:'wait',dueAt:result.dueAt};if(result.state==='CONTINUE')return {kind:'checkpoint',checkpoint:{phase:result.phase}};return {kind:'hold',reason:result.code||'CREATOR_NEEDS_ATTENTION',recovery:{action:'OPEN_GENERATOR'},checkpoint:{phase:result.phase}};},
 stop(){}
});\n`;
const stamp=new Date('1980-01-01T00:00:00.000Z');
export function bundledPackage(id,name){
 const definition=bundledContract[id],background=strToU8(id==='pcms-journal'?journal:id==='pcms-accounts'?accounts:id==='pcms-discover'?discover:id==='pcms-creator'?creator:id==='pcms-deployer'?source:pending);
 const manifest={format:1,id,name,version:definition.version,coreApi:1,jobSchema:1,
  readsJobSchemas:[1],capabilities:[...definition.capabilities],entries:{background:'background.js'},
  pages:[],settingsSchema:1,files:[{path:'background.js',bytes:background.length,sha256:sha(background)}]};
 const payload={'background.js':[background,{mtime:stamp}]};
 if(id==='pcms-discover'){
  for(const [file,source]of [['page.html','discover-page.html'],['page.js','discover-page.js'],['page.css','discover-page.css']]){
   const bytes=new Uint8Array(readFileSync(new URL('../src/modules/'+source,import.meta.url)));payload[file]=[bytes,{mtime:stamp}];manifest.files.push({path:file,bytes:bytes.length,sha256:sha(bytes)});
  }
  manifest.pages=[{id:'check-slugs',title:'Check slugs',html:'page.html',script:'page.js',style:'page.css'}];
 }
 const manifestBytes=strToU8(JSON.stringify(manifest));
 const zip=zipSync({'module.json':[manifestBytes,{mtime:stamp}],
  ...payload},{level:6});
 return {id,name,manifest,zip,manifestHash:sha(manifestBytes),packageHash:sha(zip)};
}
export async function writeBundledPackages(stage){
 const output=path.join(stage,'bundled');await mkdir(output,{recursive:true});
 const packages=FIRST_PARTY.map(([id,name])=>bundledPackage(id,name));
 for(const item of packages)await writeFile(path.join(output,item.id+'.zip'),item.zip);
 await writeFile(path.join(output,'registry.json'),JSON.stringify({schema:1,packages:packages.map(({id,packageHash,manifestHash})=>({id,packageHash,manifestHash}))},null,2)+'\n');
 return packages;
}
