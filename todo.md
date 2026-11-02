# Current implementation checkpoint

## P38 — adaptive three-band control

P01–P37 are merged. Actual main is `5046044982b1b3e23bd3edd56c658a9fd54b30f5`. P37 required 102 T/build + installed B passed at `92f7ea4980885a8579556fec976b8ecb08257cf0` in run [41422848872](https://github.com/Neb963/PCMS/actions/runs/41422848872); postmerge main [41423498829](https://github.com/Neb963/PCMS/actions/runs/41423498829) also passed. Earlier unchanged evidence remains in PRs/history and learned.md. Live G/H/P is NOT TESTED; no named live targets are authorized.

### Plan before implementation

Branch `p38-adaptive-refresher`, based on actual main. Dependencies P35/P36/P37 are implemented and verified. Reuse the existing Core queue/alarm, protected directory observer, cycle accounting and shared guarded source writer.

- Implement a small pure lexicographic controller using complete fresh rendered snapshots. Estimate movement, insertion and propagation from bounded recent observations. Respect pins and count all confirmed owned entries. Compare projected Top 50, Top 100 and full-list gains, then risk, oldest verified save, account rotation and stable ID. Cover 30/60/90+ Active, saturated/filtered/pinned/no-gain cases.
- Persist one pending automatic decision and original Refresh job/operation, measured before/after receipts, rate samples and deadlines. Require a new satisfactory post-save observation before selecting again. Start at 30s spacing; adapt after three useful rounds with measured latency floor, target no-response cooldown, Retry-After and bounded exponential backoff. No timed replay of uncertain effects or missed-save burst.
- Add bounded protected editor preparation through the existing donor and queue. Reuse one automated worker context, preserve user/dirty/AI/review tabs and exact account/source guards. Unknown open/navigation must reconcile the same operation. No editor-per-generator fan-out.
- Wire startup, alarms, Resume and setting/lifecycle changes to automatic finite decisions. Show prediction, verified save and measured outcome separately on the existing Refresher surface. Keep manual inspection/recovery contextual.
- Run focused local T/build. Add a required installed Firefox B journey against independent moving-directory/source fixtures: actual automatic saves, both markers/full bytes, Pause/Resume/settings, unknown recovery, retained cycles and bounded contexts with dashboard closed/restart. Reuse unchanged P37 and P35/P36 receipts. Keep normal sandbox/CSP.
- Push meaningful code plus this checkpoint frequently, verify remote commits/trees, merge only after required T/B passes, and verify postmerge main. Then proceed autonomously through P39, P40 and P41. P42–P49 require named external resources/authorization and remain held; continue any safely independent eligible work.

Checkpoint: pure three-band selection and measured rate/cooldown policy implemented with independent 30/60/90/150-Active, saturation/pins/no-demand, downward movement/visible repeat, stale/pending/fairness, propagation and latency/backoff tests. Initial run5/6 passed; the failing test incorrectly preferred a target with less lexicographic gain. Corrected its independent scenario to equal gains, preserving the endangered-entry tie-break requirement. Also prevent a subsequent backoff from shortening an existing Retry-After. Runtime controller/context/UI and required B remain pending. Local checkout/dependencies are available; Firefox155 downloaded, driver archive extraction needs no-owner handling on this filesystem. No sandbox change.
