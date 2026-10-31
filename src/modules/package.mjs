import {Unzip,UnzipInflate} from 'fflate';
import {parse as parseJavaScript} from 'acorn';
import {sha256} from '../core/records.mjs';
import {CAPABILITIES} from './bindings.mjs';
import {foldPath} from './paths.mjs';
export class PackageError extends Error{constructor(code){super(code);this.code=code;}}
const need=(test,code)=>{if(!test)throw new PackageError(code);};
const utf8=new TextDecoder('utf-8',{fatal:true});
export function safePath(path,directory=false){
 need(typeof path==='string'&&path.length>0&&!/[\\\0:]/.test(path)&&!path.startsWith('/'),'UNSAFE_PATH');
 const normalized=directory?path.replace(/\/$/,''):path;
 need(!normalized.split('/').some(p=>!p||p==='.'||p==='..'),'UNSAFE_PATH');return normalized;
}
export function strictJSON(text){
 let at=0;const ws=()=>{while(/[ \t\r\n]/.test(text[at]??'')&&at<text.length)at++;};
 const string=()=>{const begin=at++;while(at<text.length){const c=text[at++];if(c==='\\'){at++;continue;}if(c==='"')return JSON.parse(text.slice(begin,at));}throw new PackageError('INVALID_JSON');};
 const value=()=>{ws();const c=text[at];if(c==='"')return string();if(c==='{'){at++;const result=Object.create(null),seen=new Set();ws();if(text[at]==='}'){at++;return result;}while(true){ws();need(text[at]==='"','INVALID_JSON');const key=string();need(!seen.has(key),'DUPLICATE_JSON_KEY');seen.add(key);ws();need(text[at++]===':','INVALID_JSON');result[key]=value();ws();const end=text[at++];if(end==='}')return result;need(end===',','INVALID_JSON');}}
 if(c==='['){at++;const result=[];ws();if(text[at]===']'){at++;return result;}while(true){result.push(value());ws();const end=text[at++];if(end===']')return result;need(end===',','INVALID_JSON');}}
 const token=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(at));need(token,'INVALID_JSON');at+=token[0].length;return JSON.parse(token[0]);};
 try{const result=value();ws();need(at===text.length,'INVALID_JSON');return result;}catch(error){if(error instanceof PackageError)throw error;throw new PackageError('INVALID_JSON');}
}
const crcTable=Uint32Array.from({length:256},(_,i)=>{for(let j=0;j<8;j++)i=i&1?0xedb88320^(i>>>1):i>>>1;return i>>>0;});
export function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
export function zipInventory(bytes,budget){
 need(ArrayBuffer.isView(bytes)&&Number.isSafeInteger(budget)&&budget>0,'INVALID_IMPORT_BUDGET');need(bytes.length<=budget,'IMPORT_BUDGET_EXCEEDED');
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),u16=o=>{need(o>=0&&o+2<=bytes.length,'ZIP_TRUNCATED');return v.getUint16(o,true);},u32=o=>{need(o>=0&&o+4<=bytes.length,'ZIP_TRUNCATED');return v.getUint32(o,true);},u64=o=>{need(o>=0&&o+8<=bytes.length,'ZIP_TRUNCATED');const n=v.getBigUint64(o,true);need(n<=BigInt(Number.MAX_SAFE_INTEGER),'ZIP_SIZE_UNSUPPORTED');return Number(n);};
 let eocd=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(u32(i)===0x06054b50&&i+22+u16(i+20)===bytes.length){eocd=i;break;}need(eocd>=0,'ZIP_DIRECTORY_MISSING');
 need(u16(eocd+4)===0&&u16(eocd+6)===0,'MULTIDISK_ZIP');let count=u16(eocd+10),size=u32(eocd+12),offset=u32(eocd+16),directoryEnd=eocd;
 if(count===65535||size===0xffffffff||offset===0xffffffff){const locator=eocd-20;need(u32(locator)===0x07064b50&&u32(locator+4)===0&&u32(locator+16)===1,'INVALID_ZIP64');const z=u64(locator+8);need(u32(z)===0x06064b50&&u32(z+16)===0&&u32(z+20)===0&&u64(z+24)===u64(z+32),'INVALID_ZIP64');count=u64(z+32);size=u64(z+40);offset=u64(z+48);need(z+12+u64(z+4)===locator,'INVALID_ZIP64');directoryEnd=z;}
 else need(u16(eocd+8)===count,'MULTIDISK_ZIP');
 need(offset+size===directoryEnd&&offset>=0&&size>=0&&count<=size/46,'INVALID_ZIP_DIRECTORY');
 function extra(start,length,values){let cursor=start;while(cursor<start+length){const tag=u16(cursor),n=u16(cursor+2);need(cursor+4+n<=start+length,'INVALID_ZIP_EXTRA');if(tag===1){let p=cursor+4;for(const field of ['uncompressed','compressed','local','disk'])if(values[field]===(field==='disk'?65535:0xffffffff)){need(p+(field==='disk'?4:8)<=cursor+4+n,'INVALID_ZIP64');values[field]=field==='disk'?u32(p):u64(p);p+=field==='disk'?4:8;}}cursor+=4+n;}need(cursor===start+length,'INVALID_ZIP_EXTRA');return values;}
 const entries=[],names=new Set();let cursor=offset,total=bytes.length;
 for(let i=0;i<count;i++){
  need(u32(cursor)===0x02014b50,'INVALID_ZIP_DIRECTORY');const flags=u16(cursor+8),method=u16(cursor+10),crc=u32(cursor+16),n=u16(cursor+28),x=u16(cursor+30),comment=u16(cursor+32),attr=u32(cursor+38);
  need(!(flags&0x2041),'ENCRYPTED_ZIP');need(method===0||method===8,'UNSUPPORTED_COMPRESSION');need(cursor+46+n+x+comment<=offset+size,'ZIP_TRUNCATED');
  let path;try{path=utf8.decode(bytes.subarray(cursor+46,cursor+46+n));}catch{throw new PackageError('INVALID_UTF8_PATH');}
  const directory=path.endsWith('/'),normalized=safePath(path,directory),fold=foldPath(normalized);need(!names.has(fold),'PATH_COLLISION');names.add(fold);
  const type=(attr>>>16)&0xf000;need(!type||type===0x8000||type===0x4000,'NON_REGULAR_ZIP_ENTRY');need(type!==0x4000||directory,'INVALID_DIRECTORY_ENTRY');
  const sizes=extra(cursor+46+n,x,{uncompressed:u32(cursor+24),compressed:u32(cursor+20),local:u32(cursor+42),disk:u16(cursor+34)});need(sizes.disk===0,'MULTIDISK_ZIP');
  need(!directory||(sizes.uncompressed===0&&crc===0),'INVALID_DIRECTORY_ENTRY');total+=sizes.uncompressed;need(Number.isSafeInteger(total)&&total<=budget,'IMPORT_BUDGET_EXCEEDED');
  entries.push({path,normalized,directory,flags,method,crc,...sizes});cursor+=46+n+x+comment;
 }
 need(cursor===offset+size,'INVALID_ZIP_DIRECTORY');
 const types=new Map(entries.map(row=>[foldPath(row.normalized),row.directory]));for(const row of entries){const parts=row.normalized.split('/');for(let i=1;i<parts.length;i++)need(types.get(foldPath(parts.slice(0,i).join('/')))!==false,'PATH_COLLISION');}
 let end=0;
 for(const row of [...entries].sort((a,b)=>a.local-b.local)){
  const p=row.local;need(p===end&&u32(p)===0x04034b50,'OVERLAPPING_ZIP_ENTRIES');const n=u16(p+26),x=u16(p+28);need(p+30+n+x<=offset,'ZIP_TRUNCATED');let localName;try{localName=utf8.decode(bytes.subarray(p+30,p+30+n));}catch{throw new PackageError('INVALID_UTF8_PATH');}
  need(localName===row.path&&u16(p+6)===row.flags&&u16(p+8)===row.method,'ZIP_HEADER_MISMATCH');const local=extra(p+30+n,x,{uncompressed:u32(p+22),compressed:u32(p+18)});
  if(!(row.flags&8))need(u32(p+14)===row.crc&&local.compressed===row.compressed&&local.uncompressed===row.uncompressed,'ZIP_HEADER_MISMATCH');
  row.data=p+30+n+x;end=row.data+row.compressed;need(Number.isSafeInteger(end)&&end<=offset,'ZIP_TRUNCATED');
  if(row.flags&8){if(u32(end)===0x08074b50)end+=4;need(u32(end)===row.crc,'ZIP_DESCRIPTOR_MISMATCH');end+=4;const wide=row.uncompressed>0xffffffff||row.compressed>0xffffffff;if(wide){need(u64(end)===row.compressed&&u64(end+8)===row.uncompressed,'ZIP_DESCRIPTOR_MISMATCH');end+=16;}else{need(u32(end)===row.compressed&&u32(end+4)===row.uncompressed,'ZIP_DESCRIPTOR_MISMATCH');end+=8;}}
 }
 need(end===offset,'UNDECLARED_ZIP_DATA');return entries;
}
function exact(value,allowed,required=[]){need(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>allowed.includes(k))&&required.every(k=>Object.hasOwn(value,k)),'INVALID_MANIFEST_FIELDS');}
const positive=v=>Number.isSafeInteger(v)&&v>0;
export function validateManifest(m,entries){
 exact(m,['format','id','name','version','coreApi','jobSchema','readsJobSchemas','capabilities','entries','userscript','pages','settingsSchema','files'],['format','id','name','version','coreApi','jobSchema','readsJobSchemas','capabilities','entries','settingsSchema','files']);
 need(m.format===1&&m.coreApi===1,'INCOMPATIBLE_CORE_API');need(typeof m.id==='string'&&/^[a-z][a-z0-9-]*$/.test(m.id)&&typeof m.name==='string'&&m.name.trim(),'INVALID_MODULE_ID');
 need(typeof m.version==='string'&&/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(m.version)&&m.version.split('.').every(x=>Number.isSafeInteger(Number(x))),'INVALID_RELEASE_VERSION');
 need(positive(m.jobSchema)&&positive(m.settingsSchema)&&Array.isArray(m.readsJobSchemas)&&m.readsJobSchemas.length&&m.readsJobSchemas.every(positive)&&new Set(m.readsJobSchemas).size===m.readsJobSchemas.length&&m.readsJobSchemas.includes(m.jobSchema),'INCOMPATIBLE_SCHEMA');
 need(Array.isArray(m.capabilities)&&m.capabilities.every(c=>CAPABILITIES.has(c))&&new Set(m.capabilities).size===m.capabilities.length,'UNKNOWN_CAPABILITY');
 exact(m.entries,['background','userscript']);const executables=new Set(Object.values(m.entries));m.pages??=[];need(Array.isArray(m.pages),'INVALID_PAGES');const pageIds=new Set();
 for(const page of m.pages){exact(page,['id','title','html','script','style'],['id','title','html','script']);need(typeof page.id==='string'&&/^[a-z][a-z0-9-]*$/.test(page.id)&&!pageIds.has(page.id)&&typeof page.title==='string'&&page.title,'INVALID_PAGES');pageIds.add(page.id);executables.add(page.script);}
 need(executables.size>0,'EMPTY_MODULE');
 if(m.entries.userscript){exact(m.userscript,['matches','lifecycle'],['matches','lifecycle']);need(m.userscript.lifecycle===1&&Array.isArray(m.userscript.matches)&&m.userscript.matches.length&&m.userscript.matches.every(x=>typeof x==='string'&&/^https:\/\/perchance\.org\//.test(x)&&!/[?#]/.test(x)),'INVALID_USERSCRIPT_SCOPE');}else need(!m.userscript,'INVALID_USERSCRIPT_SCOPE');
 need(Array.isArray(m.files),'INVALID_FILE_LIST');const paths=new Set(),folds=new Set();for(const file of m.files){exact(file,['path','bytes','sha256'],['path','bytes','sha256']);safePath(file.path);const folded=foldPath(file.path);need(file.path!=='module.json'&&!paths.has(file.path)&&!folds.has(folded),'PATH_COLLISION');paths.add(file.path);folds.add(folded);need(Number.isSafeInteger(file.bytes)&&file.bytes>=0&&typeof file.sha256==='string'&&/^[a-f0-9]{64}$/.test(file.sha256),'INVALID_FILE_DESCRIPTOR');}
 const actual=entries.filter(x=>!x.directory).map(x=>x.path);need(actual.length===paths.size+1&&actual.includes('module.json')&&actual.every(p=>p==='module.json'||paths.has(p)),'PAYLOAD_LIST_MISMATCH');
 for(const dir of entries.filter(x=>x.directory))need([...paths].some(p=>p.startsWith(dir.normalized+'/')),'UNDECLARED_DIRECTORY');
 for(const path of executables)need(typeof path==='string'&&paths.has(path),'ENTRY_MISSING');
 for(const page of m.pages)for(const path of [page.html,page.style].filter(Boolean))need(paths.has(path),'ENTRY_MISSING');
 return {manifest:m,executables};
}
export async function validatePackage(input,{budget=64*1024*1024}={}){
 const bytes=new Uint8Array(input),entries=zipInventory(bytes,budget),byName=new Map(entries.map(x=>[x.path,x])),files=new Map();let failure=null,total=bytes.length;
 const unzip=new Unzip(file=>{const expected=byName.get(file.name);if(!expected){failure=new PackageError('UNDECLARED_ZIP_DATA');return;}const chunks=[];let size=0;
  file.ondata=(error,chunk,final)=>{if(failure)return;if(error){failure=new PackageError('DECOMPRESSION_FAILED');return;}size+=chunk.length;total+=chunk.length;if(size>expected.uncompressed||total>budget){failure=new PackageError('IMPORT_BUDGET_EXCEEDED');file.terminate?.();return;}chunks.push(chunk);if(final){if(size!==expected.uncompressed){failure=new PackageError('ZIP_SIZE_MISMATCH');return;}const data=new Uint8Array(size);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length;}if(crc32(data)!==expected.crc){failure=new PackageError('ZIP_CRC_MISMATCH');return;}files.set(file.name,data);}};file.start();});
 unzip.register(UnzipInflate);
 try{for(let offset=0;offset<bytes.length&&!failure;offset+=65536)unzip.push(bytes.subarray(offset,offset+65536),offset+65536>=bytes.length);}catch{failure??=new PackageError('DECOMPRESSION_FAILED');}
 if(failure)throw failure;need(files.size===entries.length,'ZIP_SIZE_MISMATCH');need(files.has('module.json'),'MANIFEST_MISSING');
 let text;try{text=utf8.decode(files.get('module.json'));}catch{throw new PackageError('INVALID_MANIFEST_UTF8');}
 const {manifest,executables}=validateManifest(strictJSON(text),entries);
 for(const file of manifest.files){const data=files.get(file.path);need(data.length===file.bytes,'PAYLOAD_SIZE_MISMATCH');need(await sha256(data)===file.sha256,'PAYLOAD_HASH_MISMATCH');}
 for(const path of executables){let ast;try{ast=parseJavaScript(utf8.decode(files.get(path)),{ecmaVersion:'latest',sourceType:'script'});}catch{throw new PackageError('INVALID_EXECUTABLE');}
  const visit=node=>{if(!node||typeof node!=='object')return;need(!['ImportExpression','ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type),'UNSUPPORTED_EXECUTABLE_DEPENDENCY');for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);};visit(ast);
 }
 return {manifest,files,zip:bytes,packageHash:await sha256(bytes),manifestHash:await sha256(files.get('module.json'))};
}
export function compareVersions(a,b){const left=a.split('.').map(Number),right=b.split('.').map(Number);for(let i=0;i<3;i++)if(left[i]!==right[i])return left[i]<right[i]?-1:1;return 0;}
