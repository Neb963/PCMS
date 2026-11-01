# Current implementation checkpoint

## P33 — Authentication bootstrap and restore validation

**Completed, merged and postmerge verified.** [PR #25](https://github.com/Neb963/PCMS/pull/25) merged as [`8fcedd2679fb35d3d2b6c452ed85767a799cdd6a`](https://github.com/Neb963/PCMS/commit/8fcedd2679fb35d3d2b6c452ed85767a799cdd6a), tree `98a6d5c60986164a3fa0f052f77ab807f0a01fd2`. Postmerge [run 41341388425](https://github.com/Neb963/PCMS/actions/runs/41341388425): **71 T/build + B/DSK PASS**, Firefox 155.0/build20260817142839/sandbox6, packaged XPI SHA-256 `cff811fae66b3e613b190f64289d982b17c35d9e0bd872bfb32e797384bb7928`. P32 dependency was merged and independently verified (main `a6deb8933bde0362b4127b8ada0ac954214bdd43`, [PR #24](https://github.com/Neb963/PCMS/pull/24), postmerge [41330799974](https://github.com/Neb963/PCMS/actions/runs/41330799974) PASS). P33's full phase-specific plan was recorded *before implementation* at [plan checkpoint `c542b673`](https://github.com/Neb963/PCMS/commit/c542b6734fc1861451e3de4d2180bc7cdc578110); actual bounded work and intermediate fault investigations remain in branch history.

### Delivered P33 boundary

- Integrates private, fixed `perchance-auth-1` one-use `document_start` restoration with fresh defaults and same-origin, exact tab/container + private-script registration/receipt. Rejects wrong container/copy/replay/current-session conflicts; keeps raw secrets out of URLs, public controls and diagnostics.
- Restores complete mapped cookie metadata and exact scoped authentication bytes, detects expired/rotated/missing values, checks current donor-protected route/exit and independent principal, and stages per-account login/route recovery without treating imported source exits as authority.
- Checks staged archive, account, blob, package and source/history closure before a recoverable active-cut switch. Preserves original cut, Pause, human contexts/drafts and existing held Possible effects; no automatic replay of restored Git/DEVELOP/provider work.
- Rebuilds same enabled/disabled module packages, website script authority and background admission; separately reports archive/local extension data/login/route/work/Git status and actionable account recovery through the one dashboard.
- Holds existing mutable uncertainty before allocation. Fixed read-only navigate reconciliation race in the *installed-test observer*: a first transient HELD is not terminal; a stable HELD, failure or overall timeout still fails. No security gate or test assertion was disabled.

### Exact verification

The postmerge run repeated the production File/UI/same- and fresh-profile valid/rejected-session oracle against the merged source and passed. The original PR branch source and artifact evidence below remain traceable.

[PR focused and installed Actions `41340910691`](https://github.com/Neb963/PCMS/actions/runs/41340910691) for source [`701b94f76c2bc181054814a62e82639d684f2ee8`](https://github.com/Neb963/PCMS/commit/701b94f76c2bc181054814a62e82639d684f2ee8): **71 T tests PASS, build PASS, required B/DSK PASS**. Built XPI SHA-256 `85dc4f962192d838a5d078daad47f8876d2a7cce863e6fba17fb1866b1498502`, Firefox **155.0**, build **20260817142839**, normal content sandbox **6**. Real packaged Settings/File/production ZIP + independent disk oracle: same-profile unknown existing writer held before changing donor state; fresh-profile valid and rejected sessions each activate only a checked cut with exact NUL/Unicode auth before earliest fixture script, cookie attributes, fresh Persona map, binary/history/draft, package Disable, Pause, old Possible source job held, one-use script unregistered and unrelated data untouched. Rejected session `Complete login` / `Confirm` recovered same mapped Persona with fresh independent identity, no source replay. Reused independent private-bootstrap boundary [`41333644342`](https://github.com/Neb963/PCMS/actions/runs/41333644342) PASS.

Earlier installed failures were real observations, not PASS: `41338978898` encountered transient navigation POSSIBLE/HELD; `41340242029` independently showed that exact operation became OBSERVED and the protected page loaded; `41340556946` proved the first successful fresh activation but hit test-only `KeyError: 'rev'` for a hidden projected field. Final `41340910691` passed *both* fresh-profile journeys without relaxing production behavior.

### Holds, scope and next eligible work

**P19 remains held** by missing qualified provider source revision/precondition recipe; descendants P20–27/P35/P37/P38 are not admitted by speculative fingerprints. **G/H/P1–P5 live checks NOT TESTED / not authorized**; P48 operational login/route portability is not established by local fixture bytes. No live Perchance, Git write or real Mullvad mutation performed. Existing package installations need explicit compatible Backup/host update, not silent reseed.

**Stop after P33.** Next dependency-eligible phase is **P34 — Automatic Backup and restart completion**; **P36** is independently eligible. Neither is implemented in this chat.
