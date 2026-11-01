// Privileged logical IDB cut. The caller stages external participants first.
// No provider, disk, native process or module code runs under this transaction.
export function attachCaptureCut(core,{transact,root,checkedRefs,append,req,check,clock,assertGuard,tables,stores}){
 core.captureCut=async options=>{
 const monotonic=()=>globalThis.performance?.now?.()??clock(),requestedAt=monotonic();
 const result=await transact(stores,'readwrite',async s=>{
  const {captureId,guard,accounts=[],external={}}=options??{};
  check(typeof captureId==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(captureId),'INVALID_CAPTURE');
  const startedAt=clock(),r=await root(s);check(guard?.moduleId==='pcms-backup','INVALID_GUARD');await assertGuard(s,r,guard);
  const credentialId='capture-cut-'+captureId,pinId=credentialId,prior=await req(s('credentials').get([r.dataset,credentialId]));
  if(prior?.captureData){check(prior.captureReceipt?.qualified,'CAPTURE_RECEIPT_MISSING');return {credentialId,pinId,...prior.captureReceipt,existing:true};}
  const all=async store=>{const out=[];let c=await req(s(store).openCursor());while(c){if(c.value.dataset===r.dataset||Array.isArray(c.value.key)&&c.value.key[0]===r.dataset)out.push(structuredClone(c.value));c=await req(c.continue()||c.request);}return out;};
  const records={};for(const table of tables)records[table]=await all(table);
  for(const expected of accounts){const a=records.accounts.find(a=>a.id===expected.id);check(a&&a.state==='READY'&&!a.admission&&a.rev===expected.revision&&a.expectedPrincipal===expected.principalFingerprint&&a.personaUid===expected.personaUid&&a.containerId===expected.containerId,'CAPTURE_ACCOUNT_CHANGED');}
  check(records.accounts.filter(a=>a.personaUid).every(a=>accounts.some(e=>e.id===a.id&&e.personaUid===a.personaUid&&e.containerId===a.containerId)),'CAPTURE_AUTH_COVERAGE_MISSING');
  records.jobs=records.jobs.map(job=>({...job,lease:null}));
  const versions=await all('versions'),pins=await all('pins'),views=await all('views'),commands=await all('commands'),credentials=await all('credentials'),events=await all('events');
  for(let i=0;i<versions.length;i++)if(versions[i].table==='jobs')versions[i]={...versions[i],lease:null};
  const downloadPayloads=new Set([...records.files,...versions.filter(v=>v.table==='files')].filter(f=>['journal','discover','backup'].includes(f.type)).map(f=>f.payloadId).filter(Boolean));
  const stripFile=f=>{const copy={...f,refs:(f.refs??[]).filter(id=>id!==f.payloadId)};if(copy.payloadId){delete copy.payloadId;copy.payloadAvailable=false;}return copy;};
  records.files=records.files.map(stripFile);for(let i=0;i<versions.length;i++)if(versions[i].table==='files')versions[i]=stripFile(versions[i]);
  for(const m of records.modules)for(const p of [m,m.staged,m.previous].filter(Boolean)){
   check(p.manifest&&p.packageHash&&p.manifestHash&&p.payload&&Array.isArray(p.manifest.files),'CAPTURE_PACKAGE_MISSING');
   check((m.refs??[]).includes(p.packageHash)&&(m.refs??[]).includes(p.manifestHash)&&p.manifest.files.every(file=>p.payload[file.path]===file.sha256&&(m.refs??[]).includes(file.sha256)),'CAPTURE_PACKAGE_MISSING');
  }
  const catalog=views.find(v=>v.key[1]==='git-catalog')?.value,gitName=catalog?.connection?'github:'+catalog.connection.repositoryId:null;
  check(!gitName||credentials.some(c=>c.key[1]===gitName&&typeof c.value==='string'&&c.value.length>0),'CAPTURE_GIT_CREDENTIAL_MISSING');
  const logicalCredentials=credentials.filter(c=>!c.captureData),derivedCuts=credentials.filter(c=>c.captureData).map(c=>c.key[1]);
  const pinRows=pins.filter(p=>!String(p.key[1]).startsWith('capture-cut-')).map(p=>({...p,refs:(p.refs??[]).filter(id=>!downloadPayloads.has(id))}));
  const refs=await checkedRefs(s,r,[...new Set([...Object.values(records).flat(),...versions,...pinRows].flatMap(row=>row.refs??[]))]);
  const blobs=[];for(const blobId of refs){const row=await req(s('blobs').get([r.dataset,blobId]));blobs.push({blobId,bytes:row.bytes,refs:row.refs??[]});}
  events.sort((a,b)=>a.sequence-b.sequence);const gaps=[];let next=(r.journalPrunedThrough??0)+1;for(const e of events){if(e.sequence>next)gaps.push({first:next,last:e.sequence-1});next=e.sequence+1;}if(next<=r.sequence)gaps.push({first:next,last:r.sequence});
  const finishedAt=clock();check(finishedAt-startedAt<=5000,'CAPTURE_BARRIER_EXPIRED');
  const data={format:1,captureId,createdAt:finishedAt,core:{root:structuredClone(r),records,versions,views,commands,credentials:logicalCredentials,pins:pinRows,blobs,journal:{first:(r.journalPrunedThrough??0)+1,last:r.sequence,gaps,events}},external,disclosures:{unencrypted:true,credentialInclusive:true,runtimeAuthority:['leases','boot-nonces','tab-document-chat-context','source-container-ids','route-validation'],excluded:['older-disk-export-payload-bytes','older-derived-capture-payloads','AI-site-workspaces','OS-native-process-lease-state'],derivedCuts,externalPrerequisites:['existing-PersonaMonkey-bridge','WireGuard-setup','native-allowlist']}};
  const receipt={qualified:false,dataset:r.dataset,revision:r.revision,sequence:r.sequence,startedAt,finishedAt,barrierMs:finishedAt-startedAt,blobs:blobs.length,records:Object.fromEntries(Object.entries(records).map(([k,v])=>[k,v.length])),journal:{first:data.core.journal.first,last:r.sequence,count:events.length,gaps},gitCredential:gitName?'CAPTURED':'NOT_CONFIGURED'};
  await req(s('pins').put({key:[r.dataset,pinId],refs}));
  await req(s('credentials').put({key:[r.dataset,credentialId],value:JSON.stringify(data),captureData:true,accountIds:records.accounts.map(a=>a.id),schema:1,rev:1,captureReceipt:receipt,createdAt:finishedAt,updatedAt:finishedAt}));
  await append(s,r,{moduleId:'pcms-backup',jobId:guard.jobId,step:'CAPTURE_CORE_CUT',result:'COMPLETE'});r.revision++;await req(s('meta').put({...r,updatedAt:clock()}));
  return {credentialId,pinId,...receipt};
 });
 if(result.existing){const {existing,...receipt}=result;return receipt;}
 const measured={...result,qualified:true,finishedAt:clock(),barrierMs:monotonic()-requestedAt};
 if(measured.barrierMs>5000){await core.releaseCaptureCut(options.captureId);check(false,'CAPTURE_BARRIER_EXPIRED');}
 // Persist timing after the all-store transaction has actually committed.
 // This narrow receipt write is outside that barrier and changes no cut bytes.
 await transact(['credentials','events'],'readwrite',async s=>{const r=await root(s),key=[r.dataset,result.credentialId],row=await req(s('credentials').get(key));check(row?.captureData,'CAPTURE_DATA_REMOVED');await req(s('credentials').put({...row,captureReceipt:measured}));await append(s,r,{moduleId:'pcms-backup',jobId:options.guard.jobId,step:'CAPTURE_CUT_RECEIPT',result:'COMPLETE'});r.revision++;await req(s('meta').put({...r,updatedAt:clock()}));});
 return measured;
 };
 core.releaseCaptureCut=captureId=>transact(['credentials','pins','events'],'readwrite',async s=>{const r=await root(s),key='capture-cut-'+captureId,row=await req(s('credentials').get([r.dataset,key]));if(row?.captureData)await req(s('credentials').delete([r.dataset,key]));await req(s('pins').delete([r.dataset,key]));await append(s,r,{moduleId:'pcms-backup',step:'RELEASE_CAPTURE_CUT',result:'COMPLETE'});r.revision++;await req(s('meta').put({...r,updatedAt:clock()}));});
}
