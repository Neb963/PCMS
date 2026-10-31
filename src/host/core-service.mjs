import {createInstaller} from '../modules/install.mjs';
import {seedBundled} from '../modules/seed.mjs';
import {PackageError} from '../modules/package.mjs';
import {createModuleHost} from './module-host.mjs';
import {createLifecycle} from '../modules/lifecycle.mjs';
import {createWebsiteScripts} from './website-scripts.mjs';
import {websiteContext} from './bootstrap.mjs';
import {createDownloads} from '../core/downloads.mjs';
import {createJournal} from '../modules/journal.mjs';
import {openCore,publicError,project} from '../core/records.mjs';
// Only the packaged dashboard can use these secret-safe operations. The
// module host will grant narrower bound scopes; it receives no storage object.
export function createCoreService({open=openCore,alarms=null,wake=async()=>{},api=globalThis.browser,notify=()=>{}}={}) {
  let pending,modules,lifecycle,scripts,downloads,journal,seedFailure=null;
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
    downloads=api?.downloads?createDownloads({core:value,api,profileId:(await value.status()).profileId}):null;
    journal=createJournal({core:value,downloads});await journal.initialize();if(downloads)await journal.changed();await journal.tick();
    if(globalThis.document&&api){
      modules=createModuleHost({core:value,api,notify,onDue:()=>schedule(value),journalEffect:journal.effect});
      scripts=createWebsiteScripts({core:value,api,load:modules.load,context:websiteContext});
      const host=modules.lifecycle;
      lifecycle=createLifecycle({core:value,host:{...host,
        instances:async m=>[...await host.instances(m),...scripts.instances(m)],
        unregister:m=>scripts.unregister(m),
        stopModule:async(m,l,recordReceipt)=>[...await host.stopModule(m,{...l,instances:l.instances.filter(i=>i.type!=='website')},recordReceipt),...await scripts.stop(m,l,recordReceipt)],
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
      switch(message?.operation) {
        case 'module.lifecycle':{if(!lifecycle)return {ok:false,code:'MODULE_HOST_UNAVAILABLE'};const m=await lifecycle.request(message.id,message.kind,message.requestId);await journal.tick();await modules.start();await schedule(value);notify({type:'moduleChanged',moduleId:m.id});result={id:m.id,state:m.state,enabled:m.enabled,code:m.lifecycle?.code??null};break;}
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
        case 'queue.pause':result=await value.queue.pause(message.requestId);break;
        case 'queue.resume':result=await value.queue.resume(message.requestId);await schedule(value);break;
        case 'queue.list':{const page=await value.queue.list({cursor:message.cursor,search:message.search??'',state:message.state??''});result={...page,rows:page.rows.map(j=>project('jobs',j))};break;}
        case 'queue.get':result=await value.get('jobs',message.id);break;
        case 'queue.batch':result=await value.queue.batch(message.id);break;
        case 'counts':result=await value.counts();break;
        case 'events':result=await journal.events(message);break;
        case 'view.get':result=await value.view('shell-view');break;
        case 'view.save': {
          const v=message.value;
          if(!v||typeof v!=='object'||Object.keys(v).some(k=>!['journalFilter','route','scroll','workSearch','workState','journalModule','journalTarget','journalSeverity','journalCursor'].includes(k))||typeof v.journalFilter!=='string'||typeof v.route!=='string'||!Number.isFinite(v.scroll))return {ok:false,code:'INVALID_VIEW'};
          result=await value.saveView('shell-view',v,message.requestId);break;
        }
        default:return {ok:false,code:'OPERATION_DENIED'};
      }
      return {ok:true,result};
    } catch(error){return {ok:false,code:error instanceof PackageError?error.code:/^(MODULE_[A-Z_]+|PAGE_[A-Z_]+|DOCUMENT_DENIED|CAPABILITY_DENIED|TARGET_DENIED|ACTION_DENIED)$/.test(error?.message)?error.message:publicError(error)};}
  }
  async function schedule(value){const times=[await value.queue.deadline(),await journal?.deadline()].filter(Number.isFinite),due=times.length?Math.max(Date.now()+1000,Math.min(...times)):null;if(alarms){if(due)await alarms.create('pcms-queue',{when:due});else await alarms.clear('pcms-queue');}}
  return {start:core,handle,closeDocument:id=>modules?.closeDocument(id),website:async details=>{await core();await scripts?.inject(details);},downloadsChanged:async()=>{const value=await core();await journal.changed();if(lifecycle)await lifecycle.recover();if(modules)await modules.turn();await schedule(value);},wake:async()=>{const value=await core(),cut=(await value.status()).sequence;await wake(value);if(lifecycle)await lifecycle.recover();await journal.changed();await journal.tick();if(modules)await modules.turn();await value.queue.acknowledgeWake(cut);await schedule(value);}};
}
