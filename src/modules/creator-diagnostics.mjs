// Provider receipts stay private. Record only the typed observation and its
// immutable Core correlation in the same transaction as the receipt.
export function creatorObservation(job,step,value,{operationId=job.effect?.operationId,kind=job.effect?.kind}={}) {
 const failed=value?.ok===false||value?.state==='UNKNOWN'||value?.result==='Unknown';
 const code=typeof value?.code==='string'&&/^[A-Z][A-Z0-9_]{0,95}$/.test(value.code)?value.code:failed?'CREATOR_OBSERVATION_UNVERIFIED':null;
 const possible=job.effect?.boundary==='POSSIBLE',noReplay=possible&&job.effect.write===true&&value?.noDispatch!==true;
 return {moduleId:'pcms-creator',jobId:job.id,targetId:job.targetId,...operationId?{operationId}:{},step,result:failed?(noReplay?'UNKNOWN':'HELD'):'OBSERVED',...code?{code}:{},diagnostics:{phase:job.creator?.phase,kind,boundary:job.effect?.boundary,observedAt:value?.observedAt,decision:possible?(value?.noDispatch===true?'NOT_DISPATCHED':'READBACK_ONLY'):'OBSERVE',noReplay,...code?{causeCode:code}:{}}};
}
