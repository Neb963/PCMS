# Current work

**P03 — Shared queue, writer holds and global Pause: IN PROGRESS.**

P02 is COMPLETE in PR #2, merge `c2dec0b2a29071bd831a4ac4fb8353e81ae8eb9a`, tree `f2dc4373c8e3c6d9bb54c2c355d3b7fa6016995b` (matches final PR candidate). Postmerge run [41218930206](https://github.com/Neb963/PCMS/actions/runs/41218930206): focused and installed PASS. P02 installed evidence/known realm issue is retained in memory/learned; no repeat of historical research.

## Implementation plan (before code)

- [x] Extend the one Core transaction boundary with durable typed queue operations. Enqueue deduplicates logical and request IDs; changes require expected revisions. Jobs retain module schema, exact target, account, input refs, due times and typed recovery.
- [x] Implement finite fair module/account turns, due-time wake reconstruction and reserved host-class maintenance turns. A module cannot invent maintenance authority. Keep writer holds durable and runtime boot/generation leases separate.
- [x] Commit BEFORE/POSSIBLE/OBSERVED per operation. Serialize dispatch admission and recheck immediately before every packaged adapter call. Lost ACK/crash remains Unknown/read-only reconciliation; no timeout or lease expiry authorizes replay.
- [x] Add immediate global Pause admission closure, durable Pause/epoch, Pausing while calls drain, and Resume dependency recheck/coalesced deadlines. Enabled Journal/Backup maintenance and Core recording continue; module Disable remains distinct.
- [x] Add operating global Pause/Resume and Work list/detail/filter/batch views over the same jobs. Persist view state; show exact target/recovery and Unknown. No inert module/provider controls.
- [x] T: uniqueness, stale writes, writer competition, fair turns, due times, pause races, missing ACK, crashes at effect boundaries and storage/recording failure.
- [ ] B: persistently installed qualifying Firefox; visible Pause/Resume during an independently counted fixture call, closed dashboard, real event-page termination and process restart, durable jobs/Pause, no replay/burst, Work exact Unknown target. No shipped fixture/test bypass and no live provider effect.
- [ ] Publish code/todo checkpoints, verify remote commits/trees, merge verified P03 via PR, verify postmerge main, then automatically plan P04.

## Evidence / holds

P03 T: 12 queue checks PASS locally (30 focused total); B: PASS in run `41219609666` on `9568dde8fde6ccd47b6f65ece30368a8133a52fe`; final command-deduplication changes await current-candidate B. P02 18 focused and B/S (50/1,000) PASS; source and artifact receipts remain in the merged phase history. Larger byte/Journal load and live Git/provider/native checks remain NOT TESTED at their planned phases. The XPI remains an incomplete development checkpoint.

## Next action

Publish Core/queue/UI checkpoint, then complete installed P03 journey. P04 waits for required P03 evidence.

The queue uses the existing records/events transaction. Work uses an indexed retained-version order. Due alarms are acknowledged once and do not poll when no module runner exists. Finite module execution is P04; no product/provider workflow is claimed.

Queue/UI checkpoint `f9fcc927f777effe788566a7c82b9b3fde0801ba` is pushed in draft PR #3. Installed harness now drives a real packaged dispatch, independently counts its synthetic effect in a separate fixture boundary, clicks Pause/Resume, closes the dashboard, calls Firefox's actual event-page termination and performs a new-process restart. Required B remains NOT TESTED until its run passes.

Installed evidence: Firefox 155.0 / build 20260817142839, sandbox 6. Native background termination observed running → stopped. Persistent XPI SHA-256 `b97357800e7913021b4c9548fc72939917865b80b3288a9fbda86c5707671762`. Independent fixture effect count remains exactly one through visible Pause/Resume, dashboard close, termination/wake and real process restart. Work opens the exact held job/target as Unknown. Receipts: https://github.com/Neb963/PCMS/actions/runs/41219609666/artifacts/13050000097. Final tests add conflicting-command rejection and Pause after committed intent but before call.

Final contract review also adds creation/update timestamps to mutable Core rows and retained view/credential revisions. This repairs the shared schema without changing accepted authorities or stored IDs. Focused and installed current-candidate verification will cover the final source.
