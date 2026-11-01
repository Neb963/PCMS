import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {seeded} from './capture-fixture.mjs';
import {encodeBackup,validateBackup} from '../src/core/backup-archive.mjs';
import {createBackup} from '../src/modules/backup.mjs';
import {sha256} from '../src/core/records.mjs';
const bytes=s=>new TextEncoder().encode(s),hash=b=>createHash('sha256').update(b).digest('hex');
const event={step:'FIXTURE_ARCHIVE',result:'COMPLETE'};
export async function archiveFixture(t,size=1024*1024+25){
 const {c,name,packages}=await seeded(t),personaUid=crypto.randomUUID(),containerId='firefox-container-9',email='owner@fixture.test';
 await c.mutate([{table:'accounts',id:'a',value:{state:'READY',personaUid,containerId,expectedPrincipal:await sha256(bytes(email))}}],event);
 const binary=Uint8Array.from({length:size},(_,i)=>(i*137+(i>>>8))&255);
 const old=await c.source([{path:'main.pjs',bytes:bytes('old 雪\r\n')},{path:'index.html',bytes:bytes('<p>old</p>')},{path:'src/雪/é.bin',bytes:binary},{path:'src/é.bin',bytes:new Uint8Array([0,255,9])}]);
 const next=await c.source([{path:'main.pjs',bytes:bytes('new exact\n')},{path:'index.html',bytes:bytes('<p>new</p>')}]);
 await c.mutate([{table:'generators',id:'g',value:{slug:'g',accountId:'a',sourceManifest:next.manifestId,previousGood:old.manifestId},refs:[...old.refs,...next.refs]}],event);
 await c.saveView('git-catalog',{connection:{repositoryId:42}},crypto.randomUUID());await c.saveView('human-draft',{pjs:'not saved 雪\0',html:'<p>draft</p>'},crypto.randomUUID());
 await c.credentials.set('github:42','fixture-token\0雪\r\n');await createBackup({core:c,donor:{}}).initialize();await c.queue.pause();
 await c.queue.enqueue({requestId:'archive',logicalKey:'archive',moduleId:'pcms-backup',targetId:'pcms-backup',kind:'CAPTURE',input:{coverageOnly:false,participants:[]}});const j=await c.queue.next(),a=await c.read('accounts','a');
 const auth={adapter:'perchance-auth-1',schema:1,origin:'https://perchance.org',userPresent:true,user:{loggedIn:true,email,sessionToken:'exact\0雪😀\r\n'},guardPresent:true,sessionTokenLastChangeTime:'0001.7'};
 const cookies=[{name:'fixture',value:'a=b%20雪',domain:'.fixture.test',path:'/',hostOnly:false,httpOnly:true,secure:true,session:false,expirationDate:1234567890,firstPartyDomain:null,partitionKey:{topLevelSite:'https://example.test',hasCrossSiteAncestor:true},sameSite:'no_restriction'},{name:'session',value:'same',domain:'fixture.test',path:'/native',hostOnly:true,httpOnly:false,secure:false,session:true,expirationDate:null,firstPartyDomain:'example.test',partitionKey:null,sameSite:'lax'}];
 const receipt=await c.captureCut({captureId:'archive',guard:{moduleId:j.moduleId,generation:j.generation,jobId:j.id,jobRevision:j.rev},accounts:[{id:a.id,revision:a.rev,principalFingerprint:a.expectedPrincipal,personaUid,containerId}],external:{donor:{format:1,bootId:'boot',revision:9,storageVersion:3,startedAt:100,observedAt:110,state:{profiles:{[personaUid]:{managed:true,personaUid,containerId,pcmsAccountId:'a'}}},storage:{local:{nativePrivate:'fixture-only\0雪',gmValues:{exact:'GM'}},sync:{recovery:'synthetic'}},managedPersonas:[{accountId:'a',personaUid,containerId}]},sessions:[{format:1,adapter:'perchance-auth-1',accountId:'a',personaUid,sourceContainerId:containerId,startedAt:100,observedAt:110,auth,cookies}],witnesses:[{accountId:'a',startedAt:100,checkedAt:115,fingerprint:await sha256(bytes(JSON.stringify(auth))),storageVersion:0,cookieVersion:0}]}});
 const raw=await c.credentials.get(receipt.credentialId),data=JSON.parse(raw);
 return {c,name,packages,data,receipt,raw,binary,old,next,encode:options=>encodeBackup(data,{receipt,readBlob:id=>c.blobStream(id),...options})};
}
const independent=String.raw`
import sys,io,zipfile,json,hashlib,base64
z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))
assert z.testzip() is None
m=json.loads(z.read("manifest.json")); end=json.loads(z.read("COMPLETE.json"))
assert end["manifestSha256"]==hashlib.sha256(z.read("manifest.json")).hexdigest()
assert end["validatedEntries"]==len(z.infolist())-1
for d in m["entries"]:
 b=z.read(d["path"])
 assert len(b)==d["bytes"] and hashlib.sha256(b).hexdigest()==d["sha256"]
print(json.dumps({"entries":len(z.infolist()),"methods":sorted(set(i.compress_type for i in z.infolist())),"zip64":any(i.extract_version>=45 for i in z.infolist()),"binary":{i.filename:hashlib.sha256(z.read(i)).hexdigest() for i in z.infolist() if i.filename.startswith("blobs/")}}))
`;
function python(script,input){return execFileSync('python3',['-c',script],{input,maxBuffer:96*1024*1024});}
const rewriteScript=String.raw`
import sys,io,zipfile,json,base64,hashlib,warnings
warnings.filterwarnings("ignore",category=UserWarning)
q=json.load(sys.stdin); z=zipfile.ZipFile(io.BytesIO(base64.b64decode(q["zip"])))
entries=[(i.filename,z.read(i)) for i in z.infolist()]
op=q["operation"]
if op=="missing": entries=[(p,b) for p,b in entries if p!="credentials.json"]
elif op=="unsafe": entries.append(("../escape",b"x"))
elif op=="duplicate": entries.append(("credentials.json",z.read("credentials.json")))
else:
 out=[]
 for p,b in entries:
  if op=="credential" and p=="credentials.json":
   rows=json.loads(b); b=json.dumps([r for r in rows if r["key"][1]!="github:42"],ensure_ascii=False).encode()
  if op=="schema" and p=="records/meta.json":
   v=json.loads(b); v["root"]["schema"]=99; b=json.dumps(v,ensure_ascii=False).encode()
  if op=="closure" and p=="records/blobs.ndjson":
   rows=[json.loads(x) for x in b.splitlines()]; rows.pop(); b=b"".join(json.dumps(r).encode()+b"\n" for r in rows)
  if op=="secret" and p.startswith("auth/") and p.endswith(".json"):
   v=json.loads(b); v["auth"]["user"].pop("sessionToken"); b=json.dumps(v,ensure_ascii=False).encode()
  if op=="sha" and p=="credentials.json": b=b.replace(b"fixture-token",b"fixture-tokeN")
  out.append((p,b))
 entries=out
 if op!="sha":
  content=dict(entries); m=json.loads(content["manifest.json"])
  for d in m["entries"]:
   raw=content[d["path"]]; d["bytes"]=len(raw); d["sha256"]=hashlib.sha256(raw).hexdigest()
  raw=json.dumps(m).encode(); content["manifest.json"]=raw
  e=json.loads(content["COMPLETE.json"]); e["manifestSha256"]=hashlib.sha256(raw).hexdigest(); content["COMPLETE.json"]=json.dumps(e).encode()
  entries=[(p,content[p]) for p,b in entries]
o=io.BytesIO()
with zipfile.ZipFile(o,"w",compression=zipfile.ZIP_DEFLATED) as w:
 for p,b in entries: w.writestr(p,b)
sys.stdout.buffer.write(o.getvalue())
`;
async function rewritten(blob,operation){return new Blob([python(rewriteScript,JSON.stringify({zip:Buffer.from(await blob.arrayBuffer()).toString('base64'),operation}))]);}
test('production ZIP64 codec preserves exact full cut and large binary/history; Python independently reads CRCs, bytes and manifest',async t=>{
 const f=await archiveFixture(t,20*1024*1024+25),encoded=await f.encode({forceZip64:true}),raw=new Uint8Array(await encoded.blob.arrayBuffer()),oracle=JSON.parse(python(independent,raw));
 assert.equal(encoded.state,'COMPLETE');assert.equal(encoded.bytes,raw.length);assert.equal(encoded.sha256,hash(raw));assert.equal(oracle.zip64,true);assert.ok(Buffer.from(raw).includes(Buffer.from([0x50,0x4b,0x06,0x06])));assert.ok(oracle.methods.includes(8));
 assert.equal(oracle.binary['blobs/'+hash(f.binary)],hash(f.binary));
 const checked=await validateBackup(encoded.blob);assert.deepEqual(JSON.parse(JSON.stringify(checked.data)),f.data);
 const reread=await checked.read('blobs/'+hash(f.binary));assert.deepEqual(new Uint8Array(await reread.arrayBuffer()),f.binary);
 assert.equal(checked.data.core.root.paused,true);assert.equal(checked.data.core.credentials.find(r=>r.key[1]==='github:42').value,'fixture-token\0雪\r\n');
 assert.equal(checked.data.external.sessions[0].auth.user.sessionToken,'exact\0雪😀\r\n');
 for(const pkg of f.packages)assert.deepEqual(new Uint8Array(await (await checked.read('modules/'+pkg.id+'/'+pkg.packageHash+'.zip')).arrayBuffer()),pkg.zip);
 assert.equal(await f.c.credentials.get(f.receipt.credentialId),f.raw);
});
test('checksum-consistent malformed capture sections, required secrets, closure, schema and unsafe/duplicate paths reject before any writes',async t=>{
 const f=await archiveFixture(t,50),encoded=await f.encode();
 for(const operation of ['missing','unsafe','duplicate','credential','schema','closure','secret','sha'])await t.test(operation,async()=>{await assert.rejects(validateBackup(await rewritten(encoded.blob,operation)));assert.equal(await f.c.credentials.get(f.receipt.credentialId),f.raw);});
});
test('corrupt CRC/local headers, truncated/appended ZIP, missing immutable bytes, unqualified cut, budget and cancellation stay incomplete',async t=>{
 const f=await archiveFixture(t,50),encoded=await f.encode(),raw=new Uint8Array(await encoded.blob.arrayBuffer());
 const p=new Uint8Array(raw);p[30]^=1;await assert.rejects(validateBackup(new Blob([p])));
 await assert.rejects(validateBackup(new Blob([raw.subarray(0,raw.length-3)])));await assert.rejects(validateBackup(new Blob([raw,new Uint8Array([1,2])])));
 const corrupt=python(String.raw`
import sys,io,zipfile
b=bytearray(sys.stdin.buffer.read());z=zipfile.ZipFile(io.BytesIO(b));i=next(i for i in z.infolist() if i.filename.startswith("modules/"))
p=i.header_offset; n=int.from_bytes(b[p+26:p+28],"little");x=int.from_bytes(b[p+28:p+30],"little");b[p+30+n+x]^=1
sys.stdout.buffer.write(b)
`,raw);await assert.rejects(validateBackup(new Blob([corrupt])));
 await assert.rejects(f.encode({receipt:{...f.receipt,qualified:false}}),e=>e.code==='ARCHIVE_CUT_UNQUALIFIED');
 await assert.rejects(f.encode({budget:{totalBytes:100}}),e=>e.code==='ARCHIVE_BUDGET_EXCEEDED');
 await assert.rejects(validateBackup(encoded.blob,{budget:{metadataBytes:100}}),e=>e.code==='ARCHIVE_BUDGET_EXCEEDED');
 await assert.rejects(f.encode({readBlob:()=>new Blob([new Uint8Array([1])]).stream()}),e=>e.code==='ARCHIVE_BLOB_MISMATCH');
 const controller=new AbortController();controller.abort();await assert.rejects(f.encode({signal:controller.signal}),e=>e.code==='ARCHIVE_INTERRUPTED');
 assert.equal(await f.c.credentials.get(f.receipt.credentialId),f.raw);assert.equal((await f.c.queue.status()).paused,true);
});
