# R01 — default causal diagnostics and bounded exports

Date: 2026-11-02. Base: `a3a084dcdb52cb51ff1ef82d1287d18fa7661129` / tree `9fa5ffa20dd70ef2c4570541ee49255eacd2f6d0`. Authority: accepted v42, design revision 2, AGENTS.md, CI-GUIDELINES.md; unchanged.

**Status: PARTIAL — default installed export and bounded suffix evidence PASS; broader diagnostic matrix remains open. No operator testing.**

## Actual state and plan

No open PRs or remediation branches existed at inspection. Main matched the package lock. All 29 package files verified. The phase plan was committed before code and published at `470c8756284e2407bb4b66341dba9cce02542afc`, tree `4b397822b1b49be0b0ba797079db8dabcd09ef77`. Prior P41 CI is historical, not remediation acceptance.

## Root causes and changes

| Defect | Prior grade | Root cause / change | Status |
|---|---|---|---|
| IA-01 / IA-02 / IA-05 / IB-08 / IF-01 | Confirmed | Eight-field event format and untyped queue catch lost causes. Typed allowlisted diagnostics now accompany transactional state changes and preserve original exception classification, immutable operation, safe comparison metadata, state/recovery and boot identity. | Source verified; B/DSK pending |
| ID-03 / IE-09 | Confirmed | Hold codes were private state only. Changes project codes and state/phase into events. Git comparison failure preserves individual field results; POST status is recorded. | Source verified; full adapter matrix pending |
| IF-02 | Reproduced | Export scanned oldest prefix. Existing event primary key now seeks directly to explicit first/last range, bound into stable cursor identity. | Actual fake-IndexedDB 100k-prefix oracle passes; Firefox scale pending |
| IF-01 support context | Confirmed omission | Default schema-2 ZIP adds hashed `diagnostics.json`: atomic redacted current inventory with its own cut. Selected event range and current checkpoint cut are explicitly different. Schema-1 read verification retained. | Source verified; actual downloaded ZIP pending |

Changes: `diagnostics.mjs`, `records.mjs`, `queue.mjs`, `journal-archive.mjs`, `git-writer.mjs`, `core-service.mjs`. Generic exceptions now return INTERNAL_ERROR; actual quota/IDB error classes retain storage codes. Arbitrary exception messages, stack, cause payloads, source, tokens, private labels/principal/exit values and response bodies are excluded. Redacted fields/counts are explicit; only typed diagnostic scalars and digests pass.

## Tests and measurements

| Tier | Command / oracle | Actual result |
|---|---|---|
| T | `node --test tests/remediation-diagnostics.test.mjs tests/records.test.mjs tests/queue.test.mjs tests/journal.test.mjs tests/retention.test.mjs tests/git-writer.test.mjs` | 66 PASS. Actual production queue lost-reply/reopen, original Git comparison cause/no-replay; adversarial exception and ZIP-entry canary; range-bound cursor; quota/rollback; existing watermark/Pause/Disable/retention/no-replay checks. |
| S/T | 100,001 actual fake-IndexedDB event rows, export only sequence 100001; instrument `IDBCursor.continue` | One exported row, zero gaps, <=3 cursor continuations (asserted). Includes fixture setup; ~17–19s for the whole new test file. This is not installed Firefox performance. |
| T/build | `npm run build`; `python3 scripts/release-preflight.py build/pcms-dev.xpi` | Build produced a full-capability XPI; artifact preflight result recorded with subsequent CI. No delivery qualification. |
| B/DSK local attempt | `FIREFOX_BINARY=/tmp/pcms-firefox/firefox/firefox GECKODRIVER_BINARY=/tmp/pcms-firefox/geckodriver python3 tests/installed_journal.py build/pcms-dev.xpi` | BLOCKED before session: Firefox155.0b1 content process uid_map EPERM/SIGSEGV; Marionette response cannot decode. Normal sandbox retained. Connector get-info/list-pages also returned internal server errors. |
| B/DSK CI | Extended actual installed Journal UI/Downloads test + independent ZIP parser; original fault code/comparison, route age, current context; paused/closed dashboard/restart/Disable/interrupted download | Pending. Test uses explicitly synthetic local fault boundaries, not live native/provider behavior. |

The new assertions would fail P41: no diagnostics section, no original cause/correlation, non-storage misclassification, and 100k-prefix cursor traversal.

## Safety and compatibility

Intent remains durable before effect. Lost replies stay POSSIBLE and readback-only; no lock clearing or external replay. Git comparison behavior is intentionally unchanged until R02. No donor/route/source permissions or native protocol changed. Core recording continues independently of Journal enablement. Existing 30m/90d schedules and completion-watermark rules remain. Old three-entry schema-1 archives remain verifiable; new required checkpoint bytes/hash must validate before COMPLETE acceptance. No operator captures or secrets were published.

## Checkpoints / remaining work

Source checkpoint `c6b96096a02728cbcd703375f2d5d7d94495a54f`, tree `dd678fdd1364b3b141c9d511b399d3801786f876`, independently matched to local source tree through GitHub API. Git CLI write authentication is unavailable; GitHub connector writes use compare-and-swap refs and verified trees, no force.

R01 is not closed. Complete installed/disk fault semantics, real Firefox 90-day suffix measurement, remaining transport/Creator/route error matrix and subsequent integrated checks. R02–R08 remain unaccepted. Real P42–P49 G/H/P acceptance is NOT TESTED. No ready-for-operator claim or release artifact is authorized by these partial results.

## Observed installed receipt (supersedes pending entries above)

CI [41506387916](https://github.com/Neb963/PCMS/actions/runs/41506387916), source `f48a45228ba0fca83fd43c502a5113a072b68faf`, tree `cb1e1fe8467bec453e73a53a5a5db79863272297`: all configured focused/installed steps PASS. Installed artifact `13170544259` was downloaded and independently inspected. `installed-journal.json` reports Firefox155.0 / build20260817142839, sandbox6 / multiprocess enabled; XPI SHA-256 `40111aec89f9227f96afed31f825fc8aa027a46132bef7952aef9ae7911470d1`. Default ZIP/disk causal faults, private canary exclusion, interruption/restart/Pause/Disable checks PASS. Actual100001-event/90-day tail export: one row, five cursor reads,107ms; archive SHA-256 `7d697e143e00bbe8baed12410a944767fbaddfbf70724888d54779aa251a542c`. This is the executed synthetic local fault scope, not all provider failures.

Later source `2c83d531`, CI41510668203, default installed Journal and Git-writer steps also PASS. Discover's final fixture provider-scope assertion failed; later steps skipped. Exact final R08 and comprehensive transport/Creator/route failure matrix remain open.

## R08 causal-readback correction

Run41516312430/source7c4f426b retained passing installed Journal/100001-event tail/disk evidence, but actual Creator readbacks still used causally empty SAVE_VIEW events. Added an optional explicit allowlisted event to the private view transaction; Creator ownership/PREPARE/ACK/readback now commits exact typed cause and immutable job/operation with its private receipt. Ordinary views keep their behavior; rejected event validation aborts both receipt and event. Raw receipt/source/session data never enters the event.

33 focused records/Creator/diagnostics T checks PASS (17165ms), including three production Creator failure paths, support-ZIP content/secret scans, actual IndexedDB atomic rollback, cold same-operation and100001-row bounded range. Subsequent context/Creator/Deployer/source suite127 PASS (72026ms); final Accounts/Creator28 PASS. Matching real-Creator Journal→Downloads→independent ZIP assertion has been added to installed_creation.py and remains NOT TESTED until its next CI execution. This is additional coverage, not comprehensive R01 closure.
