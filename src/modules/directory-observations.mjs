import {requireCore as check} from '../core/records.mjs';
import {nativeSlug} from './slug-observations.mjs';
export const DIRECTORY_CADENCE=60000,DIRECTORY_FRESHNESS=120000,DIRECTORY_AFTER_SAVE=5000;
export function directoryFrameURL(raw){try{const u=new URL(raw);return u.protocol==='https:'&&u.pathname==='/generators'&&(u.hostname==='perchance.org'||/^[a-f0-9]{32}\.perchance\.org$/.test(u.hostname))&&!u.hash.startsWith('#edit');}catch{return false;}}
export function directorySlug(raw){try{const u=new URL(raw);if(u.protocol!=='https:'||u.hostname!=='perchance.org'||u.search||u.hash)return null;const name=decodeURIComponent(u.pathname.slice(1));return nativeSlug(name)===name&&!['generators','plugins','templates','resources','login','signup','settings','search','welcome','about','privacy','terms','tutorial'].includes(name)?name:null;}catch{return null;}}
export function collectDirectory(partial,packet){
 if(packet?.ok!==true)return {state:packet?.loading?'WAITING':'INCOMPLETE',code:packet?.code??'DIRECTORY_UNKNOWN',partial};
 check(packet.source==='PERCHANCE_RENDERED_DIRECTORY_1'&&directoryFrameURL(packet.url)&&typeof packet.context==='string'&&packet.context.length>0&&Number.isSafeInteger(packet.total)&&packet.total>=0&&Array.isArray(packet.entries)&&Number.isFinite(packet.observedAt),'DIRECTORY_PACKET_INVALID');
 if(partial&&(partial.context!==packet.context||partial.total!==packet.total))return {state:'INCOMPLETE',code:'DIRECTORY_CONTEXT_CHANGED',partial};
 const rows={...partial?.rows};
 for(const row of packet.entries){const slug=directorySlug(row.href);check(slug&&Number.isSafeInteger(row.position)&&row.position>=1&&row.position<=packet.total&&typeof row.pinned==='boolean','DIRECTORY_ENTRY_INVALID');const value={slug,pinned:row.pinned};if(rows[row.position]&&JSON.stringify(rows[row.position])!==JSON.stringify(value))return {state:'INCOMPLETE',code:'DIRECTORY_ORDER_CHANGED',partial};rows[row.position]=value;}
 const next={context:packet.context,total:packet.total,revision:packet.revision??null,rows,filterContext:packet.filterContext??[],url:packet.url,observedAt:packet.observedAt};
 const complete=Object.keys(rows).length===packet.total&&Array.from({length:packet.total},(_,i)=>rows[i+1]).every(Boolean);
 if(complete&&packet.loaded===true){const seen=new Set(),entries=[];for(let i=1;i<=packet.total;i++){const r=rows[i];if(!seen.has(r.slug)){seen.add(r.slug);entries.push({...r,position:entries.length+1});}}return {state:'COMPLETE',snapshot:{schema:1,source:packet.source,context:packet.context,filterContext:next.filterContext,revision:next.revision,observedAt:packet.observedAt,displayedSlugs:entries.map(e=>e.slug),entries,pinned:entries.filter(e=>e.pinned).map(e=>e.slug),size:entries.length,renderedRows:packet.total,url:packet.url},partial:next};}
 if(!packet.revision&&packet.total>packet.entries.length)return {state:'INCOMPLETE',code:'DIRECTORY_PAGING_UNVERIFIED',partial:next};
 const positions=Object.keys(rows).map(Number),minimum=positions.length?Math.min(...positions):0;
 const action=minimum>1&&packet.canFirst?'FIRST':packet.canNext?'NEXT':packet.canMore?'MORE':packet.canScroll?'SCROLL':null;
 return action?{state:'ADVANCE',action,signature:packet.signature,partial:next}:{state:packet.loaded?'INCOMPLETE':'WAITING',code:packet.loaded?'DIRECTORY_PAGE_GAP':'DIRECTORY_LOADING',partial:next};
}
export function applyDirectory(previous,result,{order,at}){
 const d=structuredClone(previous??{schema:1,current:null,lastGood:null,history:[],invalidation:0});
 if(d.current&&order<d.current.order)return d;
 if(result.state==='COMPLETE'){const snapshot=result.snapshot;d.current={order,at,complete:true,code:null};if(d.lastGood)d.history=[d.lastGood,...d.history].slice(0,4);d.lastGood=snapshot;}
 else{d.current={order,at,complete:false,code:result.code??'DIRECTORY_INCOMPLETE'};d.invalidation=(d.invalidation??0)+1;}
 return d;
}
export function directoryProjection(state,owned,now){
 const good=state?.lastGood,age=good?now-good.observedAt:null,fresh=!!good&&state?.current?.complete===true&&age>=0&&age<=DIRECTORY_FRESHNESS;
 const counts=snapshot=>{const own=new Set(owned.map(g=>g.slug));return {top50:snapshot.displayedSlugs.slice(0,50).filter(s=>own.has(s)).length,top100:snapshot.displayedSlugs.slice(0,100).filter(s=>own.has(s)).length,full:snapshot.displayedSlugs.filter(s=>own.has(s)).length};};
 const positions=Object.fromEntries(owned.map(g=>{const at=good?.displayedSlugs.indexOf(g.slug)??-1;return [g.id,{state:!good?'NOT_MEASURED':!fresh?'UNKNOWN':at<0?'NOT_SEEN':'MEASURED',position:fresh&&at>=0?at+1:null,lastGoodPosition:at>=0?at+1:null}];}));
 return {available:true,fresh,state:!good?'NOT_MEASURED':fresh?'CURRENT':'UNKNOWN',code:fresh?null:state?.current?.code??(good?'DIRECTORY_STALE':'DIRECTORY_NOT_MEASURED'),observedAt:good?.observedAt??null,ageMs:age!==null&&age>=0?age:null,size:fresh?good.size:null,lastGoodSize:good?.size??null,counts:fresh?counts(good):null,lastGoodCounts:good?counts(good):null,positions,filterContext:good?.filterContext??[],invalidation:state?.invalidation??0};
}
