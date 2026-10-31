# Current work

**P01 — Protected packaged host: COMPLETE.** Merged through [PR #1](https://github.com/Neb963/PCMS/pull/1). No P01 hold remains. **P02 is next and has not started.**

## Completed plan

- [x] Inspect actual main/branches/PRs/CI. Initial main was `c3a066a60813e6b83e63978b79181593a6a76234`, with no implementation checkpoint. Publish the actual phase plan before code: `2b12bd8842e2b74e43e7710d5206443534034bb6`.
- [x] Integrate pinned donor extension/LICENSE, exact blob provenance, retained Gecko ID/native protocol/permissions and explicit build-copy transformations. Original vendor bytes stay unchanged. Retire legacy UI/command dispatch and workflow startup.
- [x] Add synchronous donor-first MV3 entry, blocked startup/profile diagnostics, one icon-focused dashboard and seven ordered navigation entries. No fake provider operations.
- [x] Add deterministic development XPI/source identity, Firefox 154.0 minimum, separate privileged/sandbox CSP and clean-profile installation guide.
- [x] Pass 8 focused T checks and the required persistent installed B journey. Inspect the downloaded UI screenshot/receipts.
- [x] Publish checkpoints, verify remote commit/tree, squash merge PR #1 and verify resulting main with both CI jobs passing. Keep accepted specification/design/phase contracts unchanged.

## Accepted evidence

**Postmerge source:** [`e5bb8f4c8aafb420b1ab68fc9a42f95f4b197df8`](https://github.com/Neb963/PCMS/commit/e5bb8f4c8aafb420b1ab68fc9a42f95f4b197df8). Its tree `305b5aa0bfe403f9f1426c1844ad87c3679c406b` equals the verified PR candidate tree. Local main matched remote.

[Main CI run 41216717693](https://github.com/Neb963/PCMS/actions/runs/41216717693): **focused PASS; installed PASS**. Final PR candidate also passed run `41216593467`. This final handoff update changes documentation only; production, harness and CI files remain the verified merge version.

| Tier | Observed result |
|---|---|
| T | 8 focused tests pass: rapid icon clicks/recovery, exact sender checks and synchronous listeners, profile/data preservation, blocked bootstrap/native/permission outcomes, real donor gate failure, artifact/import/CSP/permission integrity, checked transformation anchors and cold status settlement. |
| B | Persistent active XPI, not temporary. Real toolbar button twice opens/focuses exactly one dashboard. Actual Settings click changes route/current navigation. Real process exit/restart retains the XPI and missing-bridge hold. Valid existing donor state and a sentinel are rejected for adoption and preserved exactly. |
| Environment | Developer Edition **155.0b1**; WebDriver version `155.0`, build **20260817142839**. Normal sandbox level **6**, remote content enabled, no sandbox-disable environment. Dedicated disposable home/profile; no native host or provider session. Harness waits for native add-on startup before clicking, including a dormant event page, without forcing wake. |
| Artifact | Clean source above; **209300 bytes**; XPI SHA-256 `13e212f48ec99e7ba898df4d69b4fbc55a0ed916beed97884a59942deb5f8bdf`. Build identity and installed receipt match. |

[Postmerge installed receipts/screenshot](https://github.com/Neb963/PCMS/actions/runs/41216717693/artifacts/13048851370) · [tested development XPI](https://github.com/Neb963/PCMS/actions/runs/41216717693/artifacts/13048317667).

## Resolved verification failures

- Checksum manifest parsing failed before launch (`41214431538`); exact archive-path/digest matching kept SHA-512 verification.
- The old Firefox CustomizableUI URL failed; the harness now uses the current native module. An outer toolbar wrapper received trusted events without invoking the actual button (`41215127877`); target its `.webextension-browser-action` child.
- The initial profile guard rejected Firefox’s default containers (`41215468856`). Existing donor/local/sync authority still blocks adoption; donor recovery quarantines unmapped containers. No data was cleared.
- WebDriver returned while native add-on startup was still `starting`, and the icon listener received no event (`41215955311`). Wait for native startup completion before actual interaction; keep real restart/tab/effect assertions.
- A malformed previous-install fixture correctly triggered donor security rollback (`41216186356`). The corrected fixture uses valid existing donor state and exact pre/post equality, without changing donor protection.
- A cold status request could precede donor attachment; a bounded wait and focused failure/attachment test prevent stale Starting.

These were resolved within P01. See [learned.md](learned.md). Historical research/41-test/feasibility programs were not rerun. Shell Git push lacked credentials, so checkpoints used the connected GitHub integration. Connected Firefox MCP returned an internal error; required installed checks ran in CI.

## Remaining scope and next work

H/working native bridge, protected contexts and route capacity are **NOT TESTED**, scheduled at P42. No live Perchance/Git-provider or native route mutation occurred. This XPI is an incomplete development host; module seed/workflows and durable Core records belong to later phases.

**Next eligible:** [P02 — Durable records and continuous Core recording](PHASES.md#p02--durable-records-and-continuous-core-recording). The next task must inspect current main and write its actual phase-specific plan before implementation. No P02 code or plan was started here.
