"""P41 B: current candidate, seven enabled packages and retained user Disable.
Reuse the actual persistent/cold/blocked/wrong-profile host journey.
"""
import installed_host as host
from installed_seed import inspect,BUILTINS
from installed_backup_sessions import manage
from installed_packages import *

original_status=host.status
receipt={'tier':'B/P41/complete-candidate-startup','checks':[]}
baseline=None
def status(sid,code):
 global baseline
 result=original_status(sid,code)
 if code=='BRIDGE_MISSING':
  state=wait(lambda:next((s for s in [inspect(sid)] if len(s['rows'])==7),None),30)
  assert sorted(state['rows'])==sorted(BUILTINS) and state['seed']=={'initialized':True,'moduleCount':7}
  current={id:{key:state['rows'][id][key] for key in ['hash','manifest','version','enabled']} for id in BUILTINS}
  if baseline is None:
   assert all(r['enabled'] for r in current.values());baseline=current;receipt['packages']=current
   manage(sid,'pcms-journal','DISABLE');assert not inspect(sid)['rows']['pcms-journal']['enabled'];receipt['checks'].append('fresh-persistent-install/seven-enabled-current-ZIPs/real-Journal-Disable')
  else:
   expected={id:{**row,'enabled':False if id=='pcms-journal' else True} for id,row in baseline.items()};assert current==expected,(current,expected);receipt['checks'].append('real-process-restart/exact-package-registry-and-user-Disable-preserved/no-reseed')
 return result
def main():
 identity=json.loads((pathlib.Path(sys.argv[1]).resolve().parent/'identity.json').read_text());receipt.update(source=identity['source'],xpiSha256=identity['xpiSha256']);host.status=status
 try:
  host.main();assert len(receipt['checks'])==2;receipt['checks'].append('same-candidate/actual-toolbar-single-dashboard/normal-sandbox/cold-bridge-block/existing-donor-refused-with-exact-data-preservation');receipt['result']='PASS'
 finally:
  (OUT/'installed-release.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
