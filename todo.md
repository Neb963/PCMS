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
