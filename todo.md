# Current work

**P09 — Owned-file retention and cleanup recovery: implementation plan.**

P01–P08 are merged. P08 [PR #8](https://github.com/Neb963/PCMS/pull/8) merged at `bdaefb9eb77ceef5fdf7ee575ae714d76429c642`, exact reviewed tree `8a5d530c8b8eb47854326c6654d5d8ec8e751d7c`. Postmerge [41229353436](https://github.com/Neb963/PCMS/actions/runs/41229353436) passed T/B/DSK. Reuse unchanged export/package evidence.

## Plan from actual code

- Extend the existing Core Downloads/receipt boundary with receipt-owned deletion for expired automatic files. Require current profile, exact DownloadItem identity/path/extension/size and a newer complete corresponding export. Never select files by glob; preserve manual/unrelated/imported files and earlier files on failed export.
- Use finite per-file CLEANUP jobs in the one queue. Persist each possible remove before dispatch, retain acknowledged/unknown removal state, and reconcile the same operation. A stale `exists` flag or missing history is a tracked hold, never permission for another remove. Browser history can remain; no history erasure is needed for disk retention.
- Add the configurable 90-day local/disk Journal retention setting. Prune only an exported, old, unpinned event prefix atomically with its record; preserve unexported records even beyond retention. Keep monotonic sequence identity and distinguish intentionally expired prefix from missing coverage. Release redundant completed-export payload storage without discarding source/job history or pinned captures.
- Journal schedules cleanup only after a completed new export and only while enabled. Core file primitives remain independent so enabled Backup can later reuse them with Journal disabled. Global Pause still permits enabled maintenance. Expose actual cleanup pending/attention and last-good/error state in Settings.
- T: exact age/configuration boundaries, profile/receipt authority, manual/imported/moved/replaced/history-loss exclusions, delayed metadata, interruption/no replay, exported-prefix pruning and pins. Use independent expected values.
- Required B/DSK: real expired owned automatic files, old manual/unrelated sentinels, failed new export, cleared browser history and delayed removal; inspect actual disk bytes/removal independently. Advance controlled fixture dates rather than waiting 90 days. Use the existing targeted installed CI job; no broader historical suite.

## Boundary facts and holds

The tested Firefox 155 implementation's removeFile awaits native removal but does not itself refresh DownloadItem.exists; search serializes stored target metadata. Keep a durable API acknowledgement distinct from later metadata and independent disk evidence. Do not force removal/history erasure from stale metadata. This extends the new product boundary; do not repeat basic Downloads feasibility.

P09 code and required T/B/DSK are NOT TESTED. Backup-specific prior-complete behavior is P31/P34. No live provider/route/Git effects are authorized. After P09, continue with the next eligible phase (normally P10); do not stop for interphase confirmation.

## Current checkpoint

P09 implementation in progress: Core receipt-owned cleanup with durable remove/readback state, export-only payload release and pinned-prefix local pruning; narrow Journal cleanup capability, finite module steps and Settings retention/attention UI are wired. Existing focused Journal/Downloads/seed tests: 17 PASS locally. New retention boundary tests and required installed B/DSK remain NOT TESTED. No new provider effects. Next: complete authority/recovery/pin tests, then real Firefox disk journey and phase checkpoint.
