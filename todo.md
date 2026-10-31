# Current work

**Active phase:** P01 — Protected packaged host. No other phase is in scope.

## Repository baseline

- Inspected GitHub on 31 October 2026: `main` is `c3a066a60813e6b83e63978b79181593a6a76234`; only `main` exists; no PRs or Actions runs. Local checkout matches. No unfinished phase exists.
- Read accepted v42, design revision 2, AGENTS, phase contracts and CI guidance. Authority files stay unchanged.
- Reuse Alpha `c5b23b77f50db7ffe50e2ef705a8bf0b5879e36e` and its pinned donor `9995f6eadfa54be6cc0001f4e04f2a2d9b9401bf`. Read only relevant bootstrap/build sources. Do not rerun the historical audit or 41-test baseline.

## Implementation plan

- [x] Inspect repository/checkpoints and select dependency-ready P01.
- [x] Vendor the exact pinned donor with MIT attribution and reproducible hashes. Extract the proven Alpha bootstrap repairs as small, checked build transformations. Preserve native protocol, permissions and `persona-route-manager@local`; exclude legacy UI/controllers from the operating host.
- [x] Add one packaged MV3 event page. Import fail-closed protection before PCMS initialization; register shell/wake listeners synchronously. Keep admission blocked for missing permission/bridge or bootstrap failure. No provider actions exist in P01.
- [x] Add the toolbar handler and one dashboard, with Home · Generators · Accounts · Refresher · Work · Other · Settings. Serialize rapid icon clicks; focus the existing dashboard. Show honest startup diagnostics and unfinished areas without fake operations.
- [x] Build a deterministic development XPI with `strict_min_version: 154.0`, separate privileged/sandbox CSP, no popup and source/XPI identity receipt. Add a short clean-profile installation guide.
- [x] Add focused T checks for bootstrap ordering/failure, duplicate icon clicks, package identity, attribution, permissions and transformations; add fast CI and only the required installed P01 journey.
- [ ] B: persistently install the built XPI in a dedicated clean profile on a qualifying Firefox build with normal sandbox. Click the real toolbar icon twice; independently count/focus dashboard tabs. Verify blocked cold startup without a bridge. Record browser/build, source commit and XPI SHA-256. Unsupported browser or environmental failure remains an explicit hold.
- [ ] Push meaningful checkpoints with this file; verify remote commit/tree, PR checks and resulting main after merge when required evidence passes.

## Evidence and holds

- T: **PASS**, all 7 focused tests locally and on GitHub at `8a14f0530285a59312a31a84d1ef80034c342570`. Vendor bytes, complete import graph, syntax and deterministic XPI checks pass.
- B: **NOT TESTED**. Initial CI run `41214431538` failed before Firefox launch: the Mozilla checksum parser assumed every manifest row had exactly two whitespace fields. Match the exact archive path and first digest field; retain the SHA-512 comparison. Parser repair succeeded. Run `41214513710` installed the XPI persistently on Firefox 155.0b1 with normal sandbox preferences, then failed in the harness at the retired CustomizableUI module URL before the icon click. Use Firefox’s current `moz-src:///browser/components/customizableui/CustomizableUI.sys.mjs` path; keep actual WebDriver toolbar clicks. Code review also found a cold-click status race; wait for the finite donor attachment result and clear a recovered toolbar error.
- Connected Firefox information request returned MCP internal error before any browser operation. Use a clean local/CI Firefox environment if available; do not modify an existing user profile.
- H: **NOT TESTED**, deferred to P42 for working bridge/protected contexts. No live provider or native route mutation is in scope.
- This is an incomplete development checkpoint. Module seed/workflows and durable Core records belong to later phases.

**Remote checkpoint:** Plan commit `2b12bd8842e2b74e43e7710d5206443534034bb6`, [PR #1](https://github.com/Neb963/PCMS/pull/1). Shell Git push lacked credentials; use the connected GitHub integration.

**Next unresolved action:** Publish the checksum parser repair and inspect the required installed P01 journey. Remote code `8a14f0530285a59312a31a84d1ef80034c342570` / tree `870296786c32ea302381a87b729856b05bf3e4b4` matched the local staged tree. Installed evidence remains pending.

**Next eligible phase after verified P01:** P02 — Durable records and continuous Core recording. Do not start it in this chat.
