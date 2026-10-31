"""Disposable native-protocol/SOCKS/HTTPS fixture. Never forwards a socket to
an external host and never invokes an installed native service. Not packaged.
"""
import base64,http.server,json,pathlib,socket,socketserver,ssl,struct,subprocess,sys,threading,time,types,zipfile
from urllib.request import Request,urlopen
HOST='com.persona.mullvad_router'
ID='persona-route-manager@local'

def exact(sock,n):
 data=b''
 while len(data)<n:
  block=sock.recv(n-len(data))
  if not block:raise EOFError()
  data+=block
 return data

class Fixture:
 def __init__(self,root):
  self.lock=threading.RLock();self.tokens={};self.exits={};self.calls=[];self.logins={};self.reads=[];self.probes=[];self.unexpected=[];self.delay_next=False;self.duplicate_exit=False
  ca=root/'ca.pem';key=root/'server.key';csr=root/'server.csr';cert=root/'server.pem';ext=root/'extensions.cnf'
  ext.write_text('subjectAltName=DNS:perchance.org,DNS:am.i.mullvad.net,DNS:*.am.i.mullvad.net,DNS:*.dnsleak.am.i.mullvad.net\nextendedKeyUsage=serverAuth\nbasicConstraints=critical,CA:FALSE\n')
  for args in [['req','-x509','-newkey','rsa:2048','-nodes','-days','2','-subj','/CN=PCMS disposable fixture CA','-keyout',str(root/'ca.key'),'-out',str(ca)],['req','-newkey','rsa:2048','-nodes','-subj','/CN=perchance.org','-keyout',str(key),'-out',str(csr)],['x509','-req','-days','2','-in',str(csr),'-CA',str(ca),'-CAkey',str(root/'ca.key'),'-CAcreateserial','-extfile',str(ext),'-out',str(cert)]]:subprocess.run(['openssl',*args],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  self.ca=ssl.PEM_cert_to_DER_cert(ca.read_text());self.tls=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);self.tls.load_cert_chain(str(cert),str(key));self.tls.set_alpn_protocols(['http/1.1'])
  class Socks(socketserver.BaseRequestHandler):
   def handle(inner):
    sock=inner.request;sock.settimeout(20)
    try:
     version,n=exact(sock,2);methods=exact(sock,n)
     if version!=5 or 2 not in methods:sock.sendall(b'\x05\xff');return
     sock.sendall(b'\x05\x02');v,n=exact(sock,2);user=exact(sock,n);password=exact(sock,exact(sock,1)[0]).decode()
     with self.lock:route=self.tokens.get(password)
     if v!=1 or user!=b'persona' or not route:sock.sendall(b'\x01\x01');return
     sock.sendall(b'\x01\x00');v,command,_,kind=exact(sock,4)
     host=exact(sock,exact(sock,1)[0]).decode() if kind==3 else socket.inet_ntop(socket.AF_INET if kind==1 else socket.AF_INET6,exact(sock,4 if kind==1 else 16));port=struct.unpack('!H',exact(sock,2))[0]
     allowed=host in ['perchance.org','ipv4.am.i.mullvad.net','ipv6.am.i.mullvad.net','am.i.mullvad.net'] or host.endswith('.dnsleak.am.i.mullvad.net')
     if v!=5 or command!=1 or port!=443 or not allowed:
      with self.lock:self.unexpected.append('SOCKS_TARGET_REFUSED')
      sock.sendall(b'\x05\x02\x00\x01'+b'\x00'*6);return
     sock.sendall(b'\x05\x00\x00\x01\x7f\x00\x00\x01\x01\xbb')
     tls=self.tls.wrap_socket(sock,server_side=True);handler=type('ProtectedFixture',(Provider,),{'route':route});handler(tls,inner.client_address,types.SimpleNamespace(fixture=self,server_name='fixture',server_port=443))
    except (OSError,EOFError,ssl.SSLError):pass
  class Server(socketserver.ThreadingTCPServer):allow_reuse_address=True;daemon_threads=True
  self.proxy=Server(('127.0.0.1',0),Socks);self.port=self.proxy.server_address[1];self.control=http.server.ThreadingHTTPServer(('127.0.0.1',0),Control);self.control.fixture=self
  for server in [self.proxy,self.control]:threading.Thread(target=server.serve_forever,daemon=True).start()
 def close(self):
  for server in [self.proxy,self.control]:server.shutdown();server.server_close()
 def native(self,message):
  command=message.get('command');delay=False
  with self.lock:
   self.calls.append({'command':command,'routeId':message.get('route_id')})
   if command=='status':return {'ok':True,'version':'0.3.0','ready':True,'interface_up':True,'base_route_bound':True,'base_proxy_reachable':True,'active_exits':list(self.exits.values()),'pending_prepare_routes':[]}
   if command=='prepare_exit':
    relay=message.get('relay_ip');slot=int(relay.split('.')[-1]);route=message['route_id'];token=message['forwarder_token'];self.tokens[token]=route;self.exits[route]={'route_id':route,'relay_ip':relay,'relay_port':message['relay_port'],'local_host':'127.0.0.1','local_port':self.port,'slot':slot};delay=self.delay_next;self.delay_next=False;value={'ok':True,'ready':True,**self.exits[route]}
   elif command=='release_exit':value={'ok':True,'released':self.exits.pop(message['route_id'],None) is not None}
   elif command=='list_entries':value={'ok':True,'entries':[]}
   else:self.unexpected.append('NATIVE_COMMAND_REFUSED');value={'ok':False,'error':'FIXTURE_COMMAND_REFUSED'}
  if delay:time.sleep(70)
  return value
 def receipt(self):
  with self.lock:return {'nativeCalls':list(self.calls),'reads':list(self.reads),'probes':list(self.probes),'sessions':{k:v['email'] for k,v in self.logins.items()},'unexpected':list(self.unexpected)}
 def install_bridge(self,home,root):
  wrapper=root/'native-host.py';wrapper.write_text('#!/usr/bin/env python3\nimport sys\nsys.path.insert(0,'+repr(str(pathlib.Path(__file__).parent))+')\nfrom account_fixture import native_main\nnative_main('+str(self.control.server_port)+')\n');wrapper.chmod(0o755)
  folder=home/'.mozilla/native-messaging-hosts';folder.mkdir(parents=True,exist_ok=True);(folder/(HOST+'.json')).write_text(json.dumps({'name':HOST,'description':'Disposable PCMS protocol fixture','path':str(wrapper),'type':'stdio','allowed_extensions':[ID]}))
 def catalog_addon(self,root):
  target='http://127.0.0.1:'+str(self.control.server_port)+'/catalog';p=root/'network-fixture.xpi';manifest={'manifest_version':2,'name':'PCMS disposable catalog fixture','version':'1.0','browser_specific_settings':{'gecko':{'id':'pcms-catalog-fixture@local'}},'permissions':['webRequest','webRequestBlocking','https://api.mullvad.net/*','http://127.0.0.1/*'],'background':{'scripts':['redirect.js']}}
  with zipfile.ZipFile(p,'w') as z:z.writestr('manifest.json',json.dumps(manifest));z.writestr('redirect.js','browser.webRequest.onBeforeRequest.addListener(()=>({redirectUrl:'+json.dumps(target)+'}),{urls:["https://api.mullvad.net/network/v1-beta1/socks-proxies"]},["blocking"]);')
  return p

