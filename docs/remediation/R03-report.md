# R03 — automatic protection-evidence renewal

Date: 2026-11-02. Base R02 `cd6ed32c69afcae029148fdddca8e44a2b091e1f` / tree `16e5032cc274c81e21db5b0045cb7fb95f992726`. Authorities unchanged. Plan committed before R03 code.

**Status: FIXED_VERIFIED at T + installed local B/DSK oncd638db8. Final R08/vision remains open; real H NOT TESTED.**

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

## R08 missing-context integration repair

Run41516312430/source7c4f426b shows cold route renewal succeeds, while Creator and source/publication recovery lack a live protected account context. Route freshness and context availability are separate prerequisites. The existing Accounts ensureProtection now accepts a context requirement. With a current route and missing/stale document it queues the existing OPEN→identity workflow once; unknown account effects retain original reconciliation. It creates no Persona/route, never silently rebinds a principal, and does not reopen on ordinary route-only renewal. Duplicate requests and changed-principal refusal pass production tests. Source readback uses this prerequisite through its existing callback. Required matching B is pending.

Run353/source6e20c48/XPIe27dd12c79b7c90c0442aa240f1f1e7dae83fe3d9715ffa18e07b1781faa1d06 passes actual Creator lost-CREATE/lost-RENAME cold recovery, full DEPLOY and DEVELOP cold source/publication recovery, and Refresher restart/readback. This verifies those specific context-recovery paths with original operation identities. It does not close the installed TTL boundary/native-outage/two-account proof matrix. Current354 onfcf4c587 has Creator/DEPLOY failures awaiting original receipts; no current-artifact PASS is inferred from353.

## Installed negative-matrix continuation (prepared; B NOT TESTED)

The complete accepted authorities/remediation package were reread3November.356's real-hour receipt records two distinct local enrolled accounts and real autonomous renewals during its running portion; global Pause later prevents new account work, so no claim that an hour of READY records means continuously fresh donor proof. Exact TTL boundary/negative installed coverage stays open.

Prepared tests/installed_route_recovery.py for two real UI enrollments and post-Confirm identities; actual Firefox process restarts invalidate donor proof. A disposable native outage must create explicit holds and recover automatically on real deadlines without Repair/Verify clicks. A per-route leaking DNS response must block only that account, preserve its tuple, and leave the other account usable; the real contextual Repair must obtain fresh proof. Changed login identity must hold without rebinding. Default Journal disk export must retain original causes and exclude session tokens. No time/cache/protection mutation, provider source write, real bridge use or live acceptance. Workflow wiring and strict Python syntax pass; installed execution/receipts are pending. Preserve current357 head while it runs; publish this supporting test checkpoint separately, then integrate only with remaining demonstrated corrections.

Supporting presentation correction: the known DNS_LEAK_DETECTED code previously fell through to raw protocol text. Accounts now names the DNS protection failure and its contextual route repair, retaining the original Core/Journal code and all admission checks. Source syntax only; matching installed error pixels remain pending.

## R08 independently reproduced cold Repair context gap

While358's route-negative receipt is pending, a separate production finite-flow regression reproduces an enrolled cold DNS Repair stopping with ACCOUNT_LOGIN_TAB_MISSING after only VERIFY. REPAIR selected IDENTITY directly although the browser document had been lost. This is a proven source-fixture defect, not yet attribution of358.

For an already enrolled explicit REPAIR only, VERIFY now advances to the existing protected OPEN, then fresh authenticated IDENTITY. Ordinary RENEW still opens no tab and performs no identity read. The new regression covers unchanged and changed principals, one OPEN, unchanged Persona/container/route/exit/principal, no CREATE or CREATE_ROUTE replay. Before the fix the unchanged case failed with {code:ACCOUNT_LOGIN_TAB_MISSING,calls:[VERIFY]}; after it,28 Accounts/donor/observation T PASS/3.207s, syntax/whitespace PASS. No native protocol/TTL/proof or admission guard changes. Required matching installed B remains pending.

## Exact358 diagnosis and prepared complete negatives

Artifact13225424798/ZIP46ed18a09d181f03f6ecc1fe11d3b20923b5fdf17ef3891821fd6121e356f8c6 independently reopens342 entries on sourcea775e392/XPI3514adb5. Route receipt677d3ab647307a54361dc4d45f3d543fd9b9bd3f97d128f6a72a1a270c5586a7 proves two UI-confirmed distinct tuples, actual process restart, typed native outage holds MULLVAD_LOCAL_SERVICE_UNAVAILABLE and automatic real-deadline recovery without Repair/Verify/new containers. A second restart obtains one-account DNS_LEAK_DETECTED while the other is freshly READY; original pixels record that hold. Explicit Repair verifies the route, then IDENTITY holds ACCOUNT_CONTEXT_CHANGED against the stale tab. This corroborates the independently reproduced cold context gap;0c0a56e uses protected OPEN before identity. Both missing and wrong-context document negatives and changed-principal refusal pass T.

