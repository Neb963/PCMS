# Current work

**P06 — Bundled first-install module seed: IN PROGRESS.**

P01–P05 are merged into `main`. P05 PR #5 merged at `9795a433140a5be8c1c90b1f8b11e5283edd2ea2`; postmerge [run 41222521879](https://github.com/Neb963/PCMS/actions/runs/41222521879) PASS. P05 verification was on `0174246345b6612d60f381fb825532422e3a23ec`, [run 41222335600](https://github.com/Neb963/PCMS/actions/runs/41222335600). No open PR or unfinished branch found; P06 is the first dependency-eligible phase.

## P06 implementation plan — written before code

- [ ] Bundle seven deterministic, valid, locally packaged module ZIPs: Accounts, Discover, Creator, Deployer, Refresher, Journal, Backup. Verify exact ZIP/manifest/payload hashes using the P05 validator. Keep unfinished workflows inert and do not expose fake operational pages or controls. Preserve the donor-first host, permissions and sandbox CSP.
- [ ] Add a private packaged Core first-install seeder, called at startup before module runners. Stage validated package blobs with a temporary pin; commit all seven module rows **and** the dataset-independent initialization marker in one IndexedDB transaction. On failure/crash, expose no partial fleet and retry on a subsequent startup; do not restart with a second controller.
- [ ] Never overwrite an existing module registry, chosen ZIP versions, settings, disabled state, staged updates or jobs. Keep a marker on restart, extension update and later dataset restore. Surface real seeded version/status in Settings → Modules, and list only pages with implemented operations.
- [ ] T: deterministic/package validation/hash checks; transactional rollback and interrupted blob staging; repeated startup, existing-registry/disabled/upgrade/restore preservation and secret-safe failure recording.
- [ ] B: persistently install the built XPI in qualifying Firefox with normal sandbox; inspect all seven enabled packages/hashes in Modules and independent IDB, then restart Firefox and update the installed extension in place while preserving changed module settings/status, jobs and user ZIP. Do not perform provider or donor-route mutations.
- [ ] Publish meaningful GitHub checkpoints with `todo.md`; verify remote commits and tree, run focused and changed-boundary installed CI. Merge a verified P06 through a lightweight PR, verify postmerge `main`, and stop before P07.

## Evidence / holds

T and B are **NOT TESTED** on P06 code. H/G/P live effects are deferred by the accepted phase plan. P07 owns active-generation update/Disable/Enable and dirty-editor teardown; the P06 preservation fixture may set existing disabled state directly, but is not P07 operational acceptance.

## Next action

Implement deterministic bundled resources and private atomic seed path; then exercise focused T before installed B.
