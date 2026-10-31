# Current work

**Active phase:** P01 — Protected packaged host. Implementation exists; required installed verification is still open. P02 has not started.

## Baseline and plan

GitHub main was `c3a066a60813e6b83e63978b79181593a6a76234`, with no other branch, PR or Actions run. The phase-specific plan was published before code in `2b12bd8842e2b74e43e7710d5206443534034bb6`. Work is in [PR #1](https://github.com/Neb963/PCMS/pull/1), branch `p01-protected-host`. Accepted v42, design revision 2 and phase contracts stay unchanged.

- [x] Vendor the exact pinned donor extension/LICENSE with blob hashes and MIT attribution. Preserve Gecko ID, native protocol and permissions. Apply small checked build transformations; exclude legacy UI/command dispatch and workflow startup.
- [x] Add the donor-first MV3 module entry and synchronous shell/wake listeners. Keep P01 admission blocked; no account or provider operation exists.
- [x] Add one dashboard, serialized icon open/focus, the seven ordered navigation entries and bounded startup diagnostics. Unfinished features have no fake operations.
- [x] Add deterministic XPI/source identity, separate privileged/sandbox CSP, the 154.0 minimum, clean-profile installation guide and focused CI.
- [x] T: 8 focused tests pass, including cold status, profile preservation, bootstrap failures, rapid icon clicks and package/import integrity.
- [ ] B: finish the persistently installed Firefox journey below.
- [ ] Verify remote candidate/tree, checks, lightweight PR merge and resulting main.

## Evidence and recovery

T passes locally and on GitHub through `f2eb993257e0edb9c7ca7b1737303f782512ff5a`. Required B remains **NOT PASSED**; do not replace it with source checks.

| Observed failure | Recovery / evidence |
|---|---|
| Mozilla checksum parser unpacked every row as two fields; Firefox did not launch. | Exact-path/digest matching retained SHA-512 verification. Run `41214513710` downloaded and persistently installed Firefox 155.0b1. |
| Old CustomizableUI resource URL failed in the harness. | Use the current `moz-src:///browser/components/customizableui/CustomizableUI.sys.mjs` import. |
| Toolbar wrapper received trusted events but did not invoke the action. | Run `41215127877` showed registered shell listeners and wrapper events. Target the actual `.webextension-browser-action` child; run `41215249127` opened the dashboard. |
| Clean profile showed `CLEAN_PROFILE_REQUIRED`, rather than missing bridge. | Run `41215468856` recorded the exact status. The guard incorrectly rejected Firefox’s default containers. Remove that test for prior donor authority; preserve rejection of existing donor/local/sync data. Donor recovery still quarantines unmapped containers. Do not delete containers or clear data to pass. |

The generated module-entry package omits the unsupported MV3 `persistent` field. The cold status request waits for donor attachment instead of returning stale Starting. No historical research/test program was repeated. Connected Firefox MCP returned an internal error; CI uses a disposable home/profile with no installed bridge.

**Required B oracle:** Firefox version satisfies 154.0; persistent add-on is active and not temporary; normal sandbox preferences/environment; real toolbar button twice opens/focuses one dashboard; actual Settings navigation works; real process restart keeps the XPI and blocked missing-bridge startup; simulated existing donor bytes are rejected and preserved. Record browser/build, source and XPI SHA-256.

**Remote checkpoint:** [PR #1](https://github.com/Neb963/PCMS/pull/1). Git shell push has no credentials; use the connected GitHub integration. Earlier published code trees matched local staged trees.

**Next unresolved action:** Run `41215687178` passed first startup, both real icon clicks and Settings navigation after the default-container correction. Its real-process restart then observed no dashboard after the icon click. Add bounded icon-delivery diagnostics and inspect before/after startup state; do not bypass the failed toolbar oracle with direct navigation. Merge only after the unchanged P01 journey passes.

**Deferred:** H at P42 is **NOT TESTED** for the real native bridge, protected contexts and route capacity. No live Perchance/Git-provider or native route mutations occurred. This is an incomplete development XPI; module seed/workflows and durable Core records belong to later phases.

**Next eligible after verified P01:** P02 — Durable records and continuous Core recording. Stop after P01 in this chat.
