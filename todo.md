# Current implementation checkpoint

## P19 — Guarded native source saving

Plan recorded before implementation, from main `dea0f77e6b5a23135c530e1e998c942a812c9321`, tree `40f60368bb1f6909550cf21bbf55d1893d0d5488`. No P19 checkpoint or open PR existed. P30–P33 have since merged; preserve their implementation. Scope is exactly P19, not P20 or Backup work.

### Implementation plan

- Reuse P18 protected metadata/assets and all-document observations. Add distinct native checkpoint time/count observations; content `sourceStamp` is not CAS. Use the observed native save contract, never a guessed automation API or forced stale save.
- Add one Core-owned guarded source service. Module supplies complete pinned candidate; Core retains baseline/candidate/readback blobs, durable writer hold and operation identity. Preflight checks owner, route/container, exact editor document, complete saved base, every editor, pending AI/files/collaboration and current module/account/job gates.
- Add a finite versioned donor handler: exact PJS/HTML/src staging, native `app.saveGenerator()` once, scoped request fence enforcing top-level manifest, exact candidate/preconditions, no force flag/retry, native bookkeeping preserved. Reject unsupported filenames without renaming. Retain staged work on uncertain failure; never reload an editor or clean it artificially.
- Independently capture complete server bytes before and after the effect, with version/identity/listing witnesses. Persist POSSIBLE before dispatch; restart/lost ACK reconciles read-only. An unrelated remote edit, incomplete readback or schema drift retains the hold and snapshots. Previous-good restoration uses the same service and does not relist.
- Connect the packaged Deployer caller and Generators/Work comparison, candidate inspection, reconcile, editor review and previous-good restore actions. No deployment intake/publication workflow in this phase.

### Evidence and verification

Accepted user live v1.4 probe: `62c1c618-f957-4fc8-88ee-22d6fb17c4e2`, 2026-11-01 14:16:59.842–14:17:09.483 UTC, VERIFIED_RESTORED. Native full save (one temporary src file), restoration, deliberately stale request rejected without force. Discovery exact source captures supplement this evidence. Do not repeat the probe or mutate its historical disposable slug.

- T: independent simulated native server/editor, full roots/nested/binary src additions/changes/deletions/empty set; request count and exact bytes; dirty/AI/collab/other editor, stale/races, listing/identity/route/document/generation/Pause, upload/error/schema/lost ACK/readback outage, durable transaction/crash boundaries and same-guard restoration.
- B: actual persistently installed final XPI, Firefox >=154, normal sandbox/CSP, visible packaged caller through module→Core→donor. Independent server hashes/counts; wrong binding, binary save, dirty second editor, stale, forced interruption/restart/dashboard closed, read-only no-replay reconciliation and exact comparison/restore navigation. Reuse unchanged P18 baseline; narrow source/Creator regression only.
- Publish meaningful code/test/todo checkpoints and verify remote commit/tree. Open lightweight PR; merge only after required T/B pass, verify postmerge source/tree/CI and XPI identity.

### Current status and boundaries

Implementation checkpoint: shared writer, finite native adapter, donor final route/document gate, packaged Deployer dispatch, source selection/comparison/reconcile/adopt/restore UI implemented. Native T 16/16 and Core T 15/15 pass locally; unchanged focused source/queue regression 42/42 passed. Expanded preflight initially found two seed-version assertions still expecting Deployer 0.2.0; updated their explicit expected version to the new 0.3.0 package. Focused expanded T now 85/85 PASS. Required installed B harness now covers actual folder input/native requests, dirty second editor, restore, forced process interruption and stale conflict; first CI execution is pending; phase remains incomplete. P19 research blocker is removed by supplied live evidence. Real simultaneous provider race, pre-existing real multi-file tree, full P2 publication/DEPLOY acceptance remain P45 **NOT TESTED**. No live Perchance, Git-provider fixture outside this repository, or route mutations authorized. Next action: add/run the installed Firefox P19 source journey and fault oracles, then fix any failures.

Installed run [41343139936](https://github.com/Neb963/PCMS/actions/runs/41343139936) failed before any P19 save: Marionette uploadFiles rejects a directory. The native source/dirty-editor inspection succeeded; no save was attempted. The B harness now drives the actual folder chooser with a controlled native picker result. This is retained failed evidence, not PASS. Added atomic completion/lost-local-ACK and failed-restore T cases; all 42 changed native/Core/donor tests pass locally.

Installed run [41343480074](https://github.com/Neb963/PCMS/actions/runs/41343480074) reached the real folder picker, then failed on Firefox’s native folder-upload confirmation; cleanup also used the wrong factory-restoration form. The harness now accepts that specific native dialog and restores the original contract registration without replacing its existing factory. Production security preferences and source gates remain unchanged. Expanded native/Core/donor T: 45/45 PASS locally.

Recovery review also found the before-dispatch remote-base hold needed an inspectable server snapshot and explicit read-only adoption. Added that path and a focused test. The installed observer now waits for the submitted command/new job revision and ignores Core’s transient POSSIBLE readback interval; a stable source hold still fails the expected-success oracle.

Installed [41343770675](https://github.com/Neb963/PCMS/actions/runs/41343770675) hung while accepting the native folder dialog. The controlled picker invoked its completion callback synchronously, unlike the native asynchronous contract; corrected it to dispatch completion on the main thread. No P19 save was reached. Current focused plus package/host selection: 108/108 T PASS locally. B remains open.

The async picker change did not fix headless Firefox dialog acceptance: [41344363114](https://github.com/Neb963/PCMS/actions/runs/41344363114) failed at that same pre-save browser boundary. Replaced only the test’s OS picker scaffold with WebDriver’s real FileList plus controlled folder-relative metadata, independently hashing every selected local file. No product code, source guard, native save, request-count/byte oracle, sandbox or CSP is substituted. This does not claim OS folder-dialog automation coverage.

Added post-readback editor/document/AI checks, preserving a late human edit even after the server applied the candidate. Source recovery runs read-only after account recovery and Resume so it does not depend on an open dashboard. Focused/package/host T: 110/110 PASS locally before this wiring-only hook. Final candidate B is pending.

Installed [41344966328](https://github.com/Neb963/PCMS/actions/runs/41344966328) passed the actual packaged full save/dirty-second-editor guards/Work navigation/previous-good restoration and independent hashes/counts, then failed after forced restart with dashboard closed: the old account tab/volatile route proof was unavailable. Added source-scoped recovery through the existing Accounts REPAIR job (no second route manager); the original source operation stays POSSIBLE and read-only. Account readiness now triggers that same source readback automatically. Pause/Disable and account identity still fence admission.

Installed [41345535797](https://github.com/Neb963/PCMS/actions/runs/41345535797) confirmed the remaining restart cause: Accounts REPAIR reverified the route but correctly required its old missing identity tab. Source recovery now requests the existing Accounts OPEN workflow, which verifies the same route, opens or focuses its protected context, and checks the unchanged principal. This reuses the existing closed-tab Accounts path; no source retry or new route selection is introduced. Added the focused Accounts regression selection to CI.
