export const CAPABILITIES=new Set(['records.accounts','jobs.accounts','persona.prepare','persona.check','persona.open','persona.repair','records.discover','jobs.discover','perchance.classify','perchance.ownership','perchance.create','perchance.source','github.prepareFolder','records.creator','jobs.creator','records.deployer','jobs.deployer','records.refresher','jobs.refresher','journal.query','journal.export','journal.cleanup','backup.capture','backup.captureCut','backup.export','backup.restore']);
export function bindingAllows(binding,{source,channel,current,targetId,operation}) {
 if(source!==binding.window||channel!==binding.channel||!current?.enabled||current.lifecycle||current.id!==binding.moduleId||current.packageHash!==binding.hash||current.generation!==binding.generation)return false;
 if(targetId&&binding.targetId&&targetId!==binding.targetId)return false;
 return binding.capabilities.has(operation);
}
export function websiteSenderMatches(binding,sender,world,bootId) {
 return !!binding&&typeof binding.documentId==='string'&&binding.documentId.length>0&&binding.bootId===bootId&&binding.world===world&&sender?.id===binding.extensionId&&sender.tab?.id===binding.tabId&&sender.tab?.cookieStoreId===binding.containerId&&sender.frameId===binding.frameId&&sender.documentId===binding.documentId&&sender.url===binding.url;
}
export function maintenanceClass(moduleId,packageClass) {
 return (moduleId==='pcms-journal'&&packageClass==='bundled-journal')?'journal':(moduleId==='pcms-backup'&&packageClass==='bundled-backup')?'backup':null;
}
export function validateStep(result) {
 if(!result||!['checkpoint','wait','hold','complete'].includes(result.kind)||Object.keys(result).some(k=>!['kind','checkpoint','dueAt','reason','recovery'].includes(k)))throw Error('INVALID_STEP');
 if(result.kind==='wait'&&(!Number.isFinite(result.dueAt)||result.dueAt<0))throw Error('INVALID_DEADLINE');
 if(result.kind==='hold'&&(!result.reason||!/^[A-Z][A-Z0-9_]*$/.test(result.reason)))throw Error('INVALID_HOLD');
 // Structured data only. Reject functions, cycles and non-JSON provider objects.
 const seen=new Set();const json=value=>{if(value===null||typeof value==='string'||typeof value==='boolean')return;if(typeof value==='number'&&Number.isFinite(value))return;if(typeof value!=='object'||seen.has(value)||!['[object Object]','[object Array]'].includes(Object.prototype.toString.call(value)))throw Error('INVALID_CHECKPOINT');seen.add(value);for(const child of Object.values(value))json(child);seen.delete(value);};json(result.checkpoint??null);
 const encoded=JSON.stringify(result.checkpoint??null);if(encoded===undefined)throw Error('INVALID_CHECKPOINT');
 return JSON.parse(JSON.stringify(result));
}
