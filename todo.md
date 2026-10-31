# Current work

**P14 — Persistent slug checking: planned from verified main.**

P01–P13 are merged. P13 [PR #13](https://github.com/Neb963/PCMS/pull/13), main `39d58ffab7ae72fdac6c78d0449abfbf4979ddbe`, exact tree `380624e38c486609605a01f0a5349b08a811e03a`; postmerge [41249373581](https://github.com/Neb963/PCMS/actions/runs/41249373581) PASS. Final P13 source0fab18d5 passed136 T/build and required installed Git recovery B in41249157751, XPI1dc9058253eefc32335c7fee0ca43eced1e410ed68ba71568b242cb291d3701f.

## P14 implementation plan

1. Implement Discover0.2 as finite module steps over the existing Core jobs/records/queue, with one durable batch containing original input, normalized/rejected/colliding rows, per-item observations/dates and saved position. No second scheduler/controller/store. Import preserves every entry; completed observations never automatically recheck.
2. Use a selected Ready account and the existing private donor binding/route checks. Add a fixed read-only slug observer with a dedicated protected checking tab, exact URL/container/document proof, one active checking-tab owner and bounded loading. Never reuse login/editor/human tabs; manual interaction/document change holds and preserves the old tab. No provider mutation/API create/save, Git write or raw module URL/script authority.
3. Match accepted Available/reserved literals exactly after layout-whitespace folding only, including Unicode, punctuation, typo and link visible words. Observe known actual output structure in permitted loaded frames; generic shell/iframe/changed/partial text/error/challenge/inaccessible content is Unknown; conflicting facts remain Unknown.
4. Start/Pause/Resume operate the same saved batch. Use one observation per finite turn, two-second minimum interval after completion and backoff on Unknown. Unknown stops this batch until explicit Resume, continuing only unfinished rows. Synchronous batch admission fence plus final queue dispatch checks make global Pause/module Disable dominant. Interrupted read-only observation needs attributable same-page readback or explicit inspection/Resume, never an automatic completed-row recheck.
5. Add actual Generators→Check slugs and Discover controls, saved input/account/selection, per-row results/dates, batch history paging and contextual failures. Export a checked ZIP of saved JSON/CSV results through the existing Core Downloads adapter and durable queue/file receipt, independently of disabled Journal; no optimistic Download success.
6. Focused T covers exact/changed/partial/conflicting/frame classification, normalization/collisions, durable sequential cursor, Pause/Unknown/restart/no completed recheck, wrong account/document/generation and export errors. Required B uses the built production XPI, real protected rendered fixtures including actual framed output, all controls, global Pause/closed-dashboard progress, real process restart and independently reopened export bytes with Journal disabled. Reuse P10 enrollment helper only to establish one protected fixture account; do not rerun its historical adverse suite.
7. Publish frequent meaningful code+todo checkpoints and verify exact remote files/trees. Run focused/build and affected installed journey through existing CI. Merge verified P14, verify postmerge main and automatically continue P15.

## Execution and holds

P14 code not yet written. Next implement/test the classifier and durable batch policy, then private protected observation and actual UI/export journey. The local execution environment remains unavailable; use verified GitHub file/tree/commit checkpoints and CI. No unavailable local command is claimed run.

G/H/P1–P5 remain NOT TESTED and unauthorized. P44 separately qualifies current native slug rules/messages/frames; fixtures do not establish live availability. No provider/Git target mutations in P14.

Classifier checkpoint: exact accepted literals/layout folding, historical native normalization with retained collisions/rejections, and fixed isolated-world output snapshot are drafted with independent focused cases. Durable batch/adapter/UI/export and required final T/B remain OPEN.

Durable policy checkpoint: batch rows/position/dates now live in the one Core job, with finite sequential read receipts, explicit Unknown/Resume, Pause fences and two-second/backoff deadlines. Core Downloads ZIP export preserves original/rejected/colliding rows with checked JSON/CSV hashes and a real file receipt. Adapter/primary UI/tests and final T/B remain OPEN.

Integration checkpoint: the private donor adapter now owns fixed slug navigation/observation in one dedicated protected tab, preserving uncertain/manual contexts. Discover0.2 finite callbacks require exact bound job/target/account/revision. Core routes and bundled/build integration are connected. Primary UI, focused batch tests and installed journey are next; no final verification claim.

Actual packaged Discover page now has Import/Start/Pause/Resume/Export/check, durable drafts/account/batch/row selection, saved batch history and result paging; Generators links to that registered module page. Focused batch tests cover Unknown/explicit Resume, interval, immediate Pause, disabled/global admission, receipt-ACK loss/no repeat and independently reopened export bytes. Earlier CI41249764149 caught the expected seed-version oracle needing Discover0.2; its exact page/capability assertions are updated. Final affected B remains OPEN.

Required installed Discover journey is drafted: one real fixture account, actual module page controls, trusted rendered exact/link/reserved/framed/changed messages, both Pause layers, dashboard closure, process restart with input/account/row preserved, explicit Resume without completed rechecks, and independent ZIP/JSON/CSV disk reopen while Journal is disabled. Existing CI now selects this affected journey; no live provider target. Final T/B remain OPEN until actual CI evidence.

CI189940ff revealed that first-install validation still rejected every nonempty bundled page descriptor. Discover is the first operating module page. Seed now requires the exact packaged Discover page contract (not arbitrary pages), while preserving all ZIP/hash/capability checks. The strict-parser test compares descriptor data across its deliberate null prototype. All six new batch tests passed; affected final CI still required.

Recovery review adds an explicit Check interrupted observation path: same-operation read-only recovery can settle a POSSIBLE read even if the batch/global state is paused, preserving the batch Pause and leaving the next row unstarted. It cannot navigate or release admission. A focused regression exercises that boundary. Final rebuilt evidence required.

Final review binds every slug result to a fresh authenticated principal in the exact protected checking document, and rejects error-message/challenge content inside output frames. First installed run41250109812 stopped before Discover on an async Modules render wait; the harness now waits for the actual Journal Disable control and excludes favicon traffic from slug observations. Its focused run found one test-only variable typo in the new seed-version expectation; corrected. Required final evidence remains OPEN.

Safe-stop integration parks the dedicated checking context and disposes its isolated passive manual-use guard after module instances stop; no tab is closed. Saved rows remain and Enable requires explicit Resume of that batch. Focused stop/resume coverage is added. Export preparation errors now retain their typed cause in Work instead of a generic module failure.
