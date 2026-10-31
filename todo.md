# Current work

**P10 — Add Account through a protected Persona: implementation complete; required installed verification in progress.**

P01–P09 are merged. Main `4c032df91ca66d875462d9d69cd899ad5a377af8`, reviewed tree `1e02b5e13f062005ca82c895782750ea08ba87d0`, postmerge [41231683976](https://github.com/Neb963/PCMS/actions/runs/41231683976) T/B/DSK PASS. Current P10 [PR #10](https://github.com/Neb963/PCMS/pull/10), branch `p10-protected-enrollment`. The workspace interruption is resolved; exact remote state was restored before continuing.

## Implementation plan and current outcome

- Durable enrollment precedes donor setup. Finite Accounts jobs share the one queue; each setup/open/identity operation has a stable ID and exact readback. Unknown does not authorize replay. Pause, module generation and account revision gate admission; final Ready persistence checks module/job revision atomically.
- Private donor adapter adapts pinned Alpha/donor blocked-Persona, route selection/assignment/probe and protected-open primitives. Donor remains sole routing/native authority. Core account indexes reserve each canonical IP, Persona and principal, including archived records. Volatile pins start empty and gate both early/final donor network decisions. No Direct fallback or silent rebinding.
- Native human login remains separate. Confirm is durable before fresh route and authenticated principal observations. Required permission/current context/document are rechecked. Source keeps secrets inside the protected page. Changed principal, wrong container/document, missing bridge/permission and uncertain operations hold only the relevant account.
- Accounts 0.2.0 is an ordinary finite sandbox module. Actual list/detail/Add/Complete login/Confirm/Repair/Open/check controls, search/filter/paging, durable drafts/request IDs and observation times operate through Core. Existing installed packages/settings/jobs are preserved and require explicit compatible update.
- Reuse known donor research; no historical audit or live probe is repeated. Source authority remains accepted v42/design/PHASES; those files are unchanged.

## Evidence

Source `abc7cd28b82d1ab4f66a1d649fc4842198d1adae`, [41239867802](https://github.com/Neb963/PCMS/actions/runs/41239867802): **97 T/build PASS**. T covers canonical/archived uniqueness, interrupted setup/readback, post-Confirm freshness, wrong context/document, principal changes, quota before effects and Disable/permission/generation races at final admission. Native repair tests exercise the transformed protocol module and persist uncertain intent before IPC.

Required B is **NOT PASS yet**. The targeted installed job uses qualifying Firefox 155.0/build 20260817142839, normal sandbox 6 and certificate validation. A disposable native-protocol/authenticated SOCKS/HTTPS fixture never invokes the real bridge or forwards external sockets. The production XPI retains real endpoints and no fixture bypass. Its fixed catalog hostname alone resolves to the trusted loopback HTTPS fixture; port 443 is handled by the disposable CI server. Local content sandbox startup is unavailable (uid_map EPERM); no sandbox override was introduced.

- First installed [41239243574](https://github.com/Neb963/PCMS/actions/runs/41239243574) passed real Add/permission/missing-bridge checks, then the catalog interception fixture failed after Pause/restart. It was replaced by actual fixed-URL HTTPS; its independent trust/response smoke passes on an unprivileged local port.
- Second installed [41239867802](https://github.com/Neb963/PCMS/actions/runs/41239867802) reached real protected two-account setup, Pause/restart/resume, wrong-container refusal, rapid visible Confirm and one fresh authenticated read with post-Confirm times. It failed because the test clicked Open after Core became Ready but before the next UI poll made that control visible. The follow-up waits for the exact visible/enabled control; no disk/state/no-replay oracle is weakened.

## Next

Finish the installed Open Perchance and lost-native-prepare-response/process-restart/readback checks. Inspect actual artifacts on any failure; do not merge P10 until complete T/B. Then merge through PR #10, verify remote tree and postmerge main, write the actual P11 plan and continue automatically through all remaining safely eligible phases.

Live H/G/P1–P5 remain NOT TESTED and unauthorized. P42/P49 qualify the actual bridge/two accounts/capacity later. No account registration, credential entry automation or live provider/route mutation is authorized. This is a development checkpoint, not project readiness.

The complete installed journey passed at source `076b62b0b9feef9a7ee449df30cd603441cc9b76`, [41240164486](https://github.com/Neb963/PCMS/actions/runs/41240164486): real Open and a lost native prepare response recovered after process restart with one prepare and the same Persona/job. Final review then found two bounded compatibility/security edges: older Accounts records retain null packageClass after an explicit ZIP update, so ordinary Accounts authority now comes from its exact module ID/scoped capabilities (maintenance class privileges stay unchanged); Core pins are withdrawn throughout route re-verification until a fresh unique binding commits. Typed failed account operations also point to account recovery. Three focused regressions pass, and the final B adds legacy-null metadata to its same real workflow. A rebuilt final run remains required before merge; earlier PASS is not relabeled as evidence for changed code.

The rebuilt source `37d172a69ee61cbe3f2b07676117cf2a9fca8adc` passed the complete targeted T/B run [41240525464](https://github.com/Neb963/PCMS/actions/runs/41240525464), including legacy-null package metadata and route quarantine. A final focused terminal-job regression now proves that a failed identity/challenge job cannot be restarted through its old scoped callback; a distinct Confirm rechecks the same account. The Core policy and host reject that terminal callback. Run the changed final candidate, then record evidence/merge without expanding scope.
