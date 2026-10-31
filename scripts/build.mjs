import {cp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {transformDonor} from './donor-overlay.mjs';
import {writeBundledPackages} from './bundled.mjs';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const ID='persona-route-manager@local';
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function files(dir) {
  const result=[];
  for(const item of await readdir(dir,{withFileTypes:true})) {
    if(item.isDirectory())for(const name of await files(path.join(dir,item.name)))result.push(item.name+'/'+name);
    else if(item.isFile())result.push(item.name);
    else throw Error('UNSUPPORTED_FILE: '+item.name);
  }
  return result.sort();
}
export async function verifyVendor() {
  const provenance=JSON.parse(await readFile(path.join(ROOT,'vendor/provenance.json'),'utf8'));
  if(provenance.commit!=='9995f6eadfa54be6cc0001f4e04f2a2d9b9401bf')throw Error('DONOR_PIN_CHANGED');
  const base=path.join(ROOT,'vendor/personamonkey');
  const actual=await files(base);
  if(JSON.stringify(actual)!==JSON.stringify(provenance.files.map(x=>x.path).sort()))throw Error('DONOR_INVENTORY_CHANGED');
  for(const row of provenance.files) {
    const bytes=await readFile(path.join(base,row.path));
    const sha=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
    if(sha!==row.blob)throw Error('DONOR_BYTES_CHANGED: '+row.path);
  }
  return provenance;
}
export async function verifyGraph(stage) {
  for(const file of await files(stage)) {
    if(!/\.(mjs|js)$/.test(file))continue;
    const source=await readFile(path.join(stage,file),'utf8');
    const matches=source.matchAll(/(?:\bimport\s*(?:[^;]*?\s+from\s*)?|\bexport\s+[^;]*?\s+from\s*|\bimport\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g);
    for(const match of matches) {
      const target=path.resolve(stage,path.dirname(file),match[1]);
      if(!target.startsWith(path.resolve(stage)+path.sep))throw Error('IMPORT_ESCAPES_PACKAGE: '+file);
      try{await readFile(target);}catch{throw Error('MISSING_IMPORT: '+file+' -> '+match[1]);}
    }
  }
}
export async function build(output=path.join(ROOT,'build')) {
  const provenance=await verifyVendor();
  const stage=path.join(output,'xpi-root');
  await rm(stage,{recursive:true,force:true}); await mkdir(stage,{recursive:true});
  const donor=path.join(ROOT,'vendor/personamonkey/extension');
  // Remove the old management surfaces and donor test programs from the XPI.
  for(const file of await files(donor)) {
    if(/^(tests|options|popup)\//.test(file))continue;
    const target=path.join(stage,file);await mkdir(path.dirname(target),{recursive:true});
    const original=await readFile(path.join(donor,file));
    const changed=['background.js','lib/recovery-bootstrap.js','lib/mullvad-native.js','lib/mullvad-runtime.js','lib/storage.js'].includes(file);
    await writeFile(target,changed?transformDonor(file,original.toString('utf8')):original);
  }
  await cp(path.join(ROOT,'src/host'),path.join(stage,'host'),{recursive:true});
  await cp(path.join(ROOT,'src/modules'),path.join(stage,'modules'),{recursive:true});
  await cp(path.join(ROOT,'src/core'),path.join(stage,'core'),{recursive:true});
  await cp(path.join(ROOT,'src/ui'),path.join(stage,'ui'),{recursive:true});
  const websitePath=path.join(stage,'host/website-scripts.mjs');
  const websiteCode=(await readFile(websitePath,'utf8')).replaceAll('../../vendor/personamonkey/extension/lib/','../lib/');
  await writeFile(websitePath,websiteCode);
  await writeBundledPackages(stage);
  await mkdir(path.join(stage,'licenses'),{recursive:true});
  await mkdir(path.join(stage,'codecs'),{recursive:true});
  for(const [source,target] of [['fflate/esm/browser.js','fflate.mjs'],['acorn/dist/acorn.mjs','acorn.mjs']])await cp(path.join(ROOT,'node_modules',source),path.join(stage,'codecs',target));
  for(const name of ['fflate','acorn'])await cp(path.join(ROOT,'node_modules',name,'LICENSE'),path.join(stage,'licenses',name+'-LICENSE.txt'));
  const packagePath=path.join(stage,'modules/package.mjs');let packageCode=await readFile(packagePath,'utf8');
  for(const name of ['fflate','acorn']){const anchor="from '"+name+"'";if(packageCode.split(anchor).length!==2)throw Error('CODEC_IMPORT_ANCHOR');packageCode=packageCode.replace(anchor,"from '../codecs/"+name+".mjs'");}await writeFile(packagePath,packageCode);

  const journalPath=path.join(stage,'core/journal-archive.mjs');
  await writeFile(journalPath,(await readFile(journalPath,'utf8')).replace("from 'fflate'","from '../codecs/fflate.mjs'"));
  await cp(path.join(ROOT,'vendor/personamonkey/LICENSE'),path.join(stage,'licenses/PersonaMonkey-MIT.txt'));
  const manifest=JSON.parse(await readFile(path.join(donor,'manifest.json'),'utf8'));
  if(manifest.browser_specific_settings.gecko.id!==ID)throw Error('GECKO_ID_CHANGED');
  manifest.name='PCMS';manifest.version='0.11.0';
  manifest.description='Perchance account and generator management with integrated PersonaMonkey protection.';
  manifest.browser_specific_settings.gecko.strict_min_version='154.0';
  manifest.background={scripts:['host/entry.mjs'],type:'module'};
  manifest.action={...manifest.action,default_title:'Open PCMS dashboard'};
  delete manifest.action.default_popup;
  manifest.options_ui={page:'ui/index.html',open_in_tab:true};
  manifest.sandbox={pages:['host/module-runner.html']};
  manifest.content_security_policy={
    extension_pages:"script-src 'self'; object-src 'none'; base-uri 'none'; frame-src 'self'",
    sandbox:"sandbox allow-scripts; default-src 'none'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'; worker-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'"
  };
  await writeFile(path.join(stage,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  const source=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
  const dirty=!!execFileSync('git',['status','--porcelain','--untracked-files=normal'],{cwd:ROOT,encoding:'utf8'}).trim();
  const identity={format:1,phase:'P11',source,dirty,donor:provenance.commit,alphaReuse:provenance.alpha};
  await writeFile(path.join(stage,'build-identity.json'),JSON.stringify(identity,null,2)+'\n');
  await verifyGraph(stage);
  for(const name of await files(stage))if(/\.(mjs|js)$/.test(name))execFileSync(process.execPath,['--check',path.join(stage,name)],{stdio:'pipe'});
  const outputXpi=path.join(output,'pcms-dev.xpi');
  execFileSync('python3',[path.join(ROOT,'scripts/zip-xpi.py'),stage,outputXpi]);
  const bytes=await readFile(outputXpi);
  const receipt={...identity,xpiSha256:digest(bytes),bytes:bytes.length};
  await writeFile(path.join(output,'identity.json'),JSON.stringify(receipt,null,2)+'\n');
  return {stage,outputXpi,receipt};
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify((await build()).receipt));
}
