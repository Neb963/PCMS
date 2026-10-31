# Current work

**P07 — Safe module update, disable and cold recovery: IN PROGRESS.**

Starting main: `f4175ddca4355de98bd94efe40772a01bf7fcdbb`. P01–P06 are merged; no open PRs or unfinished remote phase branch. P06 postmerge run [41223585280](https://github.com/Neb963/PCMS/actions/runs/41223585280) passed T/B. Reuse that unchanged seed evidence.

## Implementation plan

- Add a durable, single-generation lifecycle to the existing Core/module host: side-effect-free candidate start/schema check, stop admission, fence requests, drain/reconcile effects, collect exact instance stop receipts, switch package atomically, and rebuild or hold safely.
- Keep settings, drafts, job input/checkpoints and previous package references. Enable/Disable and compatible explicit rollback use the same lifecycle. Interrupted transitions resume from persisted state, without a second controller or queue.
- Add website instance registration/disposal and Firefox userscript world/registration reconstruction. Missing permission holds affected registration and exposes the actual browser permission action. Never reload a dirty/AI editor to force teardown.
- Add Settings → Modules Update/Disable/Enable/rollback and contextual held-state recovery. Remove stale visible module pages after fencing; keep other modules operational.
- T: lifecycle interruption, schema mismatch, in-flight/unknown effects, missing/forged stop receipts, stale generation, disabled jobs and maintenance separation. B: one targeted persistently installed fixture journey covering update with unfinished work/dirty editor, draft preservation, old request denial, Disable/Enable, permission denial and real restart.

## Evidence and holds

No P07 tests run yet. Required T and B remain NOT TESTED. Real AI-editor teardown is deferred to authorized P46. No live route, GitHub-provider or Perchance mutation is authorized. Continue sequentially after each completed phase; if a required non-live tier is blocked, preserve it and select safely independent eligible work.

## Next action

Implement lifecycle and focused tests against current production records/queue/host. Push meaningful code plus this file frequently. Keep accepted specification, design and PHASES unchanged.

P07 checkpoint: durable lifecycle, sandbox stop receipts, candidate validation, generation-aware admission and shell page teardown are implemented. Five new focused lifecycle tests pass (update/rollback, stop-receipt denial, Unknown readback, post-switch recovery, Disable/Enable); existing 46 T pass. Website injection/disposal, visible lifecycle controls and required installed B remain open. No phase completion claimed.
