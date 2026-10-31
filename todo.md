# Current work

**P02 — Durable records and continuous Core recording: IN PROGRESS.**

Baseline: main `1d3807de442cee1da21199945d0e00341f4b0038`; P01 merged PR #1, accepted installed evidence run `41216717693`. No unfinished phase branch or unverified product change was found. Authorities stay unchanged. The user requests all remaining eligible phases, one at a time, without intermediate confirmation.

## Implementation plan (before code)

- [ ] Implement one IndexedDB Core with versioned dataset pointer, revisioned records, required indexes and atomic event/state commits. Fail closed on transaction/recording failure; preserve earlier data.
- [ ] Implement chunked content-addressed bytes, sorted complete source manifests, closure checks, retained references and capture pins. GC removes only unreachable bytes after pin release. No product byte/file cap.
- [ ] Separate packaged credential access from allowlisted public projections and structured secret-safe events. Reject raw provider errors/bodies, source/prompt/chat text and capability URLs.
- [ ] Add stable indexed cursor queries, durable view/draft saves and honest Home counts. Add only operating local UI: Home counts, Settings Journal projection and saved local view state. No provider/queue controls before their phase.
- [ ] Verify T: real IndexedDB transaction rollback, event sequence/revisions, stale updates, secrets, missing references, exact binary bytes, GC and paging under inserts/deletes. S: at least 50 accounts/1,000 generators, indexed multi-page reads.
- [ ] Verify B: persistently installed qualifying Firefox XPI; visible packaged draft save and fixture records through real Core actions; independent IndexedDB observations; dashboard close, actual process restart and exact readback. Inject storage failure in harness (no shipped fixture bypass), verify useful error and previous data.
- [ ] Push meaningful checkpoints, inspect remote HEAD/tree, run focused CI and affected installed journey. Merge verified phase via lightweight PR, verify postmerge main, then plan P03 automatically.

## Evidence / holds

T/B/S for P02: NOT TESTED. P01 unchanged receipts are reused. Live routes/providers remain NOT TESTED at their scheduled phases; none are authorized here. This is an incomplete development XPI.

## Next action

Implement the durable Core and public query boundary, then the packaged UI and focused evidence.
