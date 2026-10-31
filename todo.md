# Current work

**P11 — Account lifecycle and contextual recovery: implemented and verified; ready to merge.**

P01–P10 are merged. Main `2cbcba46b681af2ad9dba15e56b7a24fbab72734`; P10 postmerge [41241078106](https://github.com/Neb963/PCMS/actions/runs/41241078106) PASS. P11 [PR #11](https://github.com/Neb963/PCMS/pull/11), branch `p11-account-lifecycle`.

## Outcome and evidence

Archive uses synchronous account fences/epochs plus durable Core admission at selection/claim/dispatch. It preserves tabs/session/binding reservations and existing review/challenge holds. Reactivate freshly verifies route/identity, reconciles safe work and keeps unresolved effects held. Confirmed local Remove durably closes exact protected tabs, then removes the owned Persona/container/session, then atomically removes account-local credentials/snapshots and records completion. Every possible destructive effect requires same-operation readback. Generator/source history stays owner-missing without reassignment; unresolved jobs retain safe attribution, with old input/command snapshots removed. Unrelated accounts/Git credentials remain usable.

Accounts 0.3.0 provides real Archive/Reactivate/Remove/confirm/cancel/check controls, count links and filtered account work/generators. Saved request IDs and confirmation survive interruption. Open reuses an exact tagged tab, or opens the missing protected context once after route verification, waits boundedly for its document and checks current identity before Ready. Wrong-container Confirm still rejects.

Final source `21c3eb696fd646dcc8ad38b30bbec2a456af471f`, tree `7c4158644f96a0b56562b0319e7555c476af85ae`, [41242824226](https://github.com/Neb963/PCMS/actions/runs/41242824226): **110 T/build and complete B PASS**. XPI SHA-256 `2ef97ea1c34ec7ff9498e3579aa2778bc3a8243fabf01acd8705f230718319ea`. Firefox 155.0/build 20260817142839, normal sandbox6/certificate validation.

B clicked Archive/fresh Reactivate/count links, denied Remove, then confirmed once. It independently observed exact tab/container deletion, injected quota only in final local cleanup, restarted the real Firefox process, and verified the same removal job completed without another confirmation. Local previous-good/binary source and remote fixture inventory/source stayed exact; owner-missing history, other-account/Git secrets and a distinct completed other-account Open were verified. Fixture native/SOCKS/HTTPS services never invoke the real host or forward external sockets. Earlier failures exposed real tab-closure and closed-tab recovery defects; their final fixes are covered by this rebuilt run. P10 unchanged boundaries retain their original evidence in PR #10.

## Next

Publish evidence, merge PR #11, verify exact remote main tree and postmerge T/B. Then write P12's implementation plan from actual main before code: credential-isolated Git connection, strict marker parser, incremental complete catalog with saved traversal, actual Connections/Generators controls and T/B/S. Continue automatically through all remaining safely eligible phases.

H/G/P1–P5 remain NOT TESTED and unauthorized. P42/P48 qualify actual host/login/removal behavior. No live provider, native host or external Git target operation was performed. Overall project readiness is not claimed.
