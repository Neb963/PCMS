import {openCore,publicError} from '../core/records.mjs';
// Only the packaged dashboard can use these secret-safe operations. The
// module host will grant narrower bound scopes; it receives no storage object.
export function createCoreService({open=openCore}={}) {
  let pending;
  const core=()=>pending??=(async()=>{
    const value=await open();
    await value.record({step:'CORE_START',result:'COMPLETE'});
    return value;
  })().catch(error=>{pending=null;throw error;});
  async function handle(message) {
    try {
      const value=await core();let result;
      switch(message?.operation) {
        case 'counts':result=await value.counts();break;
        case 'events':result=await value.list({table:'events',cursor:message.cursor,limit:50,search:message.search??''});break;
        case 'view.get':result=await value.view('shell-view');break;
        case 'view.save': {
          const v=message.value;
          if(!v||typeof v!=='object'||Object.keys(v).some(k=>!['journalFilter','route','scroll'].includes(k))||typeof v.journalFilter!=='string'||typeof v.route!=='string'||!Number.isFinite(v.scroll))return {ok:false,code:'INVALID_VIEW'};
          result=await value.saveView('shell-view',v,message.requestId);break;
        }
        default:return {ok:false,code:'OPERATION_DENIED'};
      }
      return {ok:true,result};
    } catch(error){return {ok:false,code:publicError(error)};}
  }
  return {start:core,handle};
}
