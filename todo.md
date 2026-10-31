# Current work

**P06 — Bundled first-install module seed: VERIFIED; merge/postmerge next.**

P01–P05 are merged into `main`. P05 PR #5 merged at `9795a433140a5be8c1c90b1f8b11e5283edd2ea2`; postmerge [run 41222521879](https://github.com/Neb963/PCMS/actions/runs/41222521879) PASS. P05 verification was on `0174246345b6612d60f381fb825532422e3a23ec`, [run 41222335600](https://github.com/Neb963/PCMS/actions/runs/41222335600). No open PR or unfinished branch found; P06 is the first dependency-eligible phase.

## P06 implementation plan — written before code

- [x] Bundle seven deterministic, valid, locally packaged module ZIPs: Accounts, Discover, Creator, Deployer, Refresher, Journal, Backup. Verify exact ZIP/manifest/payload hashes using the P05 validator. Keep unfinished workflows inert and do not expose fake operational pages or controls. Preserve the donor-first host, permissions and sandbox CSP.
- [x] Add a private packaged Core first-install seeder, called at startup before module runners. Stage validated package blobs with a temporary pin; commit all seven module rows **and** the dataset-independent initialization marker in one IndexedDB transaction. On failure/crash, expose no partial fleet and retry on a subsequent startup; do not restart with a second controller.
- [x] Never overwrite an existing module registry, chosen ZIP versions, settings, disabled state, staged updates or jobs. Keep a marker on restart, extension update and later dataset restore. Surface real seeded version/status in Settings → Modules, and list only pages with implemented operations.
- [x] T: deterministic/package validation/hash checks; transactional rollback and interrupted blob staging; repeated startup, existing-registry/disabled/upgrade/restore preservation and secret-safe failure recording.
- [x] B: persistently install the built XPI in qualifying Firefox with normal sandbox; inspect all seven enabled packages/hashes in Modules and independent IDB, then restart Firefox and update the installed extension in place while preserving changed module settings/status, jobs and user ZIP. Do not perform provider or donor-route mutations.
- [x] Publish meaningful GitHub checkpoints with `todo.md`; verify remote commits and tree, run focused and changed-boundary installed CI. Merge a verified P06 through a lightweight PR, verify postmerge `main`, and stop before P07.

## Evidence / holds

Initial P06 CI [run 41223284976](https://github.com/Neb963/PCMS/actions/runs/41223284976): T failed at seed.test line 34 due to assuming insertion rather than indexed sort; B failed at installed_seed.py line 69 due to checking asynchronous Other rendering before it appeared. Both test-oracle defects corrected on branch. A second B run [41223366462](https://github.com/Neb963/PCMS/actions/runs/41223366462) reached in-place update but checked the async Modules list before completion; changed only the wait condition, without reducing the expected seven-module assertion.

**Final current-candidate T/B PASS:** [run 41223444750](https://github.com/Neb963/PCMS/actions/runs/41223444750), source `ca484bceed7a193580cf55efb217fde7427266fc` (46 focused checks; installed Firefox 155.0, build `20260817142839`, normal sandbox 6). XPI SHA-256 `b5b7dc50b70e230863861252da3120c823c491b9b69b01ee00cb0eacf6e16fdc`. Installed checks: seven enabled packages with exact original ZIP and manifest hashes independently observed in IDB/Settings, no fake module pages, user-selected ZIP, retained disabled Refresher fixture/settings, unfinished job, draft; new Firefox process and real versioned in-place extension update retain state byte-for-byte. In-place update fixture changes manifest version to `0.6.1` without altering application code. No authorized live provider operation was made. No PASS claimed until current-candidate CI finishes. H/G/P live effects are deferred by the accepted phase plan. P07 owns active-generation update/Disable/Enable and dirty-editor teardown; the P06 preservation fixture may set existing disabled state directly, but is not P07 operational acceptance.

## Next action

Merge verified [PR #6](https://github.com/Neb963/PCMS/pull/6), verify remote main commit/tree and postmerge CI. Stop after P06. The next dependency-eligible phase is P07, planned only in the next implementation task.
