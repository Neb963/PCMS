# Current work

**P02 — Durable records and continuous Core recording: IN PROGRESS.**

Baseline: main `1d3807de442cee1da21199945d0e00341f4b0038`; P01 merged PR #1, accepted installed evidence run `41216717693`. No unfinished phase branch or unverified product change was found. Authorities stay unchanged. The user requests all remaining eligible phases, one at a time, without intermediate confirmation.

## Implementation plan (before code)

- [x] Implement one IndexedDB Core with versioned dataset pointer, revisioned records, required indexes and atomic event/state commits. Fail closed on transaction/recording failure; preserve earlier data.
- [x] Implement chunked content-addressed bytes, sorted complete source manifests, closure checks, retained references and capture pins. GC removes only unreachable bytes after pin release. No product byte/file cap.
- [x] Separate packaged credential access from allowlisted public projections and structured secret-safe events. Reject raw provider errors/bodies, source/prompt/chat text and capability URLs.
- [x] Add stable indexed cursor queries, durable view/draft saves and honest Home counts. Add only operating local UI: Home counts, Settings Journal projection and saved local view state. No provider/queue controls before their phase.
- [x] Verify T: real IndexedDB transaction rollback, event sequence/revisions, stale updates, secrets, missing references, exact binary bytes, GC and paging under inserts/deletes. S: at least 50 accounts/1,000 generators, indexed multi-page reads.
- [x] Verify B: persistently installed qualifying Firefox XPI; visible packaged draft save and fixture records through real Core actions; independent IndexedDB observations; dashboard close, actual process restart and exact readback. Inject storage failure in harness (no shipped fixture bypass), verify useful error and previous data.
- [ ] Push meaningful checkpoints, inspect remote HEAD/tree, run focused CI and affected installed journey. Merge verified phase via lightweight PR, verify postmerge main, then plan P03 automatically.

## Evidence / holds

T: 18 focused checks PASS locally, including fake-indexeddb request-level rollback/quota faults. S: 50/1,000 indexed snapshot traversal PASS locally. B/S: PASS on `2cb6fa1b85df53eae58e9a79c4d5e7a2920dc232`, run `41218729913`; Firefox 155.0 / build 20260817142839, normal sandbox 6, XPI SHA-256 `de54c4c0053d0893c50555185e82c841d936021d2874eb2525ee6ba1236a3242`. Persistent installation, visible Home/Save view, independent IDB observation, closed dashboard/new process, exact binary source, all 1,000 rows and injected quota UI/recovery PASS. P01 unchanged receipts are reused. Live routes/providers remain NOT TESTED at their scheduled phases; none are authorized here. This is an incomplete development XPI.

## Next action

Publish the Core/UI/installed-harness checkpoint, then inspect actual CI results. No P03 implementation before P02 required evidence.

- First checkpoint `19eb4aeeacc0c855d97106309fbc8b009596afad`, tree `f1c0fe0c4d72357f049727e3fd3738ed7bc0f73d`, verified against local tree. CI run `41218539727`: focused PASS; installed found a genuine cross-realm typed-array check defect before source setup. Replaced realm-specific `instanceof` on incoming bytes with checked copied byte views; added focused regression. Required B remains open.

- Checkpoint `4ac27bbafa88f59958cfb6c0ff60843e10eaf6c8`, tree `e195bc3dbf9c6f439800af984bae072457d98f58`: focused PASS; B run `41218634832` reached visible counts, saved view and process restart, then exposed the same realm-specific check on *readback*. Applied the same byte-view validation to cold chunks. Added query-scope and RPC-denial tests (18 total focused checks).

Installed receipts/screenshot: https://github.com/Neb963/PCMS/actions/runs/41218729913/artifacts/13049345906. A final two-line empty-Journal range guard is T-verified; the nonempty installed boundary is unchanged. Final current-candidate and postmerge checks remain to be verified before P03 starts.
