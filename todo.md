# Current work

**P04 — Sandbox runner and module pages: IN PROGRESS.**

P03 COMPLETE in PR #3, merge `9a4f69fb1d96eda29c20f2c624ca5f94bf779608`, tree `71f2ef1cd4efe0a269e2e1ff1d27079b564c053a`, equal to verified candidate. Postmerge run [41219969827](https://github.com/Neb963/PCMS/actions/runs/41219969827): focused and installed PASS. Final candidate run `41219873098`: 30 focused checks; Firefox 155.0 build 20260817142839, sandbox 6, XPI hash `0bfb6d07dd866f970c01472816117f08c14f228880064596179b943bb6bb3727`. Actual background running→stopped, independent one-effect count, visible Pause/Resume and new-process persistent Unknown/Pause pass.

## Implementation plan (before code)

- [ ] Implement the packaged opaque sandbox runner with defineModule/start/runStep/reconcile/stop and query/action/saveView RPC. Background runs finite steps over durable checkpoints; no keepalive loop or page-owned job.
- [ ] Bind exact frame window/channel to host-held module hash/generation/boot and target scope. Deny forged/stale/disabled/wrong-target/undeclared requests and raw browser/native/authenticated fetch. Add strict website sender/world/container/document binding helpers; no provider authority comes from DOM messages.
- [ ] Host sanitized local markup/styles/media in sandbox CSP; keep all privileged execution packaged. Use fixed host maintenance capability classes, never package-declared Backup authority.
- [ ] Reconstruct enabled runner frames on cold event-page evaluation, schedule finite queue turns and retain Unknown/recheck jobs. Safe stop tears down runners and returns lifecycle receipts; advanced package replacement/website disposal remains P07.
- [ ] Add Other module list, same-page pinning before Settings, module-only secondary menu, namespaced draft persistence and exact Open Modules recovery. ZIP selection/validation is P05; do not ship a fixture package or test bypass as a product feature.
- [ ] T: binding/capability/target denials, finite response validation, stale generation, scope and disabled state. B: persistently installed XPI, real module page action through Core to independently observed fixture job result with dashboard closed; native event-page terminate/wake, page error, keyboard/narrow layout and preserved draft.
- [ ] Publish meaningful checkpoints; verify remote HEAD/tree and focused/installed evidence; merge verified P04, verify postmerge main and automatically plan P05.

## Evidence / holds

P04 T/B: NOT TESTED. P01–P03 accepted non-live evidence is reused where unchanged. No live route/provider operation is authorized here. The XPI is incomplete until the later module/workflow slices.

## Next action

Implement the bound sandbox RPC and finite runner over existing Core records/queue.
