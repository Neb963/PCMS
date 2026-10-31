import {createModuleHost} from './module-host.mjs';
import {openCore,publicError,project} from '../core/records.mjs';
// Only the packaged dashboard can use these secret-safe operations. The
// module host will grant narrower bound scopes; it receives no storage object.
export function createCoreService({open=openCore,alarms=null,wake=async()=>{},api=globalThis.browser}={}) {
  let pending,modules;
  const core=()=>pending??=(async()=>{
    const value=await open();
    await value.queue.boot();
    await value.record({step:'CORE_START',result:'COMPLETE'});
    if(globalThis.document&&api){modules=createModuleHost({core:value,api,onDue:()=>schedule(value)});await modules.start();}
    const due=await value.queue.deadline();if(alarms){if(due)await alarms.create('pcms-queue',{when:due});else await alarms.clear('pcms-queue');}
    return value;
  })().catch(error=>{pending=null;throw error;});
  async function handle(message,sender={}) {
    try {
      const value=await core();let result;
      switch(message?.operation) {
        case 'modules.list':{const rows=[];let cursor=null;do{const page=await value.list({table:'modules',limit:200,cursor});rows.push(...page.rows);cursor=page.cursor;}while(cursor);result=await Promise.all(rows.map(async p=>{const m=await value.read('modules',p.id);return {...p,pinned:m.pinned===true,pages:m.manifest?.pages??[]};}));break;}
        case 'module.open':if(!modules)return {ok:false,code:'MODULE_HOST_UNAVAILABLE'};result=await modules.preparePage(message.id,message.pageId,sender);break;
        case 'module.rpc':if(!modules)return {ok:false,code:'MODULE_HOST_UNAVAILABLE'};result=await modules.pageRPC(message.token,message.message,sender);break;
        case 'module.pin':{const m=await value.read('modules',message.id);if(!m||!m.enabled)return {ok:false,code:'MODULE_DISABLED'};await value.mutate([{table:'modules',id:m.id,value:{...m,pinned:message.pinned===true},expectedRev:m.rev,refs:m.refs}],{step:'PIN_MODULE',result:'COMPLETE',moduleId:m.id});result={pinned:message.pinned===true};break;}
        case 'queue.status':result=await value.queue.status();break;
        case 'queue.pause':result=await value.queue.pause(message.requestId);break;
        case 'queue.resume':result=await value.queue.resume(message.requestId);await schedule(value);break;
        case 'queue.list':{const page=await value.queue.list({cursor:message.cursor,search:message.search??'',state:message.state??''});result={...page,rows:page.rows.map(j=>project('jobs',j))};break;}
        case 'queue.get':result=await value.get('jobs',message.id);break;
        case 'queue.batch':result=await value.queue.batch(message.id);break;
        case 'counts':result=await value.counts();break;
        case 'events':result=await value.list({table:'events',cursor:message.cursor,limit:50,search:message.search??''});break;
        case 'view.get':result=await value.view('shell-view');break;
        case 'view.save': {
          const v=message.value;
          if(!v||typeof v!=='object'||Object.keys(v).some(k=>!['journalFilter','route','scroll','workSearch','workState'].includes(k))||typeof v.journalFilter!=='string'||typeof v.route!=='string'||!Number.isFinite(v.scroll))return {ok:false,code:'INVALID_VIEW'};
          result=await value.saveView('shell-view',v,message.requestId);break;
        }
        default:return {ok:false,code:'OPERATION_DENIED'};
      }
      return {ok:true,result};
    } catch(error){return {ok:false,code:/^(MODULE_[A-Z_]+|PAGE_[A-Z_]+|DOCUMENT_DENIED|CAPABILITY_DENIED|TARGET_DENIED|ACTION_DENIED)$/.test(error?.message)?error.message:publicError(error)};}
  }
  async function schedule(value){const due=await value.queue.deadline();if(alarms){if(due)await alarms.create('pcms-queue',{when:due});else await alarms.clear('pcms-queue');}}
  return {start:core,handle,wake:async()=>{const value=await core(),cut=(await value.status()).sequence;await wake(value);if(modules)await modules.turn();await value.queue.acknowledgeWake(cut);await schedule(value);}};
}
