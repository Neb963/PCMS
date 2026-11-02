# R03 — automatic protection-evidence renewal

Date: 2026-11-02. Base R02 `cd6ed32c69afcae029148fdddca8e44a2b091e1f` / tree `16e5032cc274c81e21db5b0045cb7fb95f992726`. Authorities unchanged. Plan committed before R03 code.

**Status: FIXED_PENDING_B / PARTIAL. No live H claim.**

## Root causes and changes

IC-01/03 and route-side IE-01/03 were confirmed: READY enrollment persisted beyond donor proof expiry and cold restart, with no renewal deadline. IC-02's attribution to the historical PREPARE remains inference; the old receipt is unavailable. The existing donor TTL/guards are unchanged.

The private donor adapter now exposes read-only PROTECTION observation. Accounts uses its existing finite queue flow with an internal RENEW purpose: verify the same Persona/container/route and unchanged exit binding, then return to enrolled READY. It does not create/select a Persona/route, open another login tab, or update the login identity time. Current proof is observed from donor, never synthesized from persisted READY. Normal human sign-in/Confirm remain required.

Startup, wake, Resume and Core deadlines maintain protection. Renewal begins at 14 minutes (stricter than the unchanged 15-minute donor expiry). The per-account serial gate and saved flow deduplicate renewal. Known transient route failures back off (bounded to 30 minutes); unresolved effects retain the same operation and only read back. Identity/exit/DNS/IPv6 failures do not gain a bypass. Account list route state now distinguishes current boot-scoped proof from old login history. Source recovery requests protection rather than opening another routine tab.

A focused regression found an existing numeric DOMException.code path in Accounts' catch. It now uses typed publicError classification, preserving actual quota causes and preventing an unsafe numeric event code.

## Verification

`node --test tests/accounts.test.mjs tests/donor-accounts.test.mjs tests/account-observations.test.mjs tests/source-writer.test.mjs`: **56 PASS**. New tests exercise stale/cold renewal, two simultaneous ensure calls (one renewal job), same tuple, no additional CREATE/CREATE_ROUTE/OPEN, unchanged identity timestamp, known failure/backoff/recovery and unknown same-operation readback/no native replay. Existing production adapter, strict canonical exits, pins withdrawn during verification, wrong identity/container, permission/quota, archive/removal, source races and no-replay checks pass.

Installed TTL boundaries/native mock/outage/process restart on the matching XPI are NOT TESTED. Local Firefox normal sandbox is blocked as in R01. Real donor H/P42–P49 stays NOT TESTED. R01 matching CI41506387916 has now passed all configured focused/installed steps; its scope is not expanded to these new R03 changes.

## Safety / remaining work

One Core queue; no route controller/native protocol/allowlist change. No Direct fallback, no TTL extension, no exit reassignment and no uncertain write replay. Archive, module, Pause and restore fences still govern dispatch. Required installed evidence and actual provider principal mismatch/recovery matrix remain open. R04 must connect safe Creator holds to this renewed proof and expose dependent causes; R06/R08 must verify UI and final pixels. Publication/source/live acceptance is not inferred.

Observed B: CI41512200622/sourcebef12ba9/XPI87ac1cf4b0afef3cdb6e0d7d0bac01df4e0a80b11a799503046c5a1836be7f00, installed-ui-continuity.json PASS with AUTO_RENEW_VERIFIED after real Firefox death/restart and preserved source draft. This closes that specific cold renewal path, not TTL/outage/two-account/full matrix. Strict helper now waits for automatic renewal without racing a manual Open.
