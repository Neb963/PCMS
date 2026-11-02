// Diagnostic data is a typed projection, never an Error/response serialization.
// No arbitrary strings, URLs, messages, stacks, prompts or payloads are allowed.
const enumValue=v=>typeof v==='string'&&/^[A-Z][A-Z0-9_]{0,95}$/.test(v);
const digest=v=>typeof v==='string'&&/^[a-f0-9]{40}([a-f0-9]{24})?$/.test(v);
const enums=new Set(['family','phase','fromState','toState','boundary','kind','decision','action','failedCheck','exceptionType','causeCode','method','endpoint','disposition','proofState','identityState']);
const numbers=new Set(['durationMs','attempt','dueAt','revision','generation','observedAt','proofAgeMs','proofExpiresAt','httpStatus','retryAfterMs','expectedLength','observedLength','resultCount','queryLength']);
const hashes=new Set(['expectedSha','observedSha','expectedTree','observedTree','principalFingerprint','exitFingerprint','queryFingerprint']);
const booleans=new Set(['write','sourceWrite','noReplay','treeMatches','parentsMatch','messageMatches','authorMatches','committerMatches','expectedTerminalLf','observedTerminalLf','proxyVerified','dnsVerified','ipv4Verified','ipv6Verified']);
export function diagnosticDetails(value={}) {
 const out={schema:1,redactionPolicy:1,redactedFields:[],truncated:false};
 for(const [key,v]of Object.entries(value)) {
  if(key==='redactedCount'&&Number.isSafeInteger(v)&&v>=0){out.redactedCount=(out.redactedCount??0)+v;continue;}
  if(key==='redactedFields'&&Array.isArray(v)){out.redactedFields.push(...v.filter(k=>enums.has(k)||numbers.has(k)||hashes.has(k)||booleans.has(k)));continue;}
  if(enums.has(key)&&enumValue(v)||numbers.has(key)&&Number.isFinite(v)&&v>=0||hashes.has(key)&&digest(v)||booleans.has(key)&&typeof v==='boolean')out[key]=v;
  else if(!['schema','redactionPolicy','redactedFields','truncated'].includes(key)){
   // Field names may themselves contain secret material. Report counts and
   // known names only; never copy an untrusted property name into an event.
   out.redactedCount=(out.redactedCount??0)+1;
   if([...enums,...numbers,...hashes,...booleans].includes(key))out.redactedFields.push(key);
  }
 }
 return out;
}
export function errorCode(error) {
 if(error?.name==='QuotaExceededError')return 'STORAGE_FULL';
 if(['InvalidStateError','TransactionInactiveError','ReadOnlyError','UnknownError'].includes(error?.name))return 'STORAGE_UNAVAILABLE';
 if(typeof error?.code==='string'&&enumValue(error.code))return error.code;
 if(error?.name==='AbortError'||error?.name==='TimeoutError')return 'TRANSPORT_TIMEOUT';
 return 'INTERNAL_ERROR';
}
export function failureDetails(error,extra={}) {
 const code=errorCode(error),family=/^STORAGE_|^TRANSACTION_/.test(code)?'STORAGE':/^GIT_/.test(code)?'GIT':/ROUTE|MULLVAD|PROXY|DNS|IPV6/.test(code)?'ROUTE':/LOGIN|IDENTITY|PRINCIPAL|CHALLENGE/.test(code)?'IDENTITY':/^TRANSPORT_/.test(code)?'TRANSPORT':'INTERNAL';
 const names={CoreError:'CORE_ERROR',TypeError:'TYPE_ERROR',RangeError:'RANGE_ERROR',AbortError:'ABORT_ERROR',TimeoutError:'TIMEOUT_ERROR',QuotaExceededError:'QUOTA_EXCEEDED_ERROR'};
 return diagnosticDetails({family,exceptionType:names[error?.name]??'OTHER_ERROR',causeCode:code,...error?.diagnostics,...extra});
}
export function transitionEvent(event,changes,now) {
 const job=changes.find(c=>c.table==='jobs'&&c.value)?.value;
 const affected=changes.find(c=>['accounts','generators'].includes(c.table)&&c.value)?.value;
 const code=event.code??job?.recovery?.code??job?.git?.code??affected?.creatorHoldCode??affected?.deploymentCode??affected?.holdCode;
 const effect=job?.effect;
 const details=diagnosticDetails({...job?.diagnostics,...event.diagnostics,
  ...(job?{toState:job.state,phase:job.creator?.phase??job.deployment?.phase??job.git?.active?.phase??job.step,revision:(changes.find(c=>c.table==='jobs')?.expectedRev??0)+1,generation:job.generation,dueAt:job.dueAt,action:job.recovery?.action}:{}),
  ...(effect?{kind:effect.kind,boundary:effect.boundary,write:effect.write,sourceWrite:effect.sourceWrite,noReplay:effect.boundary==='POSSIBLE'}:{}),
  ...(affected?.routeObservedAt!=null?{observedAt:affected.routeObservedAt,proofAgeMs:Math.max(0,now-affected.routeObservedAt),proofExpiresAt:affected.routeObservedAt+900000}:{})});
 return {...event,...!event.jobId&&affected?.flow?.jobId?{jobId:affected.flow.jobId}:{},...!event.operationId&&effect?.operationId?{operationId:effect.operationId}:{},...code?{code}:{},diagnostics:details,
  severity:event.severity??(code||['HELD','FAILED','UNKNOWN'].includes(event.result)?'error':'info')};
}
