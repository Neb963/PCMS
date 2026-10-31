# Current work

**P05 — Local ZIP selection and validation: IN PROGRESS.**

P04 COMPLETE in PR #4, merge `c2fa491a7327891d6c1d47383ad954192d5f0caf`, tree `12eda8231a823494a62daab6e79fc711413fde4a` (verified against candidate). Postmerge run [41221261147](https://github.com/Neb963/PCMS/actions/runs/41221261147): focused and installed PASS. P01–P04 evidence is retained in merged history/memory; no historical research is repeated.

## Implementation plan (before code)

- [x] Add a packaged established streaming inflate codec and strict ZIP structure checks: central/local identity, safe integer bounds, exact entry sizes/CRC/hash, UTF-8/case-fold-safe paths, no duplicates, traversal, symlink or encrypted entries. Keep the import resource budget visible/configurable, with actual quota errors and no product capacity cap.
- [x] Parse module.json with duplicate-key rejection. Validate exact known fields, format/Core ABI, strict release version, job/settings schemas, capabilities, complete payload inventory and declared entry/page paths. Preserve original ZIP and manifest hashes. Reject unsupported executable dependencies before registry writes.
- [x] Validate side-effect-free, then stage content-addressed files under an import pin. Atomically install a new enabled package; identical bytes are a no-op. Reject changed same-version/downgrade. Higher-version replacement is staged for P07's safe lifecycle, without changing the active generation or unfinished work.
- [x] Add operating Settings → Modules file selection/Install and visible import budget. Show exact validation/storage cause, preserve selected file/input and existing modules/jobs on failure. Open the new module's real page through P04 without extension reinstall.
- [ ] T: valid exact payload bytes and adversarial JSON/ZIP/manifest/dependency/version/resource cases, plus actual IDB quota/registry preservation. B: select actual local files, click Install, open module page and run its fixture action; exercise useful validation/quota errors and independently inspect unchanged registry/jobs.
- [ ] Publish meaningful code/todo checkpoints; verify remote commits/trees, focused and installed checks; merge verified P05 and verify postmerge main, then plan P06 automatically.

## Evidence / holds

P05 T/B: NOT TESTED. No provider/native operation is needed or authorized. ZIP distribution remains the selected local development model, with no signed/public distribution claim. Safe active-package replacement/Disable/Enable remains P07; no update bypass is introduced.

## Next action

Implement the packaged ZIP/manifest validator and atomic registry installation boundary.

Initial implementation and six focused package tests pass locally: actual ZIP/payload bytes, duplicate JSON/manifest fields, unsafe/case-folded paths, encryption/symlink/truncation/header faults, CRC/hash/listing/import dependency/resource errors, atomic IDB registry installation and quota preservation, compatible update staging. Installed selection and negative-case B remains NOT TESTED. fflate 0.8.2 and Acorn 8.15.0 are pinned, bundled locally by explicit build-copy imports, with licenses.

Checkpoint `5d66cb22722cbaf3ba18bf98ce01658b70e1139b` is pushed in draft PR #5. Focused ZIP64-directory and streaming data-descriptor cases now pass too (seven package checks, 41 focused total). The installed journey selects actual ZIP files, runs the installed sandbox action and checks precise duplicate-key/budget/quota UI errors against independently retained registry, unfinished job and draft. B remains NOT TESTED until CI passes.

Installed B run `41222147628` passes on `4cb2051f4b643edc9d8f6af0a4f9a68cd3ffca48`: Firefox 155.0/build 20260817142839, sandbox 6, XPI SHA-256 `a829534521ed0061a2719d1b33a6dde339bebfff7b6d64c71e39df68224d2804`. Actual file/Install/action and duplicate-key/resource/quota preservation all pass. Final review adds secret-safe failed-import events even for validation/version failures before staging; the validator itself remains pure. Current-candidate checks remain required for that final recording correction.