class Base(http.server.BaseHTTPRequestHandler):
 protocol_version='HTTP/1.1'
 def log_message(self,*args):pass
 def send(self,value,kind='application/json',status=200):
  body=value if isinstance(value,bytes) else json.dumps(value).encode();self.send_response(status);self.send_header('Content-Type',kind);self.send_header('Content-Length',str(len(body)));self.send_header('Connection','close');self.end_headers();self.wfile.write(body);self.close_connection=True
 def body(self):return json.loads(self.rfile.read(int(self.headers.get('Content-Length',0))) or b'{}')
class Control(Base):
 def do_GET(self):
  if self.path=='/catalog':return self.send([{'online':True,'hostname':'fixture-'+str(i),'ipv4_address':'10.124.0.'+str(i),'port':1080,'location':{'country':'Fixture','city':'Local'}} for i in range(1,9)])
  if self.path=='/state':return self.send(self.server.fixture.receipt())
  self.send({},status=404)
 def do_POST(self):
  if self.path=='/native':return self.send(self.server.fixture.native(self.body()))
  self.send({},status=404)
class Provider(Base):
 def do_GET(self):
  f=self.server.fixture;host=self.headers.get('Host','').split(':')[0]
  with f.lock:slot=f.exits[self.route]['slot']
  if host!='perchance.org':
   with f.lock:f.probes.append({'routeId':self.route,'host':host})
   if host.endswith('.dnsleak.am.i.mullvad.net'):return self.send([{'ip':'1.1.1.1','mullvad_dns':True}])
   return self.send({'mullvad_exit_ip':True,'ip':('2001:4860::'+str(slot)) if host.startswith('ipv6.') else '8.8.8.'+str(1 if f.duplicate_exit else slot)})
  return self.send(b'''<!doctype html><title>Disposable Perchance fixture</title><h1>Perchance identity fixture</h1><label>Email <input id="fixture-email"></label><button id="fixture-signin">Sign in fixture</button><p id="fixture-result"></p><script>document.getElementById('fixture-signin').onclick=async()=>{const email=document.getElementById('fixture-email').value;const r=await fetch('/fixture/signin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});const user=await r.json();localStorage.setItem('app-storage',JSON.stringify({user}));localStorage.setItem('sessionTokenLastChangeTime',String(Date.now()));document.getElementById('fixture-result').textContent='Signed in: '+user.email;};</script>''','text/html')
 def do_POST(self):
  f=self.server.fixture;body=self.body()
  if self.path=='/fixture/signin':
   if not body.get('email','').endswith('@fixture.test'):return self.send({},status=400)
   with f.lock:
    value={'loggedIn':True,'email':body['email'],'sessionToken':'disposable-session-'+self.route};f.logins[self.route]=value
   return self.send(value)
  if self.path=='/api/getGeneratorsByUser':
   with f.lock:
    expected=f.logins.get(self.route);valid=expected and body.get('email')==expected['email'] and body.get('sessionToken')==expected['sessionToken'];f.reads.append({'routeId':self.route,'valid':bool(valid)})
   return self.send({'status':'success','generators':[{'name':'remote-sentinel','isPrivate':True}],'generatorFolderMap':{}} if valid else {'status':'session-token-error'})
  with f.lock:f.unexpected.append('PROVIDER_OPERATION_REFUSED')
  self.send({},status=404)

def native_main(port):
 while True:
  raw=sys.stdin.buffer.read(4)
  if not raw:return
  try:
   length=struct.unpack('<I',raw)[0];message=json.loads(sys.stdin.buffer.read(length));response=json.load(urlopen(Request('http://127.0.0.1:'+str(port)+'/native',data=json.dumps(message).encode(),headers={'Content-Type':'application/json'}),timeout=90));response['id']=message['id'];body=json.dumps(response).encode();sys.stdout.buffer.write(struct.pack('<I',len(body))+body);sys.stdout.buffer.flush()
  except (BrokenPipeError,EOFError):return
  except Exception:
   body=json.dumps({'id':message.get('id'),'ok':False,'error':'FIXTURE_NATIVE_FAILURE'}).encode()
   try:sys.stdout.buffer.write(struct.pack('<I',len(body))+body);sys.stdout.buffer.flush()
   except BrokenPipeError:return
