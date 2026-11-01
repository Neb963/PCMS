import {seeded} from './capture-fixture.mjs';
import {createBackup} from '../src/modules/backup.mjs';
import {encodeBackup} from '../src/core/backup-archive.mjs';
import {sha256} from '../src/core/records.mjs';
const bytes=s=>new TextEncoder().encode(s),event={step:'FIXTURE_ARCHIVE',result:'COMPLETE'};
export async function archiveFixture(t,size=1024*1024+25,options={}){
 const {c,name,packages}=await seeded(t),personaUid=options.personaUid??crypto.randomUUID(),containerId=options.containerId??'firefox-container-9',accountId=options.accountId??'a',email='owner@fixture.test';
 await c.mutate([{table:'accounts',id:accountId,value:{state:'READY',personaUid,containerId,...options.routeId?{routeId:options.routeId}:{},expectedPrincipal:await sha256(bytes(email))}}],event);
 const binary=Uint8Array.from({length:size},(_,i)=>(i*137+(i>>>8))&255);
 const old=await c.source([{path:'main.pjs',bytes:bytes('old 雪\r\n')},{path:'index.html',bytes:bytes('<p>old</p>')},{path:'src/雪/é.bin',bytes:binary},{path:'src/é.bin',bytes:new Uint8Array([0,255,9])}]);
 const next=await c.source([{path:'main.pjs',bytes:bytes('new exact\n')},{path:'index.html',bytes:bytes('<p>new</p>')}]);
 await c.mutate([{table:'generators',id:'g',value:{slug:'g',accountId,sourceManifest:next.manifestId,previousGood:old.manifestId},refs:[...old.refs,...next.refs]}],event);
 await c.saveView('git-catalog',{connection:{repositoryId:42}},crypto.randomUUID());await c.saveView('human-draft',{pjs:'not saved 雪\0',html:'<p>draft</p>'},crypto.randomUUID());
 await c.credentials.set('github:42','fixture-token\0雪\r\n');await createBackup({core:c,donor:{}}).initialize();await c.queue.pause();
 await c.queue.enqueue({requestId:'archive',logicalKey:'archive',moduleId:'pcms-backup',targetId:'pcms-backup',kind:'CAPTURE',input:{coverageOnly:false,participants:[]}});const j=await c.queue.next(),a=await c.read('accounts',accountId);
 const auth={adapter:'perchance-auth-1',schema:1,origin:'https://perchance.org',userPresent:true,user:{loggedIn:true,email,sessionToken:'exact\0雪😀\r\n'},guardPresent:true,sessionTokenLastChangeTime:'0001.7'};
 const cookies=[{name:'fixture',value:'a=b%20雪',domain:'.fixture.test',path:'/',hostOnly:false,httpOnly:true,secure:true,session:false,expirationDate:1234567890,firstPartyDomain:null,partitionKey:{topLevelSite:'https://example.test',hasCrossSiteAncestor:true},sameSite:'no_restriction'},{name:'session',value:'same',domain:'fixture.test',path:'/native',hostOnly:true,httpOnly:false,secure:false,session:true,expirationDate:null,firstPartyDomain:'example.test',partitionKey:null,sameSite:'lax'}];
 const donorState=options.donorState?.({accountId,personaUid,containerId})??{profiles:{[personaUid]:{managed:true,personaUid,containerId,pcmsAccountId:accountId}}};
 const receipt=await c.captureCut({captureId:'archive',guard:{moduleId:j.moduleId,generation:j.generation,jobId:j.id,jobRevision:j.rev},accounts:[{id:a.id,revision:a.rev,principalFingerprint:a.expectedPrincipal,personaUid,containerId}],external:{donor:{format:1,bootId:'boot',revision:9,storageVersion:3,startedAt:100,observedAt:110,state:donorState,storage:{local:{...options.donorState?{state:donorState}:{},nativePrivate:'fixture-only\0雪',gmValues:{exact:'GM'}},sync:{recovery:'synthetic'}},managedPersonas:[{accountId,personaUid,containerId}]},sessions:[{format:1,adapter:'perchance-auth-1',accountId,personaUid,sourceContainerId:containerId,startedAt:100,observedAt:110,auth,cookies}],witnesses:[{accountId,startedAt:100,checkedAt:115,fingerprint:await sha256(bytes(JSON.stringify(auth))),storageVersion:0,cookieVersion:0}]}});
 const raw=await c.credentials.get(receipt.credentialId),data=JSON.parse(raw);
 return {c,name,packages,data,receipt,raw,binary,old,next,encode:options=>encodeBackup(data,{receipt,readBlob:id=>c.blobStream(id),...options})};
}
