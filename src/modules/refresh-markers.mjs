import {requireCore as check} from '../core/records.mjs';
export const MARKER_RECIPE='PCMS_SIMPLE_PJS_HTML_MARKER_1';
const decode=bytes=>{try{return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{check(false,'MARKER_UTF8_UNSUPPORTED');}};
const bom=s=>s.charCodeAt(0)===0xfeff?1:0;
const mentions=s=>(s.match(/pcms-refresh/g)??[]).length;
function pjs(text){
 const lines=text.slice(bom(text)).split(/\r\n|\n|\r/),names=new Set(),references=[];let list=false,items=0;
 for(const line of lines){if(!line.trim()||line.trimStart().startsWith('//'))continue;
  if(!line.startsWith(' ')){check(/^[A-Za-z_][A-Za-z0-9_]*$/.test(line)&&!names.has(line),'MARKER_PJS_SYNTAX_UNSUPPORTED');names.add(line);list=true;continue;}
  check(list&&/^ {2}[^ ]/.test(line)&&!line.includes('\t')&&!/[{}'"\x60]/.test(line)&&!line.includes('//'),'MARKER_PJS_SYNTAX_UNSUPPORTED');
  let value=line.slice(2),at=0;while(at<value.length){const open=value.indexOf('[',at),close=value.indexOf(']',at);if(open<0){check(close<0,'MARKER_PJS_SYNTAX_UNSUPPORTED');break;}check(close>open&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(value.slice(open+1,close)),'MARKER_PJS_SYNTAX_UNSUPPORTED');references.push(value.slice(open+1,close));at=close+1;}items++;
 }
 check(names.has('output')&&items>0&&references.every(n=>names.has(n)),'MARKER_PJS_SYNTAX_UNSUPPORTED');
 return {boundary:bom(text),newline:text.match(/\r\n|\n|\r/)?.[0]??'\n'};
}
// Bounded HTML tokenizer: prolog/doctype, quoted attributes, raw text,
// comments and template nesting are parsed before a comment span is admitted.
// Unsupported/malformed documents hold rather than being repaired.
function html(text){
 const comments=[],stack=[],voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']),raws=new Set(['script','style','textarea','title','xmp','iframe','noembed','noframes']);
 let at=bom(text),boundary=at,doctype=false,content=false;
 while(at<text.length){
  if(text.startsWith('<!--',at)){const end=text.indexOf('-->',at+4);check(end>=0&&!text.slice(at+4,end).includes('<!--')&&!text.slice(at+4,end).includes('--'),'MARKER_HTML_COMMENT_UNSUPPORTED');comments.push({start:at,end:end+3,template:stack.includes('template'),value:text.slice(at,end+3)});at=end+3;continue;}
  if(text[at]!=='<'){const next=text.indexOf('<',at),end=next<0?text.length:next;if(!content)check(!text.slice(at,end).trim(),'MARKER_HTML_PROLOG_UNSUPPORTED');at=end;continue;}
  if(/^<!doctype\b/i.test(text.slice(at))){const end=text.indexOf('>',at);check(end>=0&&!doctype&&!content&&/^<!doctype\s+html\s*>$/i.test(text.slice(at,end+1)),'MARKER_HTML_DOCTYPE_UNSUPPORTED');doctype=true;boundary=end+1;at=end+1;continue;}
  const match=/^<(\/?)([A-Za-z][A-Za-z0-9:-]*)\b/.exec(text.slice(at));check(match,'MARKER_HTML_SYNTAX_UNSUPPORTED');const closing=!!match[1],name=match[2].toLowerCase();let end=at+match[0].length,quote=null;
  for(;end<text.length;end++){const c=text[end];if(quote){if(c===quote)quote=null;}else if(c==='"'||c==="'")quote=c;else if(c==='>')break;else check(c!=='<','MARKER_HTML_SYNTAX_UNSUPPORTED');}
  check(end<text.length&&!quote,'MARKER_HTML_SYNTAX_UNSUPPORTED');const tail=text.slice(at+match[0].length,end);if(closing){check(!tail.trim()&&stack.at(-1)===name,'MARKER_HTML_NESTING_UNSUPPORTED');stack.pop();at=end+1;continue;}
  check(name!=='plaintext'&&name!=='noscript','MARKER_HTML_RAW_UNSUPPORTED');content=true;const self=/\/\s*$/.test(tail);check(!self||voids.has(name),'MARKER_HTML_NESTING_UNSUPPORTED');at=end+1;if(voids.has(name))continue;
  if(raws.has(name)){const closingPattern=new RegExp('</'+name+'\\s*>','ig');closingPattern.lastIndex=at;const close=closingPattern.exec(text);check(close,'MARKER_HTML_RAW_UNSUPPORTED');at=close.index+close[0].length;continue;}
  stack.push(name);
 }
 check(stack.length===0,'MARKER_HTML_NESTING_UNSUPPORTED');return {boundary,comments};
}
function replace(text,kind,id,previous,next){
 const info=kind==='PJS'?pjs(text):html(text),owned=kind==='PJS'?'// pcms-refresh:'+id+':'+previous:'<!-- pcms-refresh:'+id+':'+previous+' -->',marker=kind==='PJS'?'// pcms-refresh:'+id+':'+next:'<!-- pcms-refresh:'+id+':'+next+' -->';
 const count=mentions(text);check(count<=1,'MARKER_DUPLICATE');let start=info.boundary,end=start;
 if(count){if(kind==='PJS'){check(text.startsWith(owned,start)&&['\r','\n',''].includes(text[start+owned.length]??''),'MARKER_MODIFIED_OR_MOVED');end=start+owned.length;}
  else{const comment=info.comments.find(c=>c.start===start&&c.value===owned&&!c.template);check(comment,'MARKER_MODIFIED_OR_UNSAFE');end=comment.end;}}
 else check(previous===0,'MARKER_REMOVED');
 const inserted=marker+(!count&&kind==='PJS'?info.newline:''),value=text.slice(0,start)+inserted+text.slice(end);
 check(value!==text&&value.slice(0,start)===text.slice(0,start)&&value.slice(start+inserted.length)===text.slice(end),'MARKER_PRESERVATION_FAILED');
 // Parse the resulting document again; only our one exact comment differs.
 if(kind==='PJS')pjs(value);else html(value);
 return {bytes:new TextEncoder().encode(value),change:{start,end,inserted}};
}
export function planRefreshMarkers(files,{markerId,counter}){
 check(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(markerId)&&Number.isSafeInteger(counter)&&counter>0,'MARKER_IDENTITY_INVALID');
 check(Array.isArray(files)&&files.filter(f=>f.path==='main.pjs').length===1&&files.filter(f=>f.path==='index.html').length===1&&new Set(files.map(f=>f.path)).size===files.length&&files.every(f=>['main.pjs','index.html'].includes(f.path)||f.path.startsWith('src/')),'MARKER_SOURCE_SET_INVALID');
 const changes={},planned=files.map(f=>{if(!['main.pjs','index.html'].includes(f.path))return {path:f.path,bytes:new Uint8Array(f.bytes)};const r=replace(decode(f.bytes),f.path==='main.pjs'?'PJS':'HTML',markerId,counter-1,counter);changes[f.path]=r.change;return {path:f.path,bytes:r.bytes};});
 return {recipe:MARKER_RECIPE,markerId,counter,files:planned,changes};
}
