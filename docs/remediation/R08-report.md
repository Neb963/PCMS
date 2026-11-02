# R08 — integrated exact-artifact gate

Status: **BLOCKED / in progress. No operator-ready candidate or release XPI is delivered.**

The R08 plan was committed before integration changes (`fd545fc`, based on remote R07 `bef12ba9db4a68b37b439400dfc98379bd3e041e`, tree `514f1c894c564db1681f5e739ba3890a44cb1d47`). Main remains `a3a084dcdb52cb51ff1ef82d1287d18fa7661129`; PR45 is draft and unmerged. No live Perchance/native/content-repository operation was performed. Publication writes are scoped to this authorized implementation repository and non-forced branch/PR operations.

## Current exact-artifact evidence

- Prior full source run:497 PASS/0fail. R07 changed boundary:52 focused PASS, Deployer61 PASS. Clean local artifact preflight PASS on identical implementation tree; that local source ID/XPI is not the remote CI artifact.
- CI41510668203, source2c83d531: focused/default installed Journal/Git writer PASS; Discover FAIL at final provider-scope assertion. All subsequent installed stages skipped. Its artifacts are retained; no failed step is promoted to PASS.
- CI41512200622, sourcebef12ba9: focused/default installed Journal PASS observed; Discover's final assertion failed again. Later independent steps still execute and retain receipts. Exact final artifacts/results are pending.
- Local Firefox155 normal sandbox cannot create a session (uid_map EPERM/process crashes); it was not weakened. CI uses normal sandbox6/multiprocess Firefox155.0 build20260817142839.

## Integration corrections and unresolved work

Failure evidence now includes independent provider inventory and refused endpoint paths. Independent installed journeys continue after earlier failures while preserving failed job conclusion. The standalone pixel fixture requires its source-model initialization; corrected locally. Strict automatic-renewal verification now waits for the automatic outcome instead of racing it with a manual Open click; the AUTO_RENEW requirement is unchanged.

Required remaining gates: independently diagnose/fix current Discover failure; installed automatic route/native expiry/outage matrix and Creator/Deployer same-job progression; complete search/error/later-page/continuity matrix including the unproven historical incident; full actual state/viewport screenshots and pixel-model review with iteration; accessibility/keyboard/hidden focus and real controls; representative installed capacity/comparable baseline/long-session/automatic export rounds; backup/restore disk and one integrated full-capability rehearsal on the exact final XPI. Missing evidence is a blocker, not a waived condition.

No release SHA-256 or operator guide is designated until those gates pass. A predecessor build hash is evidence only. Real G/H/P42–P49 remains **NOT TESTED** and requires separate explicit resource/effect authorization.

## First integrated result and corrective checkpoint

CI41512200622 completed FAIL; installed artifact13175565696 was independently downloaded (ZIP digestd24d656ea72e8d8b63d8d246dc7285cc0de384ff619eb3e3badd1996ecbcfbd8). Exact XPI87ac1cf4b0afef3cdb6e0d7d0bac01df4e0a80b11a799503046c5a1836be7f00. PASS: default Journal, Git writer, persistent startup/registry, shared UI/source/cold automatic renewal, backup/restore activation,50/1000/90k capacity/disk. FAIL: Discover wait for existing-folder after hidden-commit outage; Creator lost-CREATE restart continuation; independent pixel fixture missing model initialization. First actual pixel review FAIL; mandatory matrix incomplete. See phase reports for precise correction and unchanged oracle. Earlier text saying the new Discover run failed the same final assertion was a premature inference; actual receipt places it earlier.

Full source499 PASS/0fail/202.8s. Comparative query evidence now recorded; RSS/CPU remeasurement scoped to this profile required. Added exact-XPI installed full DEPLOY/DONE, DEVELOP/Finish and Refresher negative/restart journeys to the next selected CI run. They remain NOT TESTED until executed; separate journeys do not establish the required one-profile end-to-end chain. Current corrections and final vision gates still require a matching rebuilt artifact.
