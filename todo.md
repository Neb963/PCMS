# Current work

**P05 — Local ZIP selection and validation: IN PROGRESS.**

P04 COMPLETE in PR #4, merge `c2fa491a7327891d6c1d47383ad954192d5f0caf`, tree `12eda8231a823494a62daab6e79fc711413fde4a` (verified against candidate). Postmerge run [41221261147](https://github.com/Neb963/PCMS/actions/runs/41221261147): focused and installed PASS. P01–P04 evidence is retained in merged history/memory; no historical research is repeated.

## Implementation plan (before code)

- [ ] Add a packaged established streaming inflate codec and strict ZIP structure checks: central/local identity, safe integer bounds, exact entry sizes/CRC/hash, UTF-8/case-fold-safe paths, no duplicates, traversal, symlink or encrypted entries. Keep the import resource budget visible/configurable, with actual quota errors and no product capacity cap.
- [ ] Parse module.json with duplicate-key rejection. Validate exact known fields, format/Core ABI, strict release version, job/settings schemas, capabilities, complete payload inventory and declared entry/page paths. Preserve original ZIP and manifest hashes. Reject unsupported executable dependencies before registry writes.
- [ ] Validate side-effect-free, then stage content-addressed files under an import pin. Atomically install a new enabled package; identical bytes are a no-op. Reject changed same-version/downgrade. Higher-version replacement is staged for P07's safe lifecycle, without changing the active generation or unfinished work.
- [ ] Add operating Settings → Modules file selection/Install and visible import budget. Show exact validation/storage cause, preserve selected file/input and existing modules/jobs on failure. Open the new module's real page through P04 without extension reinstall.
- [ ] T: valid exact payload bytes and adversarial JSON/ZIP/manifest/dependency/version/resource cases, plus actual IDB quota/registry preservation. B: select actual local files, click Install, open module page and run its fixture action; exercise useful validation/quota errors and independently inspect unchanged registry/jobs.
- [ ] Publish meaningful code/todo checkpoints; verify remote commits/trees, focused and installed checks; merge verified P05 and verify postmerge main, then plan P06 automatically.

## Evidence / holds

P05 T/B: NOT TESTED. No provider/native operation is needed or authorized. ZIP distribution remains the selected local development model, with no signed/public distribution claim. Safe active-package replacement/Disable/Enable remains P07; no update bypass is introduced.

## Next action

Implement the packaged ZIP/manifest validator and atomic registry installation boundary.
