"""Compare the two original XPIs on one controlled Core reply loss.

Run the production query and discard just its first valid result at the RPC
delivery boundary. No query, browser clock, view, or IndexedDB result is faked.
"""
from installed_packages import *
from installed_journal import set_input

QUERY = 'synthetic-reply-loss-needle'
TARGET = '#generators/reply-loss-target'


def run(binary, driver, xpi, baseline):
    label = 'p41' if baseline else 'candidate'
    identity = json.loads((xpi.parent / 'identity.json').read_text())
    digest = hashlib.sha256(xpi.read_bytes()).hexdigest()
    assert digest == identity['xpiSha256'] and not identity['dirty']
    receipt = {'tier': 'B/installed-Core-reply-loss', 'source': identity['source'],
               'xpiSha256': digest, 'label': label}
    with tempfile.TemporaryDirectory(prefix='pcms-search-reply-') as temporary:
        root = pathlib.Path(temporary)
        profile, home = root / 'profile', root / 'home'
        profile.mkdir()
        home.mkdir()
        env = {**os.environ, 'HOME': str(home), 'XDG_CONFIG_HOME': str(home / '.config'),
               'XDG_DATA_HOME': str(home / '.local/share'), 'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS': '1'}
        with (OUT / ('search-reply-loss-' + label + '.log')).open('w') as log:
            proc = subprocess.Popen([str(driver), '--port', '44448', '--allow-system-access'],
                                    env=env, stdout=log, stderr=subprocess.STDOUT)
            sid = None
            try:
                wait(driver_ready, 15)
                sid, caps = session(binary, profile)
                assert int(caps['browserVersion'].split('.')[0]) >= 155
                receipt.update(browserVersion=caps['browserVersion'], buildId=caps['moz:buildID'])
                context(sid, 'chrome')
                sandbox = script(sid, """return {remote:Services.appinfo.browserTabsRemoteAutostart,
                  level:Services.prefs.getIntPref('security.sandbox.content.level')};""")
                assert sandbox['remote'] and sandbox['level'] >= 4
                receipt['sandbox'] = sandbox
                context(sid, 'content')
                assert call('POST', f'/session/{sid}/moz/addon/install',
                            {'path': str(xpi), 'temporary': False}) == ID
                toolbar(sid)
                dashboard(sid)
                status(sid, 'BRIDGE_MISSING')
                sequence = asyncjs(sid, """const {openCore}=await import(browser.runtime.getURL('core/records.mjs'));
                  const c=await openCore();await c.mutate([{table:'generators',id:'reply-loss-target',
                    value:{slug:arguments[0],folder:'generators/'+arguments[0],folderPresent:'YES'}}],
                    {step:'REPLY_LOSS_FIXTURE',result:'COMPLETE'});
                  const {sequence}=await c.status();c.close();return sequence;""", [QUERY])
                assert sequence > 0
                receipt['fixtureSequence'] = sequence
                assert asyncjs(sid, """const bg=await browser.runtime.getBackgroundPage(),query=arguments[0];
                  const p=bg.__replyLoss={requests:[],responses:[],dropped:0};
                  bg.browser.runtime.onConnect.addListener(port=>{
                    if(port.name!=='pcms-core-rpc')return;
                    const requests=new Map(),send=port.postMessage.bind(port);
                    port.onMessage.addListener(m=>{
                      if(m.operation==='ui.search'&&m.query===query){
                        requests.set(m.rpcId,m.query);p.requests.push({id:m.rpcId,at:Date.now()});
                      }
                    });
                    port.postMessage=packet=>{
                      if(!requests.has(packet.rpcId))return send(packet);
                      const r=packet.response;
                      const drop=r.ok&&!p.dropped;
                      p.responses.push({id:packet.rpcId,ok:r.ok,at:Date.now(),drop,
                        hrefs:r.ok?r.result.rows.map(row=>row.href):[],code:r.code??null});
                      if(drop){p.dropped++;return;}
                      return send(packet);
                    };
                  });return true;""", [QUERY])
                call('POST', f'/session/{sid}/refresh', {})
                wait(lambda: script(sid, "return document.querySelector('[data-count=generators]')?.textContent==='1 Generators';"))
                set_input(sid, '#global-search', '')
                start = time.monotonic()
                type_text(sid, '#global-search', QUERY+'\ue007')

                def observed():
                    return script(sid, """const status=document.getElementById('global-search-status');
                      return {input:document.getElementById('global-search').value,
                        text:status.textContent,code:status.dataset.code??null,
                        hrefs:[...document.querySelectorAll('#global-results a')].map(a=>a.getAttribute('href'))};""")

                wait(lambda: asyncjs(sid, "return (await browser.runtime.getBackgroundPage()).__replyLoss.dropped===1;"))
                if baseline:
                    time.sleep(max(0, 64 - (time.monotonic() - start)))
                    assert observed() == {'input': QUERY, 'text': 'Searching…', 'code': None, 'hrefs': []}
                else:
                    wait(lambda: observed()['code'] == 'CORE_REQUEST_TIMEOUT', 70)
                    assert observed() == {'input': QUERY, 'text': 'Search timed out. Try Search again.',
                                          'code': 'CORE_REQUEST_TIMEOUT', 'hrefs': []}
                receipt['afterLoss'] = {**observed(), 'elapsedSeconds': time.monotonic() - start}
                click(sid, '#global-search-form button[type="submit"]')
                wait(lambda: observed()['hrefs'] == [TARGET])
                trace = asyncjs(sid, "return (await browser.runtime.getBackgroundPage()).__replyLoss;")
                assert trace['dropped'] == 1 and [r['drop'] for r in trace['responses']] == [True, False], trace
                assert all(r['ok'] and r['hrefs'] == [TARGET] for r in trace['responses']), trace
                assert [r['id'] for r in trace['responses']] == [r['id'] for r in trace['requests']], trace
                receipt['trace'] = trace
                click(sid, '#global-results a')
                wait(lambda: script(sid, "return location.hash===arguments[0]&&!!document.getElementById('generator-detail');",
                                    [TARGET]))
                receipt['navigation'] = TARGET
                receipt['result'] = 'REPRODUCED' if baseline else 'PASS'
            except Exception as error:
                receipt['error'] = str(error)
                if sid:
                    try:
                        receipt['trace'] = asyncjs(sid, "return (await browser.runtime.getBackgroundPage()).__replyLoss??null;")
                        receipt['page'] = script(sid, "return {route:location.hash,input:document.getElementById('global-search')?.value,text:document.getElementById('global-search-status')?.textContent};")
                    except Exception as diagnostic:
                        receipt['diagnosticError'] = str(diagnostic)
                raise
            finally:
                (OUT / ('search-reply-loss-' + label + '.json')).write_text(json.dumps(receipt, indent=2) + '\n')
                if sid:
                    try:
                        stop(sid, profile)
                    except Exception:
                        pass
                proc.terminate()
                proc.wait(timeout=10)


if __name__ == '__main__':
    assert not any(v for k, v in os.environ.items() if k.startswith('MOZ_DISABLE_') and 'SANDBOX' in k)
    binary, driver = (pathlib.Path(os.environ[key]) for key in ['FIREFOX_BINARY', 'GECKODRIVER_BINARY'])
    for i, path in enumerate(sys.argv[1:]):
        run(binary, driver, pathlib.Path(path).resolve(), baseline=i == 0)
