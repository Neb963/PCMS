export const HEARTBEAT=30000;
// Only adjacent samples in one monotonic context can earn Active time.
// A reconstructed context deliberately undercounts its unobserved gap.
export function accountCycle(previous,context,defaults){
 const {wall,mono,session,boot,eligible,key,admit=true}=context;
 let c=structuredClone(previous),p=c.lastAccountingReceipt,earned=0;
 if(c.phase==='PENDING'&&eligible&&admit||c.phase==='SLEEP'&&wall>=c.sleepUntil&&eligible){
  c={schema:1,cycleId:c.phase==='PENDING'?c.cycleId:context.nextCycleId,phase:'ACTIVE',activeUsedMs:0,activeDurationMs:defaults.activeMs,sleepDurationMs:defaults.sleepMs,sleepUntil:null,startedAt:wall,notBefore:null};p=null;
 }
 if(c.phase==='ACTIVE'&&eligible&&p?.eligible&&p.session===session&&p.boot===boot&&p.key===key){
  const m=mono-p.mono,w=wall-p.wall;
  if(m>=0&&m<=HEARTBEAT+1500&&w>=0&&w<=HEARTBEAT+1500&&Math.abs(m-w)<=1000)earned=Math.min(m,HEARTBEAT);
 }
 if(c.phase==='ACTIVE'){
  c.activeUsedMs=Math.min(c.activeDurationMs,c.activeUsedMs+earned);
  if(c.activeUsedMs>=c.activeDurationMs){c.phase='SLEEP';c.sleepUntil=wall+c.sleepDurationMs;c.sleptAt=wall;}
 }
 c.lastAccountingReceipt={wall,mono,session,boot,eligible:eligible&&c.phase==='ACTIVE',key};
 return c;
}
