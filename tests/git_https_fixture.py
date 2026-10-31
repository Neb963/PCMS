"""Independent Git HTTPS fixture. Only loopback; no external HTTP forwarding.
The real api.github.com hostname is mapped solely in the disposable profile.
"""
import base64,hashlib,http.server,json,pathlib,socket,ssl,subprocess,sys,threading,uuid,select
from urllib.parse import urlsplit
TOKEN='disposable-fixture-github-token'
def oid(kind,data):return hashlib.sha1((kind+' '+str(len(data))+'\0').encode()+data).hexdigest()
def declaration(version='v1',status='NOT_READY'):return f'Format: PCMS-1\nVersion: {version}\nAction: DEVELOP\nStatus: {status}\n'
class GitFixture:
 def __init__(self,root,folders=None):
  self.root=root;self.objects={};self.head=None;self.log=root/'git-requests.jsonl';self.state=root/'git-model.json';self.nonce=uuid.uuid4().hex;self.proc=None
  self.folders=folders if folders is not None else {f'folder-{i:04d}':declaration() for i in range(61)}
  if folders is None:self.folders.update({'done-one':declaration('done-version','DONE'),'invalid-one':declaration().replace('Version: v1','Version: v1 ')})
  def blob(text):
   data=text.encode();sha=oid('blob',data);self.objects['blobs/'+sha]={'sha':sha,'size':len(data),'encoding':'base64','content':base64.b64encode(data).decode()};return {'mode':'100644','type':'blob','sha':sha,'size':len(data)}
  def tree(entries):
   entries=sorted(entries,key=lambda e:(e['path']+('/' if e['type']=='tree' else '')).encode());data=b''.join((('40000' if e['mode']=='040000' else e['mode'])+' '+e['path']+'\0').encode()+bytes.fromhex(e['sha']) for e in entries);sha=oid('tree',data);self.objects['trees/'+sha]={'sha':sha,'truncated':False,'tree':entries};return {'mode':'040000','type':'tree','sha':sha}
  entries=[]
  for slug,text in self.folders.items():
   marker=blob(text);entries.append({**tree([{**marker,'path':'DEPLOYMENT.md'},{**blob('source sentinel '+slug),'path':'main.pjs'}]),'path':slug})
   if slug=='invalid-one':self.last_marker=marker['sha']
  root_tree=tree([{**tree(entries),'path':'generators'},{**blob('unrelated root sentinel'),'path':'README.md'}]);raw=('tree '+root_tree['sha']+'\nauthor Fixture <fixture@example.test> 1700000000 +0000\ncommitter Fixture <fixture@example.test> 1700000000 +0000\n\nFixture\n').encode();self.head=oid('commit',raw);self.objects['commits/'+self.head]={'sha':self.head,'tree':{'sha':root_tree['sha']}};self.failure=None;self.write()
  ext=root/'git-extensions.cnf';ext.write_text('subjectAltName=DNS:api.github.com\nextendedKeyUsage=serverAuth\nbasicConstraints=critical,CA:FALSE\n')
  for args in [['req','-x509','-newkey','rsa:2048','-nodes','-days','2','-subj','/CN=PCMS Git fixture CA','-keyout',str(root/'git-ca.key'),'-out',str(root/'git-ca.pem')],['req','-newkey','rsa:2048','-nodes','-subj','/CN=api.github.com','-keyout',str(root/'git-server.key'),'-out',str(root/'git-server.csr')],['x509','-req','-days','2','-in',str(root/'git-server.csr'),'-CA',str(root/'git-ca.pem'),'-CAkey',str(root/'git-ca.key'),'-CAcreateserial','-extfile',str(ext),'-out',str(root/'git-server.pem')]]:subprocess.run(['openssl',*args],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  self.ca=ssl.PEM_cert_to_DER_cert((root/'git-ca.pem').read_text())
 def write(self):
  temp=self.root/'git-model.next';temp.write_text(json.dumps({'head':self.head,'objects':self.objects,'failure':self.failure}));temp.replace(self.state)
 def fail(self,status):self.failure=None if status is None else {'path':'/git/ref/heads/main','status':status};self.write()
 def requests(self):return [json.loads(line) for line in self.log.read_text().splitlines()] if self.log.exists() else []
 def start(self,port=443):
  self.port=port;probe=socket.socket();prefix=[]
  try:probe.bind(('127.0.0.1',port))
  except PermissionError:prefix=['sudo','-n']
  finally:probe.close()
  self.proc=subprocess.Popen([*prefix,sys.executable,str(getattr(self,'server_script',pathlib.Path(__file__).resolve())),'server',str(self.root),self.nonce,str(port)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);ready=select.select([self.proc.stdout],[],[],10)[0]
  if not ready or self.proc.stdout.readline().strip()!='GIT_READY':raise RuntimeError('GIT_FIXTURE_START_FAILED')
 def close(self):
  if self.proc and self.proc.poll() is None:
   context=ssl.create_default_context(cadata=ssl.DER_cert_to_PEM_cert(self.ca))
   with context.wrap_socket(socket.create_connection(('127.0.0.1',self.port),timeout=10),server_hostname='api.github.com') as s:s.sendall(('GET /__pcms_shutdown/'+self.nonce+' HTTP/1.1\r\nHost: api.github.com\r\nConnection: close\r\n\r\n').encode());s.recv(4096)
   self.proc.wait(timeout=10)
def serve(root,nonce,port):
 root=pathlib.Path(root)
 class Handler(http.server.BaseHTTPRequestHandler):
  protocol_version='HTTP/1.1'
  def log_message(self,*args):pass
  def send(self,body,status=200,headers={}):
   data=json.dumps(body).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.send_header('Connection','close')
   for key,value in headers.items():self.send_header(key,value)
   self.end_headers();self.wfile.write(data);self.close_connection=True
  def do_GET(self):
   if self.path=='/__pcms_shutdown/'+nonce:threading.Thread(target=self.server.shutdown,daemon=True).start();return self.send({'stopped':True})
   model=json.loads((root/'git-model.json').read_text());url=urlsplit(self.path);path=url.path.removeprefix('/repos/fixture/catalog');authorized=self.headers.get('Authorization')=='Bearer '+TOKEN
   status=200;body={};headers={}
   if self.headers.get('Host')!='api.github.com' or not url.path.startswith('/repos/fixture/catalog'):status=404
   elif not authorized:status=401
   elif model['failure'] and model['failure']['path']==path:status=model['failure']['status']
   elif path=='':body={'id':314159,'full_name':'fixture/catalog','private':True}
   elif path=='/git/ref/heads/main':
    etag='"'+model['head']+'"';headers['ETag']=etag;status=304 if self.headers.get('If-None-Match')==etag else 200;body={'ref':'refs/heads/main','object':{'type':'commit','sha':model['head']}}
   else:
    body=model['objects'].get(path.removeprefix('/git/'));status=200 if body else 404
    if url.query=='recursive=1' and body:
     def walk(sha,prefix=''):
      result=[]
      for e in model['objects']['trees/'+sha]['tree']:
       item={**e,'path':prefix+e['path']};result.append(item)
       if e['type']=='tree':result.extend(walk(e['sha'],item['path']+'/'))
      return result
     body={**body,'truncated':True,'tree':walk(body['sha'])[:2]}
   with open(root/'git-requests.jsonl','a') as log:log.write(json.dumps({'method':'GET','path':path+('?' +url.query if url.query else ''),'status':status,'authorized':authorized})+'\n')
   self.send(body,status,headers)
  def do_POST(self):
   with open(root/'git-requests.jsonl','a') as log:log.write(json.dumps({'method':'POST','path':'REFUSED','status':403,'authorized':False})+'\n')
   self.send({},403)
 context=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);context.load_cert_chain(str(root/'git-server.pem'),str(root/'git-server.key'));context.set_alpn_protocols(['http/1.1'])
 with http.server.ThreadingHTTPServer(('127.0.0.1',int(port)),Handler) as server:server.socket=context.wrap_socket(server.socket,server_side=True);print('GIT_READY',flush=True);server.serve_forever()
if __name__=='__main__' and sys.argv[1]=='server':serve(*sys.argv[2:])
