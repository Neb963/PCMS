// Accepted PCMS-1 declaration. Defaults are for future creation only.
export const INITIAL_MARKER='Format: PCMS-1\nVersion: v1\nAction: DEVELOP\nStatus: NOT_READY\n';
export function parseDeploymentMarker(bytes){
 const fail=(code,field=null)=>({ok:false,code,field});let text;
 if(bytes[0]===239&&bytes[1]===187&&bytes[2]===191)return fail('MARKER_BOM');
 try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return fail('MARKER_UTF8');}
 text=text.replaceAll('\r\n','\n');if(text.includes('\r'))return fail('MARKER_NEWLINE');if(text.endsWith('\n'))text=text.slice(0,-1);
 const lines=text.split('\n'),names=['Format','Version','Action','Status'];if(lines.length!==4)return fail('MARKER_FIELDS');
 for(let i=0;i<4;i++)if(!lines[i].startsWith(names[i]+': '))return fail('MARKER_FIELDS',names[i]);
 const values=lines.map((line,i)=>line.slice(names[i].length+2));
 if(values[0]!=='PCMS-1')return fail('MARKER_FORMAT','Format');
 if(!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(values[1]))return fail('MARKER_VERSION','Version');
 if(!['DEVELOP','DEPLOY'].includes(values[2]))return fail('MARKER_ACTION','Action');
 if(!['NOT_READY','READY','DONE'].includes(values[3]))return fail('MARKER_STATUS','Status');
 return {ok:true,version:values[1],action:values[2],status:values[3]};
}
