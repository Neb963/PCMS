"""Independent GitHub-shaped HTTPS fixture backed by real Git plumbing.
Every object/ref stays in a disposable bare repository. No external remotes.
"""
import base64,datetime,hashlib,http.server,json,pathlib,re,socket,ssl,subprocess,sys,threading,uuid
from urllib.parse import urlsplit
from git_https_fixture import GitFixture,TOKEN,declaration
SHA=re.compile(r'^[a-f0-9]{40}$')
def git(root,*args,data=None,check=True):
 p=subprocess.run(['git','-c','core.hooksPath=/dev/null','-c','safe.directory='+str(pathlib.Path(root)/'remote.git'),'--git-dir',str(pathlib.Path(root)/'remote.git'),*args],input=data,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if check and p.returncode:raise RuntimeError('INDEPENDENT_GIT_COMMAND_FAILED')
 return p.stdout if check else p
def put_blob(root,data):return git(root,'hash-object','-w','--stdin',data=data).decode().strip()
def put_tree(root,entries):
 raw=b''.join((e['mode']+' '+e['type']+' '+e['sha']+'\t').encode()+e['path'].encode()+b'\0' for e in entries)
 return git(root,'mktree','-z',data=raw).decode().strip()
def tree(root,sha):
 rows=[]
 for row in git(root,'ls-tree','-z',sha).split(b'\0'):
  if row:
   meta,path=row.split(b'\t',1);mode,kind,oid=meta.decode().split(' ');rows.append({'mode':mode,'type':kind,'sha':oid,'path':path.decode('utf-8')})
 return rows
def put_commit(root,body):
 def identity(value):return value['name']+' <'+value['email']+'> '+str(int(datetime.datetime.fromisoformat(value['date'].replace('Z','+00:00')).timestamp()))+' +0000'
 raw=('tree '+body['tree']+'\n'+''.join('parent '+p+'\n' for p in body['parents'])+'author '+identity(body['author'])+'\ncommitter '+identity(body['committer'])+'\n\n'+body['message']).encode()
 return git(root,'hash-object','-w','-t','commit','--stdin',data=raw).decode().strip()
def commit(root,sha):
 raw=git(root,'cat-file','-p',sha).decode('utf-8');head,message=raw.split('\n\n',1);fields={}
 for line in head.splitlines():
  key,value=line.split(' ',1);fields.setdefault(key,[]).append(value)
 def actor(text):
  m=re.fullmatch(r'(.*) <([^<>]*)> (-?\d+) ([+-]\d{4})',text)
  return {'name':m[1],'email':m[2],'date':datetime.datetime.fromtimestamp(int(m[3]),datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')}
 return {'sha':sha,'tree':{'sha':fields['tree'][0]},'parents':[{'sha':p} for p in fields.get('parent',[])],'message':message,'author':actor(fields['author'][0]),'committer':actor(fields['committer'][0])}
def head(root):return git(root,'rev-parse','refs/heads/main').decode().strip()
def ancestor(root,base,tip):return git(root,'merge-base','--is-ancestor',base,tip,check=False).returncode==0
def update_controls(root,patch):
 path=pathlib.Path(root)/'git-write-controls.json';value=json.loads(path.read_text());value.update(patch);temp=path.with_name('controls-'+uuid.uuid4().hex);temp.write_text(json.dumps(value));temp.replace(path);return value
class GitWriteFixture(GitFixture):
 def __init__(self,root):
  super().__init__(root,folders={'existing-sentinel':declaration()});self.server_script=pathlib.Path(__file__).resolve();self.repo=root/'remote.git';subprocess.run(['git','init','--bare',str(self.repo)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  marker=put_blob(root,declaration().encode());source=put_blob(root,b'protected existing source\n');folder=put_tree(root,[{'path':'DEPLOYMENT.md','mode':'100644','type':'blob','sha':marker},{'path':'main.pjs','mode':'100644','type':'blob','sha':source}]);gens=put_tree(root,[{'path':'existing-sentinel','mode':'040000','type':'tree','sha':folder}]);root_tree=put_tree(root,[{'path':'generators','mode':'040000','type':'tree','sha':gens},{'path':'README.md','mode':'100755','type':'blob','sha':put_blob(root,b'protected root README\n')},{'path':'agents.md','mode':'100644','type':'blob','sha':put_blob(root,b'protected root instructions\n')},{'path':'unrelated.bin','mode':'100644','type':'blob','sha':put_blob(root,bytes([0,255,17,42]))}]);actor={'name':'Independent fixture','email':'fixture@example.test','date':'2023-11-14T22:13:20.000Z'};tip=put_commit(root,{'tree':root_tree,'parents':[],'author':actor,'committer':actor,'message':'Independent fixture root\n'});git(root,'update-ref','refs/heads/main',tip)
  (root/'git-write-controls.json').write_text(json.dumps({'race':'unrelated','lose_applied_ref':True,'hide_applied_commits':True,'raceHead':None}))
 def controls(self,**patch):return update_controls(self.root,patch)
 def snapshot(self):
  tip=head(self.root);files={}
  for row in git(self.root,'ls-tree','-r','-z',tip).split(b'\0'):
   if row:
    meta,path=row.split(b'\t',1);mode,kind,sha=meta.decode().split(' ');data=git(self.root,'cat-file','blob',sha);files[path.decode()]={'mode':mode,'sha':sha,'bytes':base64.b64encode(data).decode()}
  history=[commit(self.root,sha) for sha in git(self.root,'rev-list','refs/heads/main').decode().splitlines()]
  return {'head':tip,'files':files,'operations':[{'sha':c['sha'],'parents':c['parents'],'message':c['message']} for c in history if 'PCMS-Operation:' in c['message']],'controls':json.loads((self.root/'git-write-controls.json').read_text())}
def serve(root,nonce,port):
 root=pathlib.Path(root);lock=threading.RLock()
 class Handler(http.server.BaseHTTPRequestHandler):
  protocol_version='HTTP/1.1'
  def log_message(self,*args):pass
  def send(self,body,status=200,headers={}):
   data=json.dumps(body).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.send_header('Connection','close')
   for k,v in headers.items():self.send_header(k,v)
   self.end_headers();self.wfile.write(data);self.close_connection=True
  def record(self,path,status,extra={}):
   with open(root/'git-requests.jsonl','a') as log:log.write(json.dumps({'method':self.command,'path':path,'status':status,'authorized':self.headers.get('Authorization')=='Bearer '+TOKEN,**extra})+'\n')
  def request_scope(self):
   url=urlsplit(self.path);prefix='/repos/fixture/catalog'
   if self.headers.get('Host')!='api.github.com' or not url.path.startswith(prefix):return None
   return url.path.removeprefix(prefix),url.query
  def do_GET(self):
   if self.path=='/__pcms_shutdown/'+nonce:threading.Thread(target=self.server.shutdown,daemon=True).start();return self.send({'stopped':True})
   scope=self.request_scope()
   if scope is None:return self.send({},404)
   path,query=scope
   with lock:
    if self.headers.get('Authorization')!='Bearer '+TOKEN:self.record(path,401);return self.send({},401)
    if path=='':self.record(path,200);return self.send({'id':314159,'full_name':'fixture/catalog','private':True})
    if path=='/git/ref/heads/main':
     tip=head(root);etag='"'+tip+'"';status=304 if self.headers.get('If-None-Match')==etag else 200;self.record(path,status);return self.send({'ref':'refs/heads/main','object':{'type':'commit','sha':tip}},status,{'ETag':etag})
    if path.startswith('/compare/'):
     parts=path.removeprefix('/compare/').split('...')
     if len(parts)!=2 or not all(SHA.fullmatch(p) for p in parts):return self.send({},404)
     base,tip=parts;common=git(root,'merge-base',base,tip,check=False)
     if common.returncode:self.record(path,409);return self.send({},409)
     status='identical' if base==tip else 'ahead' if ancestor(root,base,tip) else 'behind' if ancestor(root,tip,base) else 'diverged';self.record(path,200);return self.send({'status':status,'base_commit':{'sha':base},'merge_base_commit':{'sha':common.stdout.decode().strip()}})
    parts=path.removeprefix('/git/').split('/')
    if len(parts)!=2 or parts[0] not in ['blobs','trees','commits'] or not SHA.fullmatch(parts[1]):return self.send({},404)
    kind,sha=parts;exists=git(root,'cat-file','-t',sha,check=False)
    if exists.returncode:self.record(path,404);return self.send({},404)
    if kind=='blobs':
     data=git(root,'cat-file','blob',sha);body={'sha':sha,'size':len(data),'encoding':'base64','content':base64.b64encode(data).decode()}
    elif kind=='trees':
     def walk(oid,prefix=''):
      rows=[]
      for e in tree(root,oid):
       rows.append({**e,'path':prefix+e['path']})
       if e['type']=='tree':rows.extend(walk(e['sha'],prefix+e['path']+'/'))
      return rows
     body={'sha':sha,'truncated':False,'tree':walk(sha) if query=='recursive=1' else tree(root,sha)}
    else:
     body=commit(root,sha);controls=json.loads((root/'git-write-controls.json').read_text())
     if controls['hide_applied_commits'] and 'PCMS-Operation:' in body['message'] and ancestor(root,sha,head(root)):self.record(path,404);return self.send({},404)
    self.record(path,200);return self.send(body)
  def do_POST(self):self.write_effect()
  def do_PATCH(self):self.write_effect()
  def write_effect(self):
   scope=self.request_scope()
   if scope is None:return self.send({},404)
   path,query=scope
   with lock:
    if self.headers.get('Authorization')!='Bearer '+TOKEN:self.record(path,401);return self.send({},401)
    body=json.loads(self.rfile.read(int(self.headers.get('Content-Length',0))));kind=path.removeprefix('/git/');status=201
    if self.command=='POST' and kind=='blobs':sha=put_blob(root,base64.b64decode(body['content'],validate=True))
    elif self.command=='POST' and kind=='trees':
     entries={e['path']:e for e in tree(root,body['base_tree'])} if body.get('base_tree') else {}
     for e in body['tree']:
      if e['path'] in ['.','..'] or '/' in e['path'] or '\0' in e['path']:raise ValueError('UNSCOPED_FIXTURE_TREE')
      if e['sha'] is None:entries.pop(e['path'],None)
      else:entries[e['path']]=e
     sha=put_tree(root,list(entries.values()))
    elif self.command=='POST' and kind=='commits':sha=put_commit(root,body)
    elif self.command=='PATCH' and kind=='refs/heads/main':
     if sorted(body)!=['force','sha'] or body['force'] is not False or not SHA.fullmatch(body['sha']):self.record(path,422);return self.send({},422)
     controls=json.loads((root/'git-write-controls.json').read_text())
     if controls['race']=='unrelated':
      old=head(root);old_commit=commit(root,old);entries=tree(root,old_commit['tree']['sha'])
      for e in entries:
       if e['path']=='README.md':e['sha']=put_blob(root,b'independent concurrent README edit\n')
      actor={'name':'Independent external writer','email':'fixture@example.test','date':'2023-11-14T22:13:21.000Z'};race=put_commit(root,{'tree':put_tree(root,entries),'parents':[old],'author':actor,'committer':actor,'message':'Independent concurrent edit\n'});git(root,'update-ref','refs/heads/main',race,old);controls=update_controls(root,{'race':None,'raceHead':race})
     old=head(root);sha=body['sha']
     if not ancestor(root,old,sha):self.record(path,422,{'force':False,'sha':sha});return self.send({},422)
     moved=git(root,'update-ref','refs/heads/main',sha,old,check=False)
     if moved.returncode:self.record(path,422,{'force':False,'sha':sha});return self.send({},422)
     status=200
     if controls['lose_applied_ref']:
      update_controls(root,{'lose_applied_ref':False});self.record(path,status,{'lost':True,'force':False,'sha':sha});self.close_connection=True
      try:self.connection.shutdown(socket.SHUT_RDWR)
      except OSError:pass
      self.connection.close();return
    else:self.record(path,403);return self.send({},403)
    self.record(path,status,{'sha':sha,**({'force':False} if kind=='refs/heads/main' else {})});return self.send({'ref':'refs/heads/main','object':{'type':'commit','sha':sha}} if kind=='refs/heads/main' else {'sha':sha},status)
 context=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);context.load_cert_chain(str(root/'git-server.pem'),str(root/'git-server.key'));context.set_alpn_protocols(['http/1.1'])
 with http.server.ThreadingHTTPServer(('127.0.0.1',int(port)),Handler) as server:server.socket=context.wrap_socket(server.socket,server_side=True);print('GIT_READY',flush=True);server.serve_forever()
if __name__=='__main__' and sys.argv[1]=='server':serve(*sys.argv[2:])
