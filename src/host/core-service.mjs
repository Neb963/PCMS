import {createDirectory} from '../modules/directory.mjs';
import {createRefresher} from '../modules/refresher.mjs';
import {createDeployer} from '../modules/deployer.mjs';
import {createDeploymentInputs} from '../modules/deployment-inputs.mjs';
import {createSourceWriter} from '../core/source-writer.mjs';
import {createInstaller} from '../modules/install.mjs';
import {seedBundled} from '../modules/seed.mjs';
import {ArchiveError} from '../core/backup-format.mjs';
import {PackageError} from '../modules/package.mjs';
import {createModuleHost} from './module-host.mjs';
import {createLifecycle} from '../modules/lifecycle.mjs';
import {createWebsiteScripts} from './website-scripts.mjs';
import {createGitWriter} from '../core/git-writer.mjs';
import {createGitCatalog} from '../core/git-catalog.mjs';
import {createSourceInspection} from '../modules/source-inspection.mjs';
import {createCreator} from '../modules/creator.mjs';
import {createDiscover} from '../modules/discover.mjs';
import {createAccounts} from '../modules/accounts.mjs';
import {refreshAccountPins} from './account-pins.mjs';
import {websiteContext,accountAdapter,hostStatus} from './bootstrap.mjs';
import {createRetention} from '../core/retention.mjs';
import {createDownloads} from '../core/downloads.mjs';
import {createBackup} from '../modules/backup.mjs';
import {createJournal} from '../modules/journal.mjs';
import {openCore,publicError,project} from '../core/records.mjs';
// Only the packaged dashboard can use these secret-safe operations. The
// module host will grant narrower bound scopes; it receives no storage object.
export function createCoreService({open=openCore,alarms=null,wake=async()=>{},api=globalThis.browser,notify=()=>{}}={}) {
  let pending,modules,lifecycle,scripts,downloads,journal,accounts,git,gitWriter,discover,creator,source,sourceWriter,deployer,backup,retention,refresher,directory,seedFailure=null;
  const seedCode=error=>/^(BUNDLED_[A-Z_]+|INVALID_BUNDLED_SEED|STORAGE_FULL)$/.test(error?.message)?error.message:publicError(error);
  async function seed(value){
    try{const result=await seedBundled(value);seedFailure=null;return result;}
    catch(error){seedFailure=seedCode(error);try{await value.record({step:'SEED_MODULES',result:'FAILED',code:seedFailure});}catch{}return {state:'FAILED',code:seedFailure};}
  }
  const core=()=>pending??=(async()=>{
    const value=await open();
    await value.queue.boot();
    await value.record({step:'CORE_START',result:'COMPLETE'});
    await seed(value);
    git=createGitCatalog({core:value});await git.initialize();gitWriter=createGitWriter({core:value,validateJob:j=>j.deployment?deployer.validate(j):undefined});
    accounts=createAccounts({core:value,donor:accountAdapter,pins:refreshAccountPins});await accounts.initialize();
    downloads=api?.downloads?createDownloads({core:value,api,profileId:(await value.status()).profileId}):null;retention=api?.downloads?createRetention({core:value,api,profileId:(await value.status()).profileId}):null;
    discover=createDiscover({core:value,donor:accountAdapter,downloads,gitWriter,catalog:git});await discover.initialize();
    creator=createCreator({core:value,donor:accountAdapter});await creator.initialize();await deployer?.initialize();source=createSourceInspection({core:value,donor:accountAdapter});sourceWriter=createSourceWriter({core:value,donor:accountAdapter,validateJob:j=>deployer.validate(j),recoverAccount:async(id)=>{const a=await value.read('accounts',id),status=await value.status();if(status.paused||status.restoreHold||a?.state!=='READY'||a.admission)return;try{await accounts.command({id,kind:'OPEN',requestId:crypto.randomUUID()});}catch{}}});
    deployer=createDeployer({core:value,donor:accountAdapter,inputs:createDeploymentInputs({core:value}),writer:sourceWriter,gitWriter});await deployer.initialize();
    directory=createDirectory({core:value,donor:accountAdapter});await directory.initialize();
    refresher=createRefresher({core:value,directory:directory.projection,sessionNonce:async()=>{if(!api?.storage?.session)return null;const key='pcms-refresher-session';let nonce=(await api.storage.session.get(key))[key];if(!nonce){nonce=crypto.randomUUID();await api.storage.session.set({[key]:nonce});}return nonce;},observe:async(gs,as)=>{const tabs=await api.tabs.query({}),targets=[];for(const g of gs){let files=[],sourceUnavailable=false;try{if(tabs.some(t=>t.url?.startsWith('https://perchance.org/'+g.slug+'#edit')))files=await value.verifySource(g.sourceManifest);}catch{sourceUnavailable=true;}targets.push({id:g.id,slug:g.slug,remoteId:g.remoteId,accountId:g.accountId,files,sourceUnavailable});}return accountAdapter.observeRefresher({accounts:[...as.values()].filter(a=>gs.some(g=>g.accountId===a.id)).map(a=>({accountId:a.id,personaUid:a.personaUid,containerId:a.containerId,routeId:a.routeId,expectedPrincipal:a.expectedPrincipal})),targets});}});await refresher.initialize();
    backup=createBackup({core:value,donor:accountAdapter,downloads,retention,pins:refreshAccountPins,quiesce:async()=>{if(!scripts)return;let cursor=null;do{const page=await value.list({table:'modules',cursor});for(const row of page.rows){const m=await value.read('modules',row.id),instances=scripts.instances(m);if(instances.length)await scripts.stop(m,{instances,oldGeneration:m.generation});await scripts.unregister(m);}cursor=page.cursor;}while(cursor);},verifyGit:()=>git.verifyRestored(),rebuild:async()=>{await scripts?.rebuild();await modules?.start();await accounts.initialize();await git.initialize();await journal.initialize();await directory.initialize();await refresher.initialize();await schedule(value);}});await backup.initialize();
    journal=createJournal({core:value,downloads,retention});await journal.initialize();if(downloads)await journal.changed();await discover.changed();await backup.changed();await journal.tick();
    if(globalThis.document&&api){
      modules=createModuleHost({core:value,api,notify,onDue:()=>schedule(value),journalEffect:journal.effect,directoryEffect:async(job,reconcile)=>{const r=await directory.effect(job,reconcile);await refresher.changed();return r;},accountEffect:async(job,reconcile)=>{const r=await accounts.effect(job,reconcile);await sourceWriter.recover();await deployer.recover();return r;},discoverEffect:discover.effect,creatorEffect:async(job,reconcile)=>{const r=await creator.effect(job,reconcile);await deployer.initialize();return r;},sourceEffect:(job,reconcile)=>job.deployment?deployer.effect(job,reconcile):job.kind==='SOURCE_SAVE'?sourceWriter.effect(job,reconcile):source.effect(job,reconcile),backupEffect:backup.effect,discoverPage:(name,args)=>name==='discover.list'?discover.list(args):name==='discover.get'?discover.get(args.id):name==='discover.import'?discover.import(args):name==='discover.command'?discover.command(args):name==='discover.export'?discover.export(args):name==='discover.preparations'?discover.checkPreparations(args.id):name==='discover.retryPreparation'?discover.retryPreparation(args):name==='discover.navigate'?discover.navigation(args):discover.changed(),gitEffect:(job,reconcile)=>job.moduleId==='pcms-discover'?discover.prepareEffect(job,reconcile):gitWriter.step(job,{kind:'PREPARE',slug:job.input.slug},reconcile)});
      scripts=createWebsiteScripts({core:value,api,load:modules.load,context:websiteContext});
      const host=modules.lifecycle;
      lifecycle=createLifecycle({core:value,host:{...host,
        instances:async m=>[...await host.instances(m),...scripts.instances(m)],
        unregister:m=>scripts.unregister(m),
        stopModule:async(m,l,recordReceipt)=>{const receipts=[...await host.stopModule(m,{...l,instances:l.instances.filter(i=>i.type!=='website')},recordReceipt),...await scripts.stop(m,l,recordReceipt)];if(m.id==='pcms-discover')await discover.stop();return receipts;},
        rebuild:async m=>{await host.rebuild(m);await scripts.configure(m);}
      }});
      await lifecycle.recover();await scripts.rebuild();await modules.start();await modules.turn();
    }
    await schedule(value);
    return value;
  })().catch(error=>{pending=null;throw error;});
  async function handle(message,sender={}) {
    try {
      const value=await core();let result;
      if((await value.status()).restoreHold&&['directory.check','directory.open','refresher.configure','backup.export','backup.exportSettings','backup.capture','backup.coverage','accounts.add','accounts.command','creator.override','source.inspect','source.open','source.savePrepare','source.saveRestore','source.saveAdopt','discover.import','discover.command','discover.export','git.configure','git.reconnect'].includes(message?.operation))return {ok:false,code:'RESTORE_MAINTENANCE'};
      switch(message?.operation) {
        case 'directory.status':result=await directory.projection();break;
        case 'directory.check':result=await directory.check();if(modules)void modules.turn().catch(()=>{});await schedule(value);break;
        case 'directory.open':result=await directory.open();break;
        case 'refresher.status':result=await refresher.status(message);break;
        case 'refresher.configure':result=await refresher.configure(message);await schedule(value);break;
        case 'module.lifecycle':{if(!lifecycle)return {ok:false,code:'MODULE_HOST_UNAVAILABLE'};let m=await lifecycle.request(message.id,message.kind,message.requestId);if(message.id==='pcms-discover'){await discover.changed();if(m.lifecycle?.code==='MODULE_EFFECT_UNKNOWN')m=await lifecycle.request(message.id,'CONTINUE',crypto.randomUUID());}if(message.id==='pcms-creator'){await creator.recover();if(m.lifecycle?.code==='MODULE_EFFECT_UNKNOWN')m=await lifecycle.request(message.id,'CONTINUE',crypto.randomUUID());}if(message.id==='pcms-deployer'){await source.recover();await sourceWriter.recover();await deployer.recover();if(m.lifecycle?.code==='MODULE_EFFECT_UNKNOWN')m=await lifecycle.request(message.id,'CONTINUE',crypto.randomUUID());}if(message.id==='pcms-backup'){await backup.recover();if(m.lifecycle?.code==='MODULE_EFFECT_UNKNOWN')m=await lifecycle.request(message.id,'CONTINUE',crypto.randomUUID());}await journal.tick();await backup.tick();await directory.tick();await refresher.changed();await accounts.initialize();await discover.initialize();await creator.initialize();await deployer?.initialize();await modules.start();await schedule(value);notify({type:'moduleChanged',moduleId:m.id});result={id:m.id,state:m.state,enabled:m.enabled,code:m.lifecycle?.code??null};break;}
        case 'backup.restorePreview':result=await backup.previewRestore({file:message.file});break;
        case 'backup.restoreConfirm':result=await backup.confirmRestore({id:message.id,revision:message.revision,confirmed:message.confirmed});if(modules)void modules.turn().catch(()=>{});await schedule(value);break;
        case 'backup.restoreCheck':result=await backup.checkRestore({id:message.id});if(modules)void modules.turn().catch(()=>{});await schedule(value);break;
        case 'backup.restoreRollback':result=await backup.rollbackRestore({id:message.id});if(modules)void modules.turn().catch(()=>{});await schedule(value);break;
        case 'backup.restoreCancel':result=await backup.cancelRestore({id:message.id});break;
        case 'backup.restoreDiscardSource':result=await backup.discardRestoreSource({id:message.id});break;
        case 'backup.restoreInspect':result=await backup.inspectRestore({id:message.id,tabId:message.tabId});break;
        case 'backup.export':result=await backup.export({requestId:message.requestId});if(modules)void modules.turn().catch(()=>{});await schedule(value);break;
        case 'backup.exportSettings':result=await backup.exportSettings({folder:message.folder,intervalHours:message.intervalHours,retentionDays:message.retentionDays});await schedule(value);break;
        case 'backup.exportCheck':result=await backup.checkExport({id:message.id});if(modules)void modules.turn().catch(()=>{});await schedule(value);break;
        case 'backup.exportDiscard':result=await backup.discardExport({id:message.id});break;
        case 'backup.capture':result=await backup.capture({requestId:message.requestId});if(modules)void modules.turn().catch(()=>{});await schedule(value);break;
        case 'backup.captureInspect':result=await backup.inspectCapture({id:message.id,accountId:message.accountId});break;
        case 'backup.captureCheck':result=await backup.checkCapture({id:message.id});if(modules)void modules.turn().catch(()=>{});await schedule(value);break;
        case 'backup.status':result=await backup.status();break;
        case 'backup.coverage':result=await backup.enqueue({requestId:message.requestId});if(modules)void modules.turn().catch(()=>{});await schedule(value);break;
        case 'deployment.aiCheck':result=await deployer.checkAi(message);break;
        case 'deployment.review':result=await deployer.reviewAi(message);break;
        case 'deployment.cancel':result=await deployer.cancelAi(message);break;
        case 'deployment.get':result=await deployer.get(message.id);break;
        case 'deployment.check':result=await deployer.check(message);if(modules)void modules.turn().catch(()=>{});await schedule(value);break;
        case 'source.saveGet':result=await sourceWriter.get(message.id);break;
        case 'source.savePrepare':result=await sourceWriter.prepare(message);if(modules)void modules.turn().catch(()=>{});await schedule(value);break;
        case 'source.saveRestore':result=await sourceWriter.enqueue({...message,restore:true});if(modules)void modules.turn().catch(()=>{});await schedule(value);break;
        case 'source.saveCheck':{const state=await sourceWriter.get(message.id),job=state.jobId?await value.read('jobs',state.jobId):null;result=job?.deployment?await deployer.check(message):await sourceWriter.check(message);}if(modules)void modules.turn().catch(()=>{});await schedule(value);break;
        case 'source.saveAdopt':result=await sourceWriter.adopt(message);await schedule(value);break;
        case 'source.saveFile':{const s=await sourceWriter.get(message.id),manifestId=({candidate:s.candidateManifest,baseline:s.baselineManifest,remote:s.remoteManifest})[message.version];if(!manifestId)throw new Error('SOURCE_FILE_MISSING');const files=await value.verifySource(manifestId),entry=files.find(f=>f.path===message.path);if(!entry)return {ok:false,code:'SOURCE_FILE_MISSING'};const offset=message.offset??0;if(!Number.isSafeInteger(offset)||offset<0||offset>entry.bytes)return {ok:false,code:'SOURCE_CHUNK_INVALID'};const bytes=(await value.bytes(entry.blobId)).subarray(offset,offset+65536);let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));result={path:entry.path,version:message.version,offset,total:entry.bytes,sha256:entry.sha256,base64:btoa(raw),next:offset+bytes.length<entry.bytes?offset+bytes.length:null};break;}
        case 'source.get':{const {current,previous,changes,...summary}=await source.get(message.id);result={...summary,currentFiles:current.length,previousFiles:previous.length};break;}
        case 'source.files':result=await source.list(message);break;
        case 'source.file':result=await source.file(message);break;
        case 'source.open':result=await source.open(message);break;
        case 'source.inspect':{const s=await source.inspect(message);result={state:s.state,code:s.code,jobId:s.jobId};}if(modules)void modules.turn().catch(()=>{});await schedule(value);break;
        case 'source.check':{const s=await source.check(message);result={state:s.state,code:s.code,jobId:s.jobId};}if(modules)void modules.turn().catch(()=>{});await schedule(value);break;
        case 'creator.inspect':result=await creator.inspect(message);break;
        case 'creator.status':result=await creator.status();break;
        case 'creator.get':result=await creator.get(message.id);break;
        case 'creator.override':result=await creator.override(message);if(modules)void modules.turn().catch(()=>{});await schedule(value);break;
        case 'creator.check':result=await creator.check(message);if(modules)void modules.turn().catch(()=>{});await schedule(value);break;
        case 'discover.available':result=await discover.available();break;
        case 'discover.list':result=await discover.list(message);break;
        case 'discover.get':result=await discover.get(message.id);break;
        case 'discover.import':result=await discover.import(message);if(modules)void modules.turn().catch(()=>{});await schedule(value);break;
        case 'discover.command':result=await discover.command(message);if(modules)void modules.turn().catch(()=>{});await schedule(value);break;
        case 'discover.export':result=await discover.export(message);if(modules)void modules.turn().catch(()=>{});await schedule(value);break;
        case 'discover.check':await discover.changed();if(modules)void modules.turn().catch(()=>{});await schedule(value);result={state:'CHECKED'};break;
        case 'git.jobCheck':{const selected=await value.read('jobs',message.id);if(selected?.deployment){result=await deployer.check({id:selected.targetId});if(modules)void modules.turn().catch(()=>{});await schedule(value);break;}const observation=await gitWriter.check(message.id),job=await value.read('jobs',message.id);if(!job.ownerMissing&&job.state==='HELD'&&job.recovery?.action==='CHECK_GIT'&&job.effect?.boundary!=='POSSIBLE'&&['READY','CONTINUE','COMPLETE'].includes(observation.value.state))await value.queue.transition(job.id,job.rev,{state:'WAITING',dueAt:Date.now(),recovery:null});if(modules)void modules.turn().catch(()=>{});await schedule(value);result=observation.value;break;}
        case 'git.status':result=await git.status();break;
        case 'git.configure':result=await git.configure({repository:message.repository,credential:message.credential});void git.tick().then(async()=>{await discover.initialize();await creator.initialize();await deployer?.initialize();}).finally(()=>schedule(value)).catch(()=>{});await schedule(value);break;
        case 'git.reconnect':result=await git.reconnect();void git.tick().then(async()=>{await discover.initialize();await creator.initialize();await deployer?.initialize();}).finally(()=>schedule(value)).catch(()=>{});await schedule(value);break;
        case 'git.check':result=await git.tick(true);await discover.initialize();await creator.initialize();await deployer?.initialize();await schedule(value);break;
        case 'catalog.list':result=await git.list(message);break;
        case 'catalog.get':result=await git.get(message.id);break;
        case 'host.status':result=await hostStatus(api);break;
        case 'accounts.status':result=await accounts.status();break;
        case 'accounts.list':result=await accounts.list(message);break;
        case 'accounts.related':result=await accounts.related(message.id,message.table,message.cursor);break;
        case 'accounts.get':result=await accounts.get(message.id);break;
        case 'accounts.add':result=await accounts.add({label:message.label,requestId:message.requestId});if(modules)void modules.turn().catch(()=>{});await schedule(value);break;
        case 'accounts.command':result=await accounts.command({id:message.id,kind:message.kind,requestId:message.requestId,confirmed:message.confirmed});if(modules)void modules.turn().catch(()=>{});await schedule(value);break;
        case 'accounts.check':result=await accounts.check(message.id);if(modules)void modules.turn().catch(()=>{});await schedule(value);break;
        case 'journal.check':await journal.changed();if(modules)await modules.turn();await schedule(value);result=await journal.status();break;
        case 'journal.status':result=await journal.status();break;
        case 'journal.events':result=await journal.events(message);break;
        case 'journal.export':result=await journal.enqueue({requestId:message.requestId,first:message.first,last:message.last});if(modules)void modules.turn().catch(()=>{});await schedule(value);break;
        case 'journal.settings':result=await journal.settings(message.value);await schedule(value);break;
        case 'modules.permission':result={granted:await api.permissions.contains({permissions:['userScripts']})};break;
        case 'modules.rebuild':await lifecycle?.recover();await scripts?.rebuild();await modules?.start();result={state:'CHECKED'};break;
        case 'module.editor':result=await scripts.open(await value.read('modules',message.id));break;
        case 'module.install':{result=await createInstaller(value).install(message.bytes,{budget:message.budget});if(modules)await modules.start();break;}
        case 'modules.seed.status':result={...await value.moduleSeedStatus(),failure:seedFailure};break;
        case 'modules.seed.retry':{result=await seed(value);if(result.state==='FAILED')return {ok:false,code:result.code};if(modules)await modules.start();break;}
        case 'modules.list':{const rows=[];let cursor=null;do{const page=await value.list({table:'modules',limit:200,cursor});rows.push(...page.rows);cursor=page.cursor;}while(cursor);result=await Promise.all(rows.map(async p=>{const m=await value.read('modules',p.id);return {...p,pinned:m.pinned===true,stagedVersion:m.staged?.manifest?.version??null,previousVersion:m.previous?.manifest?.version??null,lifecycle:m.lifecycle?{kind:m.lifecycle.kind,code:m.lifecycle.code}:null,pages:m.manifest?.pages??[]};}));break;}
        case 'module.open':if(!sender.coreDocument)return {ok:false,code:'DOCUMENT_DENIED'};if(!modules)return {ok:false,code:'MODULE_HOST_UNAVAILABLE'};result=await modules.preparePage(message.id,message.pageId,sender);break;
        case 'module.rpc':if(!modules)return {ok:false,code:'MODULE_HOST_UNAVAILABLE'};result=await modules.pageRPC(message.token,message.message,sender);break;
        case 'module.close':if(!modules)return {ok:false,code:'MODULE_HOST_UNAVAILABLE'};result=modules.closePage(message.token,sender);break;
        case 'module.pin':{const m=await value.read('modules',message.id);if(!m||!m.enabled)return {ok:false,code:'MODULE_DISABLED'};await value.mutate([{table:'modules',id:m.id,value:{...m,pinned:message.pinned===true},expectedRev:m.rev,refs:m.refs}],{step:'PIN_MODULE',result:'COMPLETE',moduleId:m.id});result={pinned:message.pinned===true};break;}
        case 'queue.status':result=await value.queue.status();break;
        case 'queue.pause':result=await value.queue.pause(message.requestId);await refresher.changed();await schedule(value);break;
        case 'queue.resume':result=await value.queue.resume(message.requestId);await directory.tick();await refresher.changed();await sourceWriter.recover();await deployer.recover();await schedule(value);break;
        case 'queue.list':{const page=await value.queue.list({cursor:message.cursor,search:message.search??'',state:message.state??''});result={...page,rows:page.rows.map(j=>project('jobs',j))};break;}
        case 'queue.get':{const job=await value.read('jobs',message.id),m=job?.moduleId==='pcms-backup'?await value.read('modules','pcms-backup'):null,exportFile=job?.moduleId==='pcms-backup'&&job.kind==='EXPORT'?await value.read('files',job.id):null,restore=job?.moduleId==='pcms-backup'&&job.kind==='RESTORE'?await value.restore.read():null;result=job?{...project('jobs',job),git:gitWriter.status(job),target:await value.get('generators',job.targetId),...m?{backup:job.kind==='RESTORE'?{restore:true,restoreId:job.input.restoreId,state:restore?.jobId===job.id?restore.state:job.state,code:restore?.jobId===job.id?restore.code:null,canCheck:restore?.jobId===job.id&&m.enabled&&!m.lifecycle&&m.manifest?.capabilities?.includes('backup.restore')}:job.kind==='EXPORT'?{export:true,state:exportFile?.state??job.backupExport?.phase??job.state,code:exportFile?.code??job.backupExport?.code??job.recovery?.code??null,canCheck:m.enabled&&!m.lifecycle&&m.manifest?.capabilities?.includes('backup.export')}:{coverageOnly:job.input?.coverageOnly===true,state:job.input?.coverageOnly===true?job.capture?.state??'COLLECTING':job.fullCapture?.phase??'STAGE',code:job.input?.coverageOnly===true?null:job.fullCapture?.code??null,complete:job.input?.coverageOnly===true?job.capture?.state==='COMPLETE':job.fullCapture?.phase==='COMPLETE',canCheck:job.input?.coverageOnly===false&&m.enabled&&!m.lifecycle&&m.manifest?.capabilities?.includes('backup.captureCut')}}:{}}:null;break;}
        case 'queue.batch':result=await value.queue.batch(message.id);break;
        case 'counts':result=await value.counts();break;
        case 'events':result=await journal.events(message);break;
        case 'view.get':result=await value.view('shell-view');break;
        case 'view.save': {
          const v=message.value;
          if(!v||typeof v!=='object'||Object.keys(v).some(k=>!['journalFilter','route','scroll','workSearch','workState','journalModule','journalTarget','journalSeverity','journalCursor','journalFirst','journalLast','journalDraftInterval','journalDraftFolder','journalDraftRetention','accountSearch','accountState','accountDraftLabel','accountSelection','accountCursor','accountAddRequestId','accountAddLabel','accountRequests','accountRemoveConfirmed','connectionRepository','catalogSearch','catalogState','catalogCursor','catalogSelection','discoverDraft','discoverAccount','discoverSelection','discoverRow','discoverBatchCursor','creatorAccountDrafts','catalogAccount','sourceSelection','sourceSearch','sourceVersions','backupSearch','backupPage','backupDraftFolder','backupDraftInterval','backupDraftRetention','refresherSearch','refresherPhase','refresherOffset','refresherActiveDraft','refresherSleepDraft'].includes(k))||typeof v.journalFilter!=='string'||typeof v.route!=='string'||!Number.isFinite(v.scroll))return {ok:false,code:'INVALID_VIEW'};
          result=await value.saveView('shell-view',v,message.requestId);break;
        }
        default:return {ok:false,code:'OPERATION_DENIED'};
      }
      return {ok:true,result};
    } catch(error){return {ok:false,code:error instanceof PackageError||error instanceof ArchiveError?error.code:/^(MODULE_[A-Z_]+|PAGE_[A-Z_]+|DOCUMENT_DENIED|CAPABILITY_DENIED|TARGET_DENIED|ACTION_DENIED)$/.test(error?.message)?error.message:publicError(error)};}
  }
  async function schedule(value){const times=[await value.queue.deadline(),await journal?.deadline(),await git?.deadline(),await backup?.deadline(),await refresher?.deadline(),await directory?.deadline()].filter(Number.isFinite),due=times.length?Math.max(Date.now()+1000,Math.min(...times)):null;if(alarms){if(due)await alarms.create('pcms-queue',{when:due});else await alarms.clear('pcms-queue');}}
  return {start:core,handle,editor:async(message,sender)=>{try{const value=await core(),result=await deployer.editor(message,sender);if(message.operation==='editor.finish'&&modules)void modules.turn().catch(()=>{});await schedule(value);return {ok:true,result};}catch(error){return {ok:false,code:publicError(error)};}},closeDocument:id=>modules?.closeDocument(id),website:async details=>{const value=await core();await scripts?.inject(details);await backup.changed();await refresher.changed();if(modules)void modules.turn().catch(()=>{});await schedule(value);},downloadsChanged:async()=>{const value=await core();await journal.changed();await discover.changed();await backup.changed();if(lifecycle)await lifecycle.recover();if(modules)await modules.turn();await schedule(value);},wake:async()=>{const value=await core(),cut=(await value.status()).sequence;await wake(value);if(lifecycle)await lifecycle.recover();await journal.changed();await backup.changed();await journal.tick();await backup.tick();await directory.tick();await refresher.tick();await deployer.recover();if(modules)await modules.turn();await git.tick();await creator.initialize();await deployer?.initialize();await value.queue.acknowledgeWake(cut);await schedule(value);}};
}
