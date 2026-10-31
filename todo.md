# Current work

**P07 — Safe module update, disable and cold recovery: COMPLETE; merge/postmerge verification pending.**

P01–P06 remain merged. P07 is on `p07-module-lifecycle`, [PR #7](https://github.com/Neb963/PCMS/pull/7). Latest verified code: `d451bf8052ba5710ff18689fe67db623f05e58aa`, tree `9da0371a44f23e6717f934381616d3b82cfdc4bf`. Current user task requires continuous sequential execution after each phase, without interphase confirmation.

## Implemented

- Durable per-module stage/fence/STOP/SWITCH/REBUILD lifecycle, candidate start/schema validation, compatible explicit rollback and cold continuation. Requests are durably deduplicated. Incompatible jobs/settings remain intact.
- Generation gates reject stale requests and new read/write admission. POSSIBLE effects require same-operation readback. Each exact page stop receipt is saved before proceeding; an unresolved page retains its contextual editor action. No forced reload or Direct fallback.
- Donor URL/world helpers select exact protected documents. Common disposers stop only registered resources, resume partial cleanup once, and preserve editor source/chat. Normal iframe disposal explicitly revokes its Core binding.
- Settings has operating Update/Disable/Enable/rollback, actual optional userScripts permission request, visible held state and contextual recovery. Navigation, drafts, package provenance and unfinished jobs survive changes/restart. Import refreshes rows without clearing the selected file.

## Evidence

[Run 41226896469](https://github.com/Neb963/PCMS/actions/runs/41226896469) at `d451bf8`: focused T and targeted installed B PASS, Firefox 155.0 build `20260817142839`, normal OS sandbox 6. It exercised actual native permission deny/checkbox/grant, real ZIP selection/stage/update, the production dirty website disposer, exact editor focus/source/chat preservation, saved draft/job, Disable, genuine process restart and Enable. No provider or route mutations.

Final [run 41227006676](https://github.com/Neb963/PCMS/actions/runs/41227006676), source `d10ad088f925ffb0e10385dbe5ce460cec26ced1`, passed 60 T and targeted B. Tested XPI SHA-256 `04b590cee3979b4666793d28fee3a6ef1916c12aeae4a7f21fd9e2a9586ddede`. It also verified an actually valid Core page token before/after explicit close, no job from the revoked RPC, and exact unfinished job/draft bytes after cold restart/Enable. Final diff/syntax/whitespace review passed.

Local installed Firefox is unavailable because normal sandbox content processes fail `uid_map: EPERM`. Sandbox protection was not weakened. Existing CI supplies the required B environment. Diagnostic/source details: [P07 Firefox boundary](docs/diagnostics/P07-Firefox-boundary.md). Earlier failing runs are preserved on PR #7; they exposed native permission controls, startup rendering, stale rows and orphan page bindings and were not marked PASS.

## Next action and holds

Merge PR #7 with the verified head, compare postmerge tree and relevant checks. Then write the P08-specific implementation plan here and continue. P08, P10 and P12 depend on completed P07 interfaces/evidence; none has started.

Actual retained native AI-editor teardown remains NOT TESTED until authorized P46. Later G/H/P1–P5 still require named disposable targets/effects. This is a development XPI, not a complete product or production acceptance.
