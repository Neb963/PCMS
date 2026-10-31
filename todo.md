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

P07 environment result: local Firefox 155.0b1 could not create a content process with normal sandbox (`/proc/self/uid_map: EPERM`, Marionette startup failure). No installed product assertion ran and no sandbox protection was weakened. Use the existing GitHub Actions runner for the targeted P07 B journey. Website lifecycle uses donor URL/world helpers with exact document injection; normal navigation still requires the donor's current verified protected context. Selected ZIPs do not gain raw Core authority.

Targeted P07 installed harness now selects real local ZIPs and Modules actions. It uses a controlled editor loaded before the donor is installed; no route override/Direct fallback is introduced. The production generation-world disposer runs against that actual document. CI replaces its previous phase-specific seed journey with this lifecycle journey; trigger frequency, job count and compute remain unchanged. Local normal-sandbox Firefox is unavailable, so CI is necessary for this required evidence.

P07 run [41225264911](https://github.com/Neb963/PCMS/actions/runs/41225264911): focused 51 T PASS. Installed Firefox reached the real permission prompt, then the harness selected a hidden native notification template and could not click it. This is not a product PASS. Harness now selects the visible native shadow button. Eight focused lifecycle/website tests pass, including exact-world selection, dirty-stop denial and missing-document/receipt handling. Remaining installed journey is still open.

P07 run [41225401216](https://github.com/Neb963/PCMS/actions/runs/41225401216) passed T (54) but B exposed a dashboard render race: an earlier asynchronous render could remove a newly visible control. Each render now owns a separate mount, and initial view restoration avoids duplicate hash navigation. Also tightened failed-fence cleanup and explicit compatible rollback after activation failure; nine focused lifecycle/website tests pass. B remains unpassed; no phase completion or later phase admission yet.

P07 run [41225525584](https://github.com/Neb963/PCMS/actions/runs/41225525584) passed T, then Firefox's native permission popup button remained outside Marionette's scrollable viewport. The fixture now activates that real native button through the privileged browser driver; the product permission request/decision is unchanged. No mock permission or sandbox bypass is used. Added durable action-request deduplication and an IDB switch-transaction rollback test; 11 focused lifecycle/website tests pass. Installed evidence is still open.

P07 run [41225714661](https://github.com/Neb963/PCMS/actions/runs/41225714661) passed 57 T and real permission denial. B then timed out after the native grant click. The harness now waits for Firefox's security-delayed primary button to be enabled before activating it. Added a final instance-roster check after fencing and permitted only bound draft saves during STOP; effect requests stay revoked. Required installed B remains open.

P07 run [41225858415](https://github.com/Neb963/PCMS/actions/runs/41225858415) passed focused tests but again lost the permission control before the click. Root cause: the early hash listener could render navigation while the module script's initial top-level awaits were still running; its final startup render then replaced that view. Registering hash navigation after initial Core/view setup eliminates that overlapping startup path. The test retains the required actual control and now captures safe fixture UI diagnostics on failure.

P07 run [41225955123](https://github.com/Neb963/PCMS/actions/runs/41225955123) again passed T and permission denial; grant stayed disabled. Inspection of the exact downloaded Firefox 155 `browser-addons.js` established the cause: userScripts permission requires an unchecked native `moz-checkbox` before Allow can enable (the prior delay theory was incorrect). The harness now clicks that native checkbox and then Allow, preserving Firefox's actual permission workflow. No permission state is injected.

P07 run [41226174244](https://github.com/Neb963/PCMS/actions/runs/41226174244) passed T and both actual native permission decisions, installed the fixture and injected its real website disposer. B then found that a successful ZIP stage did not refresh the Modules rows, so Update was unavailable until navigation. The list now refreshes in place after import, preserving the selected file and form. Stop receipts are also persisted per instance before proceeding; recovery now opens the exact page whose stop failed. Twelve focused lifecycle/website tests pass, including partial-stop receipt recovery.
