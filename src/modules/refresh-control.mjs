// Refresher policy only. Inputs are complete rendered observations, never API ranks.
export const INITIAL_SPACING = 30000;
const MINUTE = 60000, MAX_BACKOFF = 30 * MINUTE;
export const median = xs => xs.length ? [...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)] : 0;
export const compareGain = (a,b) => a[0]-b[0] || a[1]-b[1] || a[2]-b[2];
const vector = (order,owned) => [50,100,order.length].map(n=>order.slice(0,n).filter(s=>s&&owned.has(s)).length);
const recent = (xs,x) => [...(xs??[]),x].slice(-20);
export function initialControl() {
 return {schema:1,spacingMs:INITIAL_SPACING,nextDue:0,pending:null,rounds:0,failures:0,backoffUntil:0,lastAccount:null,insertions:[],propagations:[],durations:[],targets:{},last:null};
}
export function movement(current,previous,excluded=new Set()) {
 if(!previous || previous.context!==current.context || current.observedAt<=previous.observedAt)return 0;
 const before=new Map(previous.displayedSlugs.map((s,i)=>[s,i]));
 return median(current.displayedSlugs.flatMap((s,i)=>before.has(s)&&!excluded.has(s)&&!current.pinned.includes(s)?[Math.max(0,i-before.get(s))*MINUTE/(current.observedAt-previous.observedAt)]:[]));
}
function project(snapshot,shift) {
 const pins=new Set(snapshot.pinned),ordinary=snapshot.displayedSlugs.filter(s=>!pins.has(s));
 const moved=[...Array(Math.min(snapshot.size,shift)).fill(null),...ordinary];let i=0;
 return snapshot.displayedSlugs.map(s=>pins.has(s)?s:moved[i++]??null);
}
function insert(order,slug,snapshot,position) {
 const pins=new Set(snapshot.pinned),ordinary=order.filter(s=>!pins.has(s)&&s!==slug);
 const rank=Math.max(0,Math.min(order.length-1,Math.round(position)-1));
 const index=order.slice(0,rank).filter(s=>!pins.has(s)).length;
 ordinary.splice(index,0,slug);let i=0;
 return order.map(s=>pins.has(s)?s:ordinary[i++]??null);
}
export function selectRefresh({snapshot,previous=null,owned,eligible,state=initialControl(),now}) {
 if(!snapshot || now<snapshot.observedAt || now-snapshot.observedAt>120000 || state.pending || state.nextDue>now || state.backoffUntil>now)return null;
 const owners=new Set(owned.map(g=>g.slug)),speed=movement(snapshot,previous),horizon=Math.max(MINUTE,state.spacingMs,median(state.propagations)),shift=Math.ceil(speed*horizon/MINUTE);
 const baseline=project(snapshot,shift),before=vector(baseline,owners),pins=new Set(snapshot.pinned),insertion=state.insertions.length?median(state.insertions):snapshot.pinned.length+1;
 const accounts=[...new Set(eligible.map(g=>g.accountId))].sort(),last=accounts.indexOf(state.lastAccount),rotation=id=>(accounts.indexOf(id)-last-1+accounts.length)%accounts.length;
 const candidates=[];
 for(const g of eligible) {
  if(pins.has(g.slug)||(state.targets[g.id]?.until??0)>now)continue;
  const after=vector(insert(baseline,g.slug,snapshot,insertion),owners),gain=after.map((n,i)=>n-before[i]);
  if(compareGain(gain,[0,0,0])<=0)continue;
  const position=snapshot.displayedSlugs.indexOf(g.slug)+1,projected=baseline.indexOf(g.slug)+1;
  const risk=position>0&&(!projected||position<=50&&projected>50)?3:position>0&&position<=100&&projected>100?2:position>0?1:0;
  candidates.push({id:g.id,slug:g.slug,accountId:g.accountId,gain,before,after,risk,position:position||null,predictedPosition:Math.max(snapshot.pinned.length+1,Math.round(insertion)),movementPerMinute:speed,horizonMs:horizon,lastSave:g.refreshLast?.verifiedAt??0,rotation:rotation(g.accountId)});
 }
 candidates.sort((a,b)=>compareGain(b.gain,a.gain)||b.risk-a.risk||a.lastSave-b.lastSave||a.rotation-b.rotation||a.id.localeCompare(b.id));
 return candidates[0]??null;
}
export function settleRefresh(state,{pending,snapshot,owned,now}) {
 const s=structuredClone(state),at=snapshot.displayedSlugs.indexOf(pending.slug),beforeAt=pending.before.displayedSlugs.indexOf(pending.slug),owners=new Set(owned.map(g=>g.slug));
 const countsBefore=vector(pending.before.displayedSlugs,owners),countsAfter=vector(snapshot.displayedSlugs,owners),gain=countsAfter.map((n,i)=>n-countsBefore[i]);
 // A visible, earlier position or a measured maintained endangered band is a response.
 const responded=at>=0&&(beforeAt<0||at<beforeAt||pending.prediction.risk===3&&at+1<=50||pending.prediction.risk===2&&at+1<=100);
 if(!responded && !pending.propagationChecked) {
  s.pending={...pending,propagationChecked:true,observeAfter:Math.max(now+MINUTE,pending.savedAt+MINUTE)};
  s.nextDue=s.pending.observeAfter;return s;
 }
 const duration=Math.max(1,pending.savedAt-pending.plannedAt);
 s.durations=recent(s.durations,duration);
 if(responded) {
  s.insertions=recent(s.insertions,at+1);s.propagations=recent(s.propagations,Math.max(0,snapshot.observedAt-pending.savedAt));s.rounds++;s.failures=0;
  if(s.rounds>=3) {const sorted=[...s.durations].sort((a,b)=>a-b),p95=sorted[Math.max(0,Math.ceil(sorted.length*.95)-1)];s.spacingMs=Math.max(Math.ceil(s.spacingMs*.8),2*p95);s.rounds=0;}
  delete s.targets[pending.id];
 } else {
  const failures=(s.targets[pending.id]?.failures??0)+1;
  s.targets[pending.id]={failures,until:now+Math.min(MAX_BACKOFF,MINUTE*2**Math.min(5,failures-1)),code:'NO_VISIBILITY_RESPONSE'};
  s.spacingMs=Math.min(MAX_BACKOFF,Math.ceil(s.spacingMs*1.5));s.rounds=0;
 }
 s.last={decisionId:pending.decisionId,generatorId:pending.id,jobId:pending.jobId,prediction:pending.prediction.gain,countsBefore,countsAfter,gain,position:at<0?null:at+1,responded,savedAt:pending.savedAt,observedAt:snapshot.observedAt};
 s.lastAccount=pending.accountId;s.pending=null;s.nextDue=Math.max(now,pending.savedAt+s.spacingMs);return s;
}
export function providerBackoff(state,{now,retryAfterMs=0,jitter=0}) {
 const s=structuredClone(state);s.failures++;s.rounds=0;
 s.backoffUntil=Math.max(s.backoffUntil,now+Math.max(retryAfterMs,Math.min(MAX_BACKOFF,MINUTE*2**Math.min(5,s.failures-1))+Math.max(0,Math.min(5000,jitter))));
 s.nextDue=Math.max(s.nextDue,s.backoffUntil);return s;
}
