# Current work

**P12 — GitHub connection and incremental catalog: implemented and verified; ready to merge.**

P01–P11 are merged. Main `295d9c9e236df68843d4ac9a8fae3b7719795dfb`; P11 postmerge [41243001968](https://github.com/Neb963/PCMS/actions/runs/41243001968) T/B PASS. P12 [PR #12](https://github.com/Neb963/PCMS/pull/12), branch `p12-git-catalog`.

## Outcome and evidence

One private Core Git reader configures repository/main and credential-isolated read access. Strict PCMS-1 declarations produce folder-only generator records, including missing/malformed markers and external DONE-unverified. Finite saved cursors, verified immutable Git tree/blob bytes, changed subtrees, conditional ref reads and Retry-After backoff preserve previous complete observations across interruption and failure. Complete moves/missing folders retain account/remote/source/job history without reassignment. Actual Connections Save/Reconnect and Generators search/filter/paging/detail controls preserve input/selection. No Git writes or inferred write permission.

Source `33f866a63e19d67c84b7a548c5d60a26bf340e28`, tree `047c8eafc60f770a283b64bfcecb45e18f73be29`, [41244199225](https://github.com/Neb963/PCMS/actions/runs/41244199225): **117 T/build, S and complete B PASS**. XPI SHA-256 `911b7fc8126ded8da1a6600b65d4b7f81e09ee42b9f2bf77e4f1bb27ec289288`. Firefox155.0/build20260817142839, normal sandbox6, normal certificate validation.

T/S covers strict UTF-8/order/case/newlines, independent Git-object integrity, malformed/missing/DONE markers, recursive truncation fallback, saved traversal/reopen, auth/missing-main/rate holds, safe moves and1,101 folders across all pages. Local measured S traversal8.6s; unchanged main makes exactly one conditional ref request and reads no folder inputs; one changed subtree reads one new marker.

B clicked real Save with denied then valid token, retained failed input and never returned the token. It interrupted a truncated63-folder traversal, restarted the real process and completed with the dashboard closed before reopen. It independently matched the full folder set, actual50+13 pages, search/filter/error details, Reconnect with no unchanged input reads, auth-failure preservation and unsaved repository draft. All81 fixture requests were GET. Production URLs remain fixed; only disposable-profile DNS/trust map HTTPS to loopback, without a shipped fixture endpoint or bypass. No native host or provider operation was performed. Earlier donor/account/Journal evidence is unchanged and reused.

## Next

Publish evidence, merge PR #12, verify exact remote main tree and postmerge focused/installed success. Then write P13's actual plan before implementation: scoped conditional Git objects/ref writes, per-call Pause, exact path/precondition preservation and same-operation lost-ACK reconciliation. Continue automatically through all remaining safely eligible phases.

G/H/P1–P5 remain NOT TESTED and unauthorized. P43 qualifies actual Git permissions/history before real writes. Fixture read access cannot establish real write access, live/full acceptance or overall project readiness.
