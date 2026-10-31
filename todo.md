# Current work

**P06 — Bundled first-install module seed: COMPLETE, MERGED.**

P01–P06 are merged. P06 [PR #6](https://github.com/Neb963/PCMS/pull/6) was squash-merged at [`4fa1264a227984ccf71d2d4f3b722e7ec35c6ece`](https://github.com/Neb963/PCMS/commit/4fa1264a227984ccf71d2d4f3b722e7ec35c6ece). Verified postmerge tree `1c6ac107fb83ed7cad766a07143fc86e3b2ea371` exactly matched the verified PR head tree.

## Completed bounded outcome

- Seven first-party local ZIPs (Accounts, Discover, Creator, Deployer, Refresher, Journal, Backup) are deterministic, hash-verified with the P05 validator, and bundled without remote code or a new permission.
- Core atomically commits all seven enabled records, exact version/package/manifest/payload references and the first-install marker. Interrupted module-row writes roll back, and the same seed can be retried on a later startup; existing registries and module/user choices are not overwritten.
- Modules settings shows real versions/enabled state and actionable failed-initialization retry. No nonfunctional module pages are exposed; actual module workflows belong to later phases.
- Source/packaging and UI tests retain user-selected ZIPs, disabled-state fixtures, settings, unfinished jobs and drafts through a real browser restart and versioned in-place extension update.
- Work stayed in the accepted single Core/module-host architecture, with donor-first protected bootstrap and normal CSP/OS sandbox. No real provider/route mutation.

## Verification and provenance

**Focused T:** 46 passed, 0 failed. **Installed B:** PASS on Firefox 155.0, build `20260817142839`, sandbox level 6. Postmerge [run 41223585280](https://github.com/Neb963/PCMS/actions/runs/41223585280), merged source `4fa1264a227984ccf71d2d4f3b722e7ec35c6ece`; tested merged XPI SHA-256 `d121bd0e912274f0f3d424fb2bc00badf468732525eecbe07cf101e3b304ceef`.

Premerge final-code [run 41223444750](https://github.com/Neb963/PCMS/actions/runs/41223444750) also passed 46 T and installed B at code `ca484bceed7a193580cf55efb217fde7427266fc` (XPI SHA-256 `b5b7dc50b70e230863861252da3120c823c491b9b69b01ee00cb0eacf6e16fdc`). Subsequent PR changes were documentation only. Earlier CI [41223284976](https://github.com/Neb963/PCMS/actions/runs/41223284976) failed because the unit test assumed IDB insertion order and the Firefox test asserted before async Other rendering. [41223366462](https://github.com/Neb963/PCMS/actions/runs/41223366462) passed T and reached real extension update, but asserted before the async Modules list finished. Test timing and ordering assertions were corrected without weakening the required outcomes.

**Deferred:** Active package replacement, operational Disable/Enable, generation teardown and dirty-editor preservation at P07; H/G/Perchance production behavior at the authorized later evidence tiers. This XPI is a development checkpoint, not the complete product.

## Next eligible phase

**P07 — Safe module update, disable and cold recovery.** Not started. The next implementation task must inspect current main, write the P07-specific plan here *before* code, execute and verify exactly that one phase. Do not repeat P06 research or installed journeys.
