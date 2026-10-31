import {openCore,publicError,project} from '../core/records.mjs';
// Only the packaged dashboard can use these secret-safe operations. The
// module host will grant narrower bound scopes; it receives no storage object.
export function createCoreService({open=openCore,alarms=null,wake=async()=>{}}={}) {
  let pending;
  const core=()=>pending??=(async()=>{
    const value=await open();
    await value.queue.boot();
    await value.record({step:'CORE_START',result:'COMPLETE'});
    const due=await value.queue.deadline();if(alarms){if(due)await alarms.create('pcms-queue',{when:due});else await alarms.clear('pcms-queue');}
    return value;
  })().catch(error=>{pending=null;throw error;});
  async function handle(message) {
    try {
      const value=await core();let result;
      switch(message?.operation) {
        case 'queue.status':result=await value.queue.status();break;
        case 'queue.pause':result=await value.queue.pause();break;
        case 'queue.resume':result=await value.queue.resume();await schedule(value);break;
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
    } catch(error){return {ok:false,code:publicError(error)};}
  }
  async function schedule(value){const due=await value.queue.deadline();if(alarms){if(due)await alarms.create('pcms-queue',{when:due});else await alarms.clear('pcms-queue');}}
  return {start:core,handle,wake:async()=>{const value=await core();await wake(value);await value.queue.acknowledgeWake();await schedule(value);}};
}
