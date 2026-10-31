# Current work

**P08 — Searchable Journal and completed exports: implementation plan.**

P01–P07 are implemented and merged. P07 [PR #7](https://github.com/Neb963/PCMS/pull/7) merged at `90cb5c1610fbf761fea055b604226af2dbe16991`; its main tree `24171db5fb909e35d592c541c34b86e4ac9babdb` exactly matches the reviewed PR head. Final premerge [run 41227006676](https://github.com/Neb963/PCMS/actions/runs/41227006676) passed 60 T and installed B on Firefox 155.0/build 20260817142839, sandbox 6. Postmerge run: [41227136530](https://github.com/Neb963/PCMS/actions/runs/41227136530). Reuse unchanged lifecycle/seed evidence.

## Plan from current repository

- Add the shared packaged Core Downloads service over the existing `files` store. Validate bytes and safe relative destination; persist immutable capture/path/hash/size/profile identity before dispatch. Reconcile exact browser DownloadItems after missing ACK/restart; never redownload an Unknown effect.
- Add Journal's finite module workflow to the existing queue/runner. Build checked secret-safe sequence-range ZIPs with count/digest/gap metadata; advance the automatic watermark only after actual download completion. Keep manual ranges separate from automatic progress.
- Persist the 30-minute deadline and settings on Journal's existing module row. Rebuild a single due job after cold startup/Enable; allow enabled maintenance during global Pause. Disabled Journal must neither search nor export; Core recording and Downloads stay independent.
- Add Settings → Journal search, filters/details, range export, interval, safe relative destination and actual last-result/recovery state. Use the same shell and module host; no second service/controller or filesystem agent.
- T: independent expected export bytes/ranges/gaps/redaction, exact receipt matching, missing/duplicate ACK, disabled separation, failed downloads/watermark preservation and coalesced deadlines.
- Required B/DSK: select actual Settings controls in a qualifying persistently installed XPI, independently reopen production ZIP bytes, test automatic work with dashboard closed/global Pause, Disable/Enable, actual process restart and interrupted receipt recovery. Distinguish real disk failures from injected API faults. Reuse existing package/route/lifecycle evidence; CI selects this focused journey because local normal-sandbox Firefox is unavailable.

## Holds and next action

No P08 code or tests exist yet. Required T/B/DSK are NOT TESTED. Large-volume/interrupted-download stress remains P40/P41. Retention/deletion is P09. Live G/H/P1–P5 remain NOT TESTED and require named disposable authorization; no such action is planned here.

Implement the Core Downloads/receipt boundary and focused tests first, with meaningful pushed checkpoints. Continue sequentially after P08 verification/merge; do not stop for interphase confirmation.

P07 postmerge [41227136530](https://github.com/Neb963/PCMS/actions/runs/41227136530) passed T/B on exact merged main. P08 first code checkpoint: Core Downloads now persists content-addressed bytes and file receipts before dispatch, reconciles exact extension/path/time/size identity, and retains Unknown/ambiguous/interrupted states without replay. Core has a profile identity independent of dataset IDs. Five focused Downloads checks and the affected records tests pass. Journal workflow/UI and required B/DSK remain unimplemented/unpassed.
