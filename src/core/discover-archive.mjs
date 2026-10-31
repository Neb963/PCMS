import {zipSync,unzipSync,strToU8} from 'fflate';
import {sha256,requireCore as check} from './records.mjs';
export async function discoverArchive(job){
 const rows=job.discover.rows.map(({index,raw,slug,state,result,basis,reason,duplicateOf,checkedAt,admissionCode,lastAttemptAt})=>({index,raw,slug,state,result,basis:basis??reason,duplicateOf,checkedAt,admissionCode:admissionCode??null,lastAttemptAt:lastAttemptAt??null}));
 const data={format:'pcms-discover',schema:1,batchId:job.id,createdAt:job.createdAt,original:job.input.original,mode:job.discover.mode,rows};
 const json=strToU8(JSON.stringify(data,null,2)+'\n'),cell=value=>'"'+String(value??'').replaceAll('"','""')+'"';
 const csv=strToU8([['index','input','slug','state','result','basis','duplicateOf','checkedAt'],...rows.map(r=>[r.index,r.raw,r.slug,r.state,r.result,r.basis,r.duplicateOf,r.checkedAt?new Date(r.checkedAt).toISOString():null])].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n');
 const manifest={format:'pcms-discover-export',schema:1,batchId:job.id,count:rows.length,jsonSha256:await sha256(json),csvSha256:await sha256(csv)};
 const bytes=zipSync({'results.json':json,'results.csv':csv,'manifest.json':strToU8(JSON.stringify(manifest))},{level:6});
 const reopened=unzipSync(bytes);check(await sha256(reopened['results.json'])===manifest.jsonSha256&&await sha256(reopened['results.csv'])===manifest.csvSha256,'DISCOVER_EXPORT_INVALID');
 return {bytes,manifest};
}
