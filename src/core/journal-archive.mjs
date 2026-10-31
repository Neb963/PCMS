import {zipSync,unzipSync,strToU8} from 'fflate';
import {sha256,requireCore as check} from './records.mjs';
import {zipInventory} from '../modules/package.mjs';
export async function journalArchive(core,{first,last}){
 check(Number.isSafeInteger(first)&&first>0&&Number.isSafeInteger(last)&&last>=first&&last<=(await core.status()).sequence,'JOURNAL_RANGE_INVALID');
 const rows=[],gaps=[];let cursor=null,expected=first;
 do{const page=await core.list({table:'events',cursor,limit:200});for(const row of page.rows){if(row.sequence<first)continue;if(row.sequence>last)break;if(row.sequence>expected)gaps.push([expected,row.sequence-1]);expected=row.sequence+1;rows.push(row);}cursor=page.cursor;if(page.rows.at(-1)?.sequence>=last)break;}while(cursor);
 if(expected<=last)gaps.push([expected,last]);
 const events=strToU8(rows.map(row=>JSON.stringify(row)+'\n').join(''));
 const manifest={format:'pcms-journal',schema:1,first,last,count:rows.length,gaps,coverageComplete:gaps.length===0,eventBytes:events.length,eventSha256:await sha256(events)};
 const manifestBytes=strToU8(JSON.stringify(manifest)),complete=strToU8(JSON.stringify({schema:1,manifestSha256:await sha256(manifestBytes)}));
 const bytes=zipSync({'manifest.json':manifestBytes,'events.jsonl':events,'COMPLETE':complete},{level:6});await verifyJournalArchive(bytes);return {bytes,manifest};
}
export async function verifyJournalArchive(bytes){
 const inventory=zipInventory(bytes,Number.MAX_SAFE_INTEGER);check(inventory.length===3&&inventory.every(i=>['manifest.json','events.jsonl','COMPLETE'].includes(i.path)),'JOURNAL_ARCHIVE_INVALID');
 const files=unzipSync(bytes),decode=b=>new TextDecoder('utf-8',{fatal:true}).decode(b),m=JSON.parse(decode(files['manifest.json'])),done=JSON.parse(decode(files.COMPLETE));
 check(m.format==='pcms-journal'&&m.schema===1&&done.schema===1&&done.manifestSha256===await sha256(files['manifest.json'])&&m.eventBytes===files['events.jsonl'].length&&m.eventSha256===await sha256(files['events.jsonl']),'JOURNAL_ARCHIVE_INVALID');
 const rows=decode(files['events.jsonl']).split('\n').filter(Boolean).map(line=>JSON.parse(line));check(rows.length===m.count,'JOURNAL_ARCHIVE_INVALID');let expected=m.first;const gaps=[];
 for(const row of rows){check(Number.isSafeInteger(row.sequence)&&row.sequence>=expected&&row.sequence<=m.last,'JOURNAL_ARCHIVE_INVALID');if(row.sequence>expected)gaps.push([expected,row.sequence-1]);expected=row.sequence+1;}
 if(expected<=m.last)gaps.push([expected,m.last]);check(JSON.stringify(gaps)===JSON.stringify(m.gaps)&&m.coverageComplete===(gaps.length===0),'JOURNAL_ARCHIVE_INVALID');return m;
}
