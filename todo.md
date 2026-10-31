# Current work

**P08 — Searchable Journal and completed exports: COMPLETE; merge/postmerge verification pending.**

P01–P07 are merged. P07 main `90cb5c1610fbf761fea055b604226af2dbe16991` passed postmerge [41227136530](https://github.com/Neb963/PCMS/actions/runs/41227136530).

P08 branch `p08-journal-exports`, [PR #8](https://github.com/Neb963/PCMS/pull/8). Verified source `7e1b8e51307162ff268e5f9b0aca1756afcc38ae`, tree `41c88a6bb5f62b534ac648c0ec1fd23bf8349474`. Final diff/syntax/whitespace review passed.

## Implemented and verified

- Shared packaged Core Downloads owns durable profile-specific receipts and content-addressed export bytes. It validates relative paths, observes exact extension/path/time/size identity, distinguishes known browser failure from lost durable ID, and never replays an Unknown request. Journal enablement does not own this service.
- Bundled Journal 0.2.0 runs finite steps in the existing sandbox/queue. ZIPs include exact sequence coverage, count/hash/gap metadata and a completion marker. Local result/watermark application is atomic and idempotent; manual ranges do not advance automatic progress. Terminal failure preserves prior success and records.
- Enabled Journal reconstructs one coalesced 30-minute deadline and operates during global Pause with the dashboard closed. Disable stops its new work/search/export; Core recording continues. Known in-flight results reconcile. Finite RUNNING jobs become preserved read-only rechecks across lifecycle fencing.
- Settings → Journal has operating search, exact filters, stable paging/details, range export, interval/destination, last-result/status recovery and persisted drafts. The pager cannot consume a cursor from an unfinished different query. Old inert development ZIPs require explicit compatible updates, rather than silent reseeding.

## Evidence

[Run 41229143241](https://github.com/Neb963/PCMS/actions/runs/41229143241): focused T and installed **B/DSK PASS**, Firefox 155.0/build `20260817142839`, normal OS sandbox 6. Tested XPI SHA-256 `a0c14d043e22543c0f9f9a07a4cf8c35ee16b69511ce52a07bd3c4042206356b`.

The actual Settings/sandbox/Core/Downloads journey independently reopened production disk ZIPs with Python CRC/digest/full-range checks and all 65 controlled fixture targets. It passed later-page search/filter/details, saved settings, global Pause, dashboard closure, native event-page termination/alarm wake, module Disable/Enable, a genuine process restart, incremental ranges with no missed-export burst, injected IDB receipt loss after a real download with exactly one file, and a real unwritable destination with prior files/watermark/unrelated sentinel preserved. No provider or route effect.

Earlier failed runs remain on PR #8: the first assumed concurrent fixture events occupied consecutive sequences; the next used a stale pager during an unfinished search. The test now preserves every actual record and waits for the real filtered result; product paging is fenced during load. Neither failed run was reported PASS.

## Next and holds

Merge PR #8 with the verified head, compare its remote main tree and postmerge checks. Then write the P09-specific retention plan here and continue sequentially. Do not stop for interphase confirmation.

Retention/deletion remains P09; large-volume stress remains P40/P41. Actual AI teardown and all G/H/P1–P5 remain NOT TESTED until authorized later acceptance with named disposable targets/effects. This is a development checkpoint, not complete product readiness. Local normal-sandbox Firefox is unavailable (`uid_map: EPERM`); existing CI supplies required B/DSK without weakened security.