The actual donor function now has explicit899/900/901-second, future and changed route/security context tests; the900000ms TTL is unchanged. Prepared installed additions independently return missing DNS evidence, unknown IPv6, and an exit equal to the other account’s IPv4; require isolated original-code holds, unchanged tuples, contextual fresh-proof recovery and ordinary Journal disk causes. Added stage names and immediate workflow receipt upload support exact diagnosis.38 focused account/donor/observation/UI T PASS/5.530s; Python syntax/fixture-response/import/scope smoke PASS, not B. Matching extended installed B remains required; real H stays NOT TESTED.

## Matching359 installed matrix PASS

Sourcecd638db81b6ec99418d65c68906483e469b36d61/treee1ae4b97f7b0edd7b275e3b06fefea15f53c254d, exact XPId24e4d3f2fbcae73143661b8e79fbcec3b8d6bf02ddd6c633f111f7678f49fd4/909455bytes. [Run359](https://github.com/Neb963/PCMS/actions/runs/41628069043) focused288T PASS/69.246s. Immediate route artifact13227321144 ZIP62dac76f2068c54e35ec08975fe8a66cebf2779f8874a5625c637800b18be141 independently CRC-reopens2 files; route receipt2b33066f0e0a26386b53185317ad2333ed2596788a0b58c00ae892f374fb36f8 is PASS and matches source/XPI. Candidate13225889865 ZIP5ccc4821dec9c6566b5b2126798089894ca4820e0f208c28aae9b2f601f09e3e independently CRC-reopens to the clean local XPI byte-for-byte.

All seven route assertions pass: two real confirmed distinct identities/containers/exits; actual process restart and native outage holds followed by automatic deadline recovery without Repair/Verify/new tuple; isolated leaking DNS; missing DNS; unknown IPv6; changed exit equal to the other account’s IPv4; explicit contextual fresh-proof Repair and changed-principal refusal without rebinding. Default Journal’s actual disk reopen passes CRC/range/hashes for sequences1–561, SHAca4d31a6c447ee71c7faf2a77d300481aaa236b5c55923e2f5a546caefe2786e, retaining MULLVAD_LOCAL_SERVICE_UNAVAILABLE/DNS_LEAK_DETECTED/ACCOUNT_IPV6_UNVERIFIED/ACCOUNT_EXIT_CHANGED/ACCOUNT_PRINCIPAL_CHANGED and no session token.18 real state screenshots and6 Tab audits are recorded; pixels are not in the small immediate artifact and still require final V. Source TTL/future/context/unknown-operation tests retain their stated T scope. This closes the changed local R03 recovery/negative gates, not real-host H or overall release qualification.

The same complete7-assertion local route B/DSK matrix passes360 on final-in-progress d1524a22/XPIf94d48ba. Independently reopened immediate13229102835/ZIPd2ab2510517ca4f0cf3cc65c41021c2efd420661737c512fa853ba39ed89f8aa yields receiptb7f403de570015babd7aa840eb2c171f3d4015e4a8158c18c80203aac4f91e89, Journal1–564/SHA514d5340451c06ce2a9eaaf8b6e5562e7efcfb582bb6f3a2fd5ca443bd1c4c36 with all expected original safe causes. Final state images/V and overall360 completion remain pending; real H unchanged NOT TESTED.


361 repeated exact R03 B/DSK PASS: source924480d0cec80cdec6b77a9cfe5dbeebe5715098 / XPI875962d0153edd91910c389ae6917e7f519bfc6dc0d3e736a36402a2ce5ab7c3. Immediate artifact13233158641/ZIP421b436987167a91399c4bc34994b97883445ce0dbebbf754e21adbbe4fa93e0 independently CRC-reopens2 entries; receipt6aed9febf112406896c53ee8c108fe455752dc168175d65ac98623c5510b5fd9 matches candidate identity and all7 outage/DNS/IPv6/changed-exit/principal/default-disk assertions. Six real Tab audits pass. Original causal Journal1–562/SHA719f198835be6f8f8d73de284c09b2f2104427dee1ec51c1be74fec68e76e5d0 retains native/DNS/IPv6/exit/principal codes and no session tokens. No new Persona/route, Direct fallback or silent principal adoption; final V/full-chain gate remains open.


362 repeated exact R03 B/DSK PASS: source0b978844d3fcb2968143f24ccbbde7e8e304ff34/XPIe33afe09fe868b9619afb055734c01f43764d7ee53e8f975bd02b5085f826b9d. Immediate13236532323/ZIP7eae705319e25c96d0ec69bebc2cc2a2516feb1723da5d727cde9802cd66d124 independently CRC-reopens2 entries, receipt09ebdd5d22e4d2250914c18ee3690770f9d0ec315bf2e509b921e2e863984590 matches all7 actual outage/DNS/IPv6/exit/principal/default-disk assertions and6 Tab audits. Default Journal1–563/SHA4470d3b56f29e22bb49c1c7938d4104de5d760e091538efa8c54358b8e095c3c retains original causes/no session tokens. Final same-artifact V/full chain remains open; no live acceptance claim.
