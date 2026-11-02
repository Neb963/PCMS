# R04 — Creator protection dependencies and truthful Deployer waits

Date: 2026-11-02. Base R03 `50f28e1c8f7a8aa4617df92ec4070611ce5cf820` / tree `3c87bcc287328775d504e2ba7cccccfc371faf22`. Authority unchanged. Plan entered in todo before edits.

**Status: FIXED_PENDING_B / PARTIAL.**

## Root causes and changes

| IDs / original grade | Cause | Change and scope |
|---|---|---|
| IE-01/03, confirmed liveness | Creator allocated READY history, then held permanently after stale PREPARE; repair did not wake its job | Production Creator now asks Accounts for current proof before preparation/mutation. Safe route-dependent holds resume the same job after actual proof returns, without another owner scan. Read-only preparation cache gets a new cycle; confirmed creation remains attributed and cannot replay. |
| IE-04, confirmed | Override changed allocation but not protection | The new owner must pass the same protection dependency; override grants no route or effect bypass. |
| IE-05 / IB-04 / IF-04, confirmed | WAIT_CREATOR hid actual upstream cause | Deployer records and projects current upstream job/account/state/code; Work shows Creator's reason and a successful check reports that it is still waiting. No source claim before owner proof. |
| IE-06, source risk | Identical WAIT_CREATOR checkpoints rewritten | Persist dependency only when its identity/revision/state changes. Queue execution/wait transitions still record meaningful checks. Broader idle scheduling is R07. |
| IE-07, reproduced | Truthiness accepted catalog NO | Intake/allocation and final create preflight now require exact YES. Fixtures now use real catalog values; explicit NO/unknown/bool/malformed negatives retained. |

The exact historical PREPARE code/template contract remains unproved; no new live evidence is inferred. Fresh availability, authenticated ownership, immutable effects, private template, unlisted stable identity and final rename/source guards are retained.

## Verification

84 focused actual production-code Creator/allocation/creation/Deployer tests PASS (about76s, including full source/Git/public/pool/DONE and AI fault cases). Added same RESERVED job → protected hold → repaired proof → one create/rename, with unchanged ownership observations; no write before proof. Added strict catalog YES/NO/malformed oracles. Existing lost CREATE/RENAME replies, restart/override fences, unrelated owners, WAIT_CREATOR writer ordering and protected full-source/publication/Git tests pass. The later narrowed Creator refinement is checked separately in the next checkpoint.

Required matching installed native-fixture TTL/Creator/Deployer/Work and final visual tests are NOT TESTED. Local Firefox sandbox remains blocked; CI will exercise the integrated artifact. R01's actual installed CI41506387916 passed; independently downloaded receipt: Firefox155.0/build20260817142839, sandbox6, XPI40111aec89f9227f96afed31f825fc8aa027a46132bef7952aef9ae7911470d1, actual100001-event/90-day one-row export107ms,5 tail cursor reads. This is earlier R01 evidence, not an R04 PASS.

## Safety / remaining work

No Direct, duplicate route/create/rename, uncertain replay, source overwrite, premature writer/publication or forced Git. Jobs and original effect IDs remain; prior-good source and root instructions remain protected. R05 must complete joined filters/selection/search and installed diagnosis. R06 must inspect actual screenshot pixels and accessibility. R07 must measure persistent waiting/query load. Real G/H/P42–P49 stays NOT TESTED. Checkpoint SHA/tree and installed results must be appended when independently observed; no release qualification yet.

Integrated B result: CI41512200622/sourcebef12ba9 actual Creator reached one applied CREATE with lost body, then timed out after restart/Check before rename. Its old helper lost the replacement session handle on exception, so its final state receipt was absent and browser cleanup incomplete; fixed handle tracking and automatic-proof wait. Root of that exact B timeout remains unproved pending the improved receipt. A separate source regression reproduced protection metadata changing account revision after READ_CREATE but before rename. Creator now synchronizes protection **before** readback, even for reconcile/POSSIBLE, retaining the same original effect while proof is unavailable. It records a safe correlated READBACK_ONLY wait.16 focused Creator tests PASS including one-create/one-rename and absent-proof no-replay. Matching installed rerun required; not closed from source alone.

## R08 same-effect dependency wake

Run41516312430 failed lost-CREATE restart recovery after successful route renewal. Creator now asks Accounts for a usable protected context and records a bounded protection dependency while its CREATE/RENAME remains POSSIBLE. A changed eligible account revision wakes only that original readback; unchanged initialization adds no duplicate checkpoint. Original operation/cycle/reservation remain intact. Production regression verifies one create/rename, no extra ownership scan, and no synthetic retry permission. Context completion, duplicate wake and changed identity tests pass; installed recovery remains pending on matching XPI.
