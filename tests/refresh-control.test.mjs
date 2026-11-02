import test from 'node:test';
import assert from 'node:assert/strict';
import {initialControl,selectRefresh,settleRefresh,movement,providerBackoff} from '../src/modules/refresh-control.mjs';
const now=1000000;
const snapshot=(order,at=now,pinned=[])=>({displayedSlugs:order,size:order.length,observedAt:at,context:'public',pinned});
const others=n=>Array.from({length:n},(_,i)=>'other-'+i);
const owned=n=>Array.from({length:n},(_,i)=>({id:'owned-'+String(i).padStart(3,'0'),slug:'owned-'+i,accountId:'account-'+i%3}));
const choose=(s,gs,extra={})=>selectRefresh({snapshot:s,owned:gs,eligible:gs,state:initialControl(),now,...extra});
test('30, 60, 90 and 150 Active keep lexicographic top50/top100/full priorities with pins',()=>{
 for(const size of [30,60,90,150]) {
  const gs=owned(size),order=others(160);order[60]=gs[0].slug;order[120]=gs[1].slug;
  const s=snapshot(['native-pin',...order],now,['native-pin']),d=choose(s,gs);
  assert.deepEqual(d.gain,[1,1,1]);assert.equal(d.position,null);assert.equal(d.predictedPosition,2);
  const saturated=[...gs.slice(0,50).map(g=>g.slug),...others(110)];
  if(size>=60){const selected=choose(snapshot(saturated),gs);assert.equal(selected.gain[0],0);assert.equal(selected.gain[1],1);assert.equal(selected.gain[2],1);}
 }
});
test('all bands owned and no measured pressure means no save; asleep/ineligible entries only count',()=>{
 const gs=owned(30),s=snapshot([...gs.map(g=>g.slug),...others(130)]);
 assert.equal(choose(s,gs),null);
 assert.equal(choose(snapshot(others(160)),gs,{eligible:[]}),null);
 const asleep=owned(100),top=snapshot([...asleep.map(g=>g.slug),...others(60)]);
 assert.equal(choose(top,asleep,{eligible:asleep.slice(0,30)}),null);
});
test('measured downward pressure repeats a visible endangered target on an equal gain',()=>{
 const gs=owned(2),old=others(160),order=others(160);old[39]=gs[0].slug;order[49]=gs[0].slug;old[100]=gs[1].slug;order[110]=gs[1].slug;
 // Independent common entries move ten places. Removed tail is not invented as evidence.
 for(let i=0;i<130;i++){old[i]='shared-'+i;order[i+10]='shared-'+i;}old[39]=gs[0].slug;order[49]=gs[0].slug;old[69]=gs[1].slug;order[79]=gs[1].slug;
 const s=snapshot(order),previous=snapshot(old,now-60000),d=choose(s,gs,{previous});
 assert.equal(movement(s,previous),10);assert.equal(d.id,gs[0].id);assert.equal(d.risk,3);assert.equal(d.gain[0],1);assert.equal(d.position,50);
});
test('cooldowns, stale/clock reversal, one pending writer and oldest/account ties are deterministic',()=>{
 const gs=owned(3),s=snapshot(others(160)),state=initialControl();state.targets[gs[0].id]={until:now+1};gs[1].refreshLast={verifiedAt:500};
 assert.equal(choose(s,gs,{state}).id,gs[2].id);
 assert.equal(choose(snapshot(others(160),now-120001),gs),null);
 assert.equal(choose(snapshot(others(160),now+1),gs),null);
 assert.equal(choose(s,gs,{state:{...state,pending:{id:'original'}}}),null);
 assert.equal(choose(s,gs,{state:{...state,nextDue:now+1}}),null);
 assert.equal(choose(s,gs,{state:{...state,backoffUntil:now+1}}),null);
 const fair=initialControl();fair.lastAccount=gs[0].accountId;assert.equal(choose(s,gs.map(g=>({...g,refreshLast:null})),{state:fair}).accountId,gs[1].accountId);
});
test('no-response waits another normal observation then backs off target without false visibility',()=>{
 const gs=owned(1),before=snapshot(others(160),now-10000),state=initialControl(),pending={id:gs[0].id,slug:gs[0].slug,accountId:gs[0].accountId,decisionId:'decision',jobId:'job',plannedAt:now-9000,savedAt:now-5000,before,prediction:{gain:[1,1,1],risk:0}};
 const wait=settleRefresh(state,{pending,snapshot:snapshot(others(160)),owned:gs,now});assert.equal(wait.pending.propagationChecked,true);assert.equal(wait.last,null);assert.equal(wait.nextDue,now+60000);
 const held=settleRefresh(wait,{pending:wait.pending,snapshot:snapshot(others(160),now+60000),owned:gs,now:now+60000});assert.equal(held.pending,null);assert.equal(held.last.responded,false);assert.equal(held.last.position,null);assert.equal(held.targets[gs[0].id].until,now+120000);assert.equal(held.spacingMs,45000);
});
test('three measured useful rounds speed up with p95 floor; provider Retry-After and exponential wait',()=>{
 const gs=owned(1);let state=initialControl();
 for(let i=0;i<3;i++){const pending={id:gs[0].id,slug:gs[0].slug,accountId:gs[0].accountId,decisionId:'decision'+i,jobId:'job'+i,plannedAt:now-20000,savedAt:now-5000,before:snapshot(others(160),now-30000),prediction:{gain:[1,1,1],risk:0}};state=settleRefresh(state,{pending,snapshot:snapshot([gs[0].slug,...others(159)]),owned:gs,now});}
 assert.equal(state.spacingMs,30000);assert.equal(state.last.responded,true);assert.deepEqual(state.last.gain,[1,1,1]);
 state=providerBackoff(state,{now,retryAfterMs:180000,jitter:50});assert.equal(state.backoffUntil,now+180000);
 state=providerBackoff(state,{now,jitter:0});assert.equal(state.backoffUntil,now+180000);
});
