# Current work

**P10 — Protected account enrollment: implemented and verified at required T/B tiers; ready to merge.**

P01–P09 are merged. Actual main `4c032df91ca66d875462d9d69cd899ad5a377af8`; postmerge P09 [41231683976](https://github.com/Neb963/PCMS/actions/runs/41231683976) T/B/DSK PASS. P10 [PR #10](https://github.com/Neb963/PCMS/pull/10), branch `p10-protected-enrollment`.

## Implementation and evidence

The plan delivered durable Add before setup, finite Core queue operations, blocked donor-owned Personas, protected route selection/assignment/probes, human login, durable Confirm, fresh identity/route checks and atomic unique Ready binding. Actual Accounts controls include Add, login, Confirm, Repair, Open, check, search/filter/paging and retained drafts. Unknown native effects use authenticated same-operation readback; no replay. Early/final donor routing uses Core-derived pins, withdrawn during route verification. Existing package metadata remains compatible through exact module ID/scoped capabilities. Failed identity jobs stay terminal until a new explicit contextual command.

Final source `2350530dc148b38ae01fba92d7b1789dcd305f8c`, tree `52c260150e0802361cb3c7bbaa21ea5e7df435c8`, [41240772320](https://github.com/Neb963/PCMS/actions/runs/41240772320): **101 T/build and complete B PASS**. XPI SHA-256 `6de93c0fdb364905fc95af2cdbc2f29614a4697e1abbbf0d9c4d48cb8c06bdfc`. Firefox 155.0/build 20260817142839, normal sandbox 6 and normal certificate validation.

The installed production XPI journey independently verified real Add/permission/missing-bridge holds; blocked Persona and Pause/process restart/resume; two protected fixture contexts; human fixture login; wrong-container refusal; rapid visible double Confirm with one authenticated read and post-Confirm observation times; exact Open Perchance; lost native prepare response followed by real process restart and authenticated recovery with one prepare/same Persona/job; filter continuity. A disposable native-protocol/authenticated SOCKS/trusted HTTPS fixture never forwards external sockets or invokes the real bridge. No fixture endpoint/bypass ships. Earlier failed fixture/UI timing attempts are retained in PR history; final evidence covers the rebuilt candidate.

## Next

Publish this evidence checkpoint, merge PR #10, verify exact remote main tree and postmerge focused/installed success. Then write P11's actual implementation plan before code and continue automatically through all safely eligible phases. P11 covers Archive/drain, fresh Reactivate, confirmed local Remove, secret-safe tombstones/history and contextual lifecycle controls.

Live H/G/P1–P5 remain NOT TESTED and unauthorized. P42/P49 qualify actual bridge/two accounts/capacity later. No real account registration, automated credentials or live provider/route mutation occurred. This is development progress, not overall project readiness.
