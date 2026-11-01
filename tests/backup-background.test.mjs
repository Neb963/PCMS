import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {unzipSync} from 'fflate';
import {bundledPackage} from '../scripts/bundled.mjs';
import {validateStep} from '../src/modules/bindings.mjs';
test('packaged Backup RESTORE background returns valid JSON ABI checkpoints for every finite continuation and wait',async()=>{
 const zip=unzipSync(bundledPackage('pcms-backup','Backup').zip);let module;
 runInNewContext(new TextDecoder().decode(zip['background.js']),{PCMS:{defineModule:m=>module=m},Date});
 for(const result of [{state:'CONTINUE',restoreId:'restore-one'},{state:'WAITING',restoreId:'restore-one',dueAt:123},{state:'COMPLETE',restoreId:'restore-one'},{state:'HELD',code:'RESTORE_AUTH_IMPORT_PENDING'}]){
  let name;const out=validateStep(await module.runStep({kind:'RESTORE',input:{restoreId:'restore-one'}},{action:async args=>{name=args.name;return result;}}));
  assert.equal(name,'backup.restore');assert.equal(out.kind,{CONTINUE:'checkpoint',WAITING:'wait',COMPLETE:'complete',HELD:'hold'}[result.state]);
  if(result.state==='CONTINUE'||result.state==='WAITING')assert.equal(out.checkpoint.restoreId,'restore-one');
  assert.doesNotThrow(()=>JSON.stringify(out));
 }
 const resumed=validateStep(await module.reconcile({kind:'RESTORE',input:{restoreId:'restore-one'}},{query:async args=>{assert.equal(args.name,'backup.restoreStatus');return {state:'CONTINUE',restoreId:'restore-one'};}}));
 assert.equal(resumed.kind,'checkpoint');
});

test('packaged Backup cleanup uses shared typed capability with JSON-safe disk readback outcomes',async()=>{
 const zip=unzipSync(bundledPackage('pcms-backup','Backup').zip);let module;
 runInNewContext(new TextDecoder().decode(zip['background.js']),{PCMS:{defineModule:m=>module=m},Date});
 for(const method of ['runStep','reconcile'])for(const result of [{state:'COMPLETE',fileId:'owned-file'},{state:'WAITING',fileId:'owned-file',dueAt:123},{state:'HELD',fileId:'owned-file',code:'CLEANUP_HISTORY_MISSING'}]){
  const api={};api[method==='runStep'?'action':'query']=async args=>{assert.equal(args.name,method==='runStep'?'backup.cleanup':'backup.cleanupStatus');return result;};
  const out=validateStep(await module[method]({kind:'CLEANUP',input:{fileId:'owned-file'}},api));assert.equal(out.kind,{COMPLETE:'complete',WAITING:'wait',HELD:'hold'}[result.state]);if(out.checkpoint)assert.equal(out.checkpoint.fileId,'owned-file');
 }
});
