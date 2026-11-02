"""Minimal trust check of the exact built acceptance XPI, not a rebuild."""
import hashlib,io,json,pathlib,re,subprocess,sys,zipfile

root=pathlib.Path(__file__).resolve().parent.parent
xpi=pathlib.Path(sys.argv[1]).resolve()
identity=json.loads((xpi.parent/'identity.json').read_text())
source=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
assert identity['source']==source and identity['phase']=='P41' and not identity['dirty']
assert not subprocess.check_output(['git','status','--porcelain','--untracked-files=normal'],cwd=root,text=True).strip()
assert hashlib.sha256(xpi.read_bytes()).hexdigest()==identity['xpiSha256'] and xpi.stat().st_size==identity['bytes']
ids=['pcms-accounts','pcms-discover','pcms-creator','pcms-deployer','pcms-refresher','pcms-journal','pcms-backup']
def runtime_check(name,data):
 if not name.endswith(('.js','.mjs','.html','.css')):return
 text=data.decode('utf-8')
 assert not re.search(r'https?://[^\s\x22\x27<>]*\.(?:test|invalid)(?:[/:\x22\x27<>\s]|$)',text),('fixture endpoint',name)
 assert not re.search(r'__P\d+_(?:BLOCKED|STAGE|NATIVE_DOWNLOAD)|MOZ_DISABLE_\w*SANDBOX',text),('test bypass',name)
 assert not re.search(r'\b(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})\b',text),('credential',name)
with zipfile.ZipFile(xpi) as z:
 assert z.testzip() is None
 names=z.namelist();assert len(names)==len(set(names))
 assert not any(n.startswith(('tests/','popup/','options/','private/')) or '/tests/' in n or n.endswith(('.sqlite','.pem','.key','.pcms.zip')) or n=='credentials.json' for n in names)
 inner=json.loads(z.read('build-identity.json'));assert inner=={k:v for k,v in identity.items() if k not in ['xpiSha256','bytes']}
 assert inner['donor']=='9995f6eadfa54be6cc0001f4e04f2a2d9b9401bf'
 m=json.loads(z.read('manifest.json'));original=json.loads((root/'vendor/personamonkey/extension/manifest.json').read_text())
 assert m['name']=='PCMS' and m['version']=='0.49.0' and m['browser_specific_settings']['gecko']['id']=='persona-route-manager@local' and m['browser_specific_settings']['gecko']['strict_min_version']=='154.0'
 for field in ['permissions','optional_permissions','host_permissions']:assert m.get(field)==original.get(field),field
 assert m['background']=={'scripts':['host/entry.mjs'],'type':'module'} and 'default_popup' not in m['action']
 assert m['options_ui']=={'page':'ui/index.html','open_in_tab':True}
 assert 'unsafe-eval' not in m['content_security_policy']['extension_pages'] and 'allow-same-origin' not in m['content_security_policy']['sandbox']
 assert re.findall(r"^import ['\x22]([^'\x22]+)['\x22];",z.read('host/entry.mjs').decode(),re.M)==['../lib/recovery-bootstrap.js','./shell.mjs']
 registry=json.loads(z.read('bundled/registry.json'));assert [p['id'] for p in registry['packages']]==ids
 for p in registry['packages']:
  raw=z.read('bundled/'+p['id']+'.zip');assert hashlib.sha256(raw).hexdigest()==p['packageHash']
  with zipfile.ZipFile(io.BytesIO(raw)) as package:
   assert package.testzip() is None
   manifest=package.read('module.json');d=json.loads(manifest);assert hashlib.sha256(manifest).hexdigest()==p['manifestHash'] and d['id']==p['id'] and d['coreApi']==1 and d['capabilities']
   assert set(package.namelist())=={'module.json',*[f['path'] for f in d['files']]}
   assert b'MODULE_NOT_IMPLEMENTED' not in package.read(d['entries']['background'])
   for f in d['files']:
    data=package.read(f['path']);assert len(data)==f['bytes'] and hashlib.sha256(data).hexdigest()==f['sha256'];runtime_check(p['id']+'/'+f['path'],data)
 for name in names:
  if name.startswith(('core/','modules/','host/','ui/')):runtime_check(name,z.read(name))
print(json.dumps({'tier':'T/P41/artifact','source':source,'xpiSha256':identity['xpiSha256'],'bytes':identity['bytes'],'modules':ids,'checks':['clean-source-and-inner-outer-identity','retained-ID-permissions-floor-CSP-donor-first','seven-complete-package-hashes-capabilities','no-fixture-endpoint-test-bypass-credential-or-legacy-surface'],'result':'PASS'}))
