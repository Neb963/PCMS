// Fixed read-only classifier. The exact accepted literals are v42/design §6.2.
// No provider mutation, credentials, arbitrary selector or remote code.
export const AVAILABLE='(⊙.⊙) sorry, we cannot find a generator with that name! create one?';
export const RESERVED='(⊙.⊙) sorry, this is a reserved name - had to do this because a few users where "name-squatting" on lots of common words and not actually using them ¯\\_(⊙_ʖ⊙)_/¯';
export const layoutText=text=>String(text??'').replace(/\s+/gu,' ').trim();
export function nativeSlug(raw){
 if(typeof raw!=='string')return null;
 const value=raw.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
 return value==='hub'||/^[a-z0-9][a-z0-9-]{2,98}[a-z0-9]$/.test(value)?value:null;
}
export function importSlugs(text){
 if(typeof text!=='string')throw Error('DISCOVER_INPUT_INVALID');
 const seen=new Map();
 return text.split(/\r\n|\n|\r/).map((raw,index)=>{
  const slug=nativeSlug(raw),previous=slug?seen.get(slug):undefined;
  if(slug&&previous===undefined)seen.set(slug,index);
  return {index,raw,slug,state:!slug?'REJECTED':previous!==undefined?'COLLISION':'PENDING',reason:!slug?'NATIVE_NAME_INVALID':previous!==undefined?'NORMALIZATION_COLLISION':null,duplicateOf:previous??null,result:null,checkedAt:null};
 });
}
export function classifySlug(page){
 const unknown=code=>({result:'Unknown',basis:code});
 if(!page||page.transportError)return unknown('SLUG_TRANSPORT_ERROR');
 if(page.challenge)return unknown('SLUG_CHALLENGE');
 if(page.complete!==true)return unknown('SLUG_DOCUMENT_LOADING');
 const text=layoutText(page.text),available=text===AVAILABLE,reserved=text===RESERVED;
 const content=page.rootOutput===true||(page.requiredFrames??[]).some(frame=>frame.accessible===true&&frame.complete===true&&frame.content===true&&!frame.challenge);
 if((available||reserved)&&content||available&&reserved)return unknown('SLUG_CONFLICTING_EVIDENCE');
 if(available)return {result:'Available',basis:'EXACT_AVAILABLE_MESSAGE'};
 if(reserved)return {result:'Taken',basis:'EXACT_RESERVED_MESSAGE'};
 if(content)return {result:'Taken',basis:'ACTUAL_GENERATOR_OUTPUT'};
 if((page.requiredFrames??[]).some(frame=>frame.challenge))return unknown('SLUG_CHALLENGE');
 if((page.requiredFrames??[]).some(frame=>!frame.accessible))return unknown('SLUG_FRAME_INACCESSIBLE');
 return unknown('SLUG_CONTENT_UNVERIFIED');
}
// Executed only by the packaged adapter in an exact protected document.
// The witness and passive manual-use guard stay in the isolated world.
export function captureSlugDocument({install=false,dispose=false}={}){
 const key='__PCMS_DISCOVER_DOCUMENT_1';
 if(dispose){const old=globalThis[key];if(old){for(const type of old.events)document.removeEventListener(type,old.listener,true);delete globalThis[key];}return null;}
 if(install&&!globalThis[key]){
  const value={id:crypto.randomUUID(),dirty:false,events:['pointerdown','keydown','input','change']};
  value.listener=event=>{if(event.isTrusted)value.dirty=true;};
  for(const type of value.events)document.addEventListener(type,value.listener,true);
  Object.defineProperty(globalThis,key,{value,configurable:true});
 }
 const visible=element=>{
  if(!element)return '';const style=getComputedStyle(element);
  if(style.display==='none'||style.visibility==='hidden'||!element.getClientRects().length)return '';
  return String(element.innerText??'').replace(/\s+/gu,' ').trim();
 };
 const actual=element=>{
  if(!element)return false;
  const text=visible(element);if(text&&!/^(?:loading[.!… ]*|please wait[.!… ]*|error[.!… ]*)$/i.test(text))return true;
  return [...element.querySelectorAll('img')].some(img=>img.complete&&img.naturalWidth>0&&img.naturalHeight>0&&img.getClientRects().length>0);
 };
 const challenge=!!document.querySelector('#challenge-running,#challenge-form,.cf-turnstile,iframe[src*="challenges.cloudflare.com"]')||/^(?:just a moment|attention required)/i.test(document.title);
 const witness=globalThis[key];
 return {url:location.href,witness:witness?.id??null,manual:witness?.dirty===true,complete:document.readyState==='complete',challenge,
  text:visible(document.body).slice(0,20000),rootOutput:actual(document.querySelector('#outputEl')),
  bodyContent:actual(document.body),frames:[...document.querySelectorAll('iframe#outputIframe')].filter(frame=>frame.getClientRects().length>0).map(frame=>({url:frame.src||null}))};
}
