// Synthetic local records only. This file is never copied into the XPI.
export async function seedCapacity(c,{name='pcms-core',existingAccounts=0,binaryBytes=32*1024*1024,eventCount=90000,progress=()=>{}}={}) {
 const start=performance.now(),event={step:'SYNTHETIC_CAPACITY_SETUP',result:'COMPLETE'},bytes=s=>new TextEncoder().encode(s);
 let x=0x9e3779b9;const binary=new Uint8Array(binaryBytes);
 for(let i=0;i<binary.length;i++){x^=x<<13;x^=x>>>17;x^=x<<5;binary[i]=x&255;}
 const old=await c.source([{path:'main.pjs',bytes:bytes('previous exact 雪\r\n')},{path:'index.html',bytes:bytes('<p>previous</p>')},{path:'src/雪/random.bin',bytes:binary}]);
 const current=await c.source([{path:'main.pjs',bytes:bytes('current exact 雪\n')},{path:'index.html',bytes:bytes('<p>current</p>')},{path:'src/雪/random.bin',bytes:binary}]);
 const changes=[];
 for(let i=existingAccounts;i<50;i++)changes.push({table:'accounts',id:'scale-account-'+String(i).padStart(3,'0'),value:{label:'Synthetic account '+i,state:'LOGIN_REQUIRED'}});
 for(let i=0;i<1000;i++){const id='scale-generator-'+String(i).padStart(4,'0');changes.push({table:'generators',id,value:{slug:id,folder:'generators/'+id,repository:'synthetic/capacity',folderPresent:'YES',accountId:'scale-account-'+String(Math.max(existingAccounts,i%50)).padStart(3,'0'),sourceManifest:current.manifestId,previousGood:old.manifestId},refs:[...old.refs,...current.refs]});}
 for(let i=0;i<changes.length;i+=50){await c.mutate(changes.slice(i,i+50),event);progress({phase:'records',completed:Math.min(i+50,changes.length)});}
 await c.releasePin(old.pinId);await c.releasePin(current.pinId);
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const now=Date.now(),span=90*86400000;
 for(let offset=0;offset<eventCount;offset+=5000)await new Promise((resolve,reject)=>{
  const tx=db.transaction(['meta','events'],'readwrite');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>{};
  const r=tx.objectStore('meta').get('root');r.onsuccess=()=>{const root=r.result;
   for(let i=offset;i<Math.min(eventCount,offset+5000);i++){const sequence=++root.sequence,targetId='scale-generator-'+String(i%1000).padStart(4,'0');tx.objectStore('events').add({key:[root.dataset,sequence],dataset:root.dataset,id:String(sequence),sequence,time:now-span+1+Math.floor(i/(eventCount-1)*(span-1)),moduleId:'pcms-deployer',targetId,step:'SYNTHETIC_RECORDED_OPERATION',result:'COMPLETE',severity:'info',tokenKeys:[root.dataset+':synthetic_recorded_operation',root.dataset+':'+targetId]});}
   root.revision++;root.updatedAt=now;tx.objectStore('meta').put(root);
  };
 });db.close();progress({phase:'journal',completed:eventCount});
 return {accounts:50,generators:1000,eventCount,spanDays:90,binaryBytes,binaryHash:old.files.find(f=>f.path.endsWith('random.bin')).blobId,old:old.manifestId,current:current.manifestId,seedMs:performance.now()-start};
}
