# Current work

**Active phase:** P01 — Protected packaged host. Implementation and required T/B are verified. Merge/main verification is next. P02 has not started.

## Baseline and plan

GitHub main was `c3a066a60813e6b83e63978b79181593a6a76234`, with no other branch, PR or Actions run. The phase-specific plan was published before code in `2b12bd8842e2b74e43e7710d5206443534034bb6`. Work is in [PR #1](https://github.com/Neb963/PCMS/pull/1), branch `p01-protected-host`. Accepted v42, design revision 2 and phase contracts stay unchanged.

- [x] Vendor the exact pinned donor extension/LICENSE with blob hashes and MIT attribution. Preserve Gecko ID, native protocol and permissions. Apply small checked build transformations; exclude legacy UI/command dispatch and workflow startup.
- [x] Add the donor-first MV3 module entry and synchronous shell/wake listeners. Keep P01 admission blocked; no account or provider operation exists.
- [x] Add one dashboard, serialized icon open/focus, the seven ordered navigation entries and bounded startup diagnostics. Unfinished features have no fake operations.
- [x] Add deterministic XPI/source identity, separate privileged/sandbox CSP, the 154.0 minimum, clean-profile installation guide and focused CI.
- [x] T: 8 focused tests pass, including cold status, profile preservation, bootstrap failures, rapid icon clicks and package/import integrity.
- [x] B: complete the persistently installed Firefox journey below.
- [ ] Verify remote candidate/tree, checks, lightweight PR merge and resulting main.

## Evidence and recovery

T and B **PASS** in [run 41216380417](https://github.com/Neb963/PCMS/actions/runs/41216380417), source `05d00f4afa6835302b35a0e96c0a7b4ca92782d5`, clean build. All 8 focused tests pass. The downloaded installed receipt and UI screenshot were independently inspected.

- Browser: Developer Edition **155.0b1** (WebDriver version `155.0`), build **20260817142839**. Normal security configuration; sandbox level **6**, remote content enabled; no sandbox-disable environment.
- Persistent XPI: **209300 bytes**, SHA-256 `0cf0583f83d73afdba68c9d41ee13614b6df71b6bd429da07605bfc9cf40f65d`. The build identity and installed receipt match.
- Real toolbar button twice: one dashboard, preserved focus/route. Packaged Settings click: correct heading/current navigation. Real process exit/restart: persistent package and missing-bridge hold. Existing valid donor state and sentinel: exact pre/post equality under refused adoption.
- [Installed receipts/screenshot](https://github.com/Neb963/PCMS/actions/runs/41216380417/artifacts/13048351243); [tested XPI](https://github.com/Neb963/PCMS/actions/runs/41216380417/artifacts/13047762126). These are development artifacts, not a complete product.

| Observed failure | Recovery / evidence |
|---|---|
| Mozilla checksum parser unpacked every row as two fields; Firefox did not launch. | Exact-path/digest matching retained SHA-512 verification. Run `41214513710` downloaded and persistently installed Firefox 155.0b1. |
| Old CustomizableUI resource URL failed in the harness. | Use the current `moz-src:///browser/components/customizableui/CustomizableUI.sys.mjs` import. |
| Toolbar wrapper received trusted events but did not invoke the action. | Run `41215127877` showed registered shell listeners and wrapper events. Target the actual `.webextension-browser-action` child; run `41215249127` opened the dashboard. |
| Clean profile showed `CLEAN_PROFILE_REQUIRED`, rather than missing bridge. | Run `41215468856` recorded the exact status. The guard incorrectly rejected Firefox’s default containers. Remove that test for prior donor authority; preserve rejection of existing donor/local/sync data. Donor recovery still quarantines unmapped containers. Do not delete containers or clear data to pass. |

The generated module-entry package omits the unsupported MV3 `persistent` field. The cold status request waits for donor attachment instead of returning stale Starting. No historical research/test program was repeated. Connected Firefox MCP returned an internal error; CI uses a disposable home/profile with no installed bridge.

**Required B oracle:** Firefox version satisfies 154.0; persistent add-on is active and not temporary; normal sandbox preferences/environment; real toolbar button twice opens/focuses one dashboard; actual Settings navigation works; real process restart keeps the XPI and blocked missing-bridge startup; simulated existing donor bytes are rejected and preserved. Record browser/build, source and XPI SHA-256.

**Remote checkpoint:** [PR #1](https://github.com/Neb963/PCMS/pull/1). Git shell push has no credentials; use the connected GitHub integration. Passing source/tree `05d00f4afa6835302b35a0e96c0a7b4ca92782d5` / `bdd220c353fa660f412f94e8247c2a3a80beee71` matched the local checkout.

**Next unresolved action:** Verify the final documentation/whitespace checkpoint, merge PR #1, then check the resulting main commit/tree and its focused/installed run. No product behavior changed after the passing receipt above.

**Deferred:** H at P42 is **NOT TESTED** for the real native bridge, protected contexts and route capacity. No live Perchance/Git-provider or native route mutations occurred. This is an incomplete development XPI; module seed/workflows and durable Core records belong to later phases.

**Next eligible after verified P01:** P02 — Durable records and continuous Core recording. Stop after P01 in this chat.
