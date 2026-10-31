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
