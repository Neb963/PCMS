import {requireCore as check} from '../core/records.mjs';
// Compose one complete source set. Original Git inputs are immutable; only
// these three native src copies are replaced. prompt.md is never staged.
export async function stageInstructions(core,baselineManifest,inputManifest){
 const baseline=await core.verifySource(baselineManifest),inputs=await core.verifySource(inputManifest),names=['agents.md','prompt.md','specification.md','ui.md'];
 check(JSON.stringify(inputs.map(f=>f.path))===JSON.stringify(names),'DEVELOP_INPUT_MISSING');
 const files=new Map();for(const f of baseline)files.set(f.path,await core.bytes(f.blobId));
 for(const path of ['specification.md','ui.md','agents.md']){
  const f=inputs.find(f=>f.path===path),bytes=await core.bytes(f.blobId);try{new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{check(false,'SOURCE_TEXT_UNSUPPORTED');}
  files.set('src/'+path,bytes);
 }
 return core.source([...files].map(([path,bytes])=>({path,bytes})));
}
