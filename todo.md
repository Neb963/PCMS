# Current work

**P11 — Account lifecycle and contextual recovery: queue/policy/local-removal implementation checkpoint.**

P01–P10 are merged. P10 [PR #10](https://github.com/Neb963/PCMS/pull/10), main `2cbcba46b681af2ad9dba15e56b7a24fbab72734`, exact reviewed tree `49e6fa332d4296294612bc08bf8d45323f4c3bdf`. Final source `2350530dc148b38ae01fba92d7b1789dcd305f8c`: 101 T/build and complete B PASS [41240772320](https://github.com/Neb963/PCMS/actions/runs/41240772320), XPI `6de93c0fdb364905fc95af2cdbc2f29614a4697e1abbbf0d9c4d48cb8c06bdfc`; postmerge [41241078106](https://github.com/Neb963/PCMS/actions/runs/41241078106) PASS. Firefox155.0/build20260817142839, normal sandbox6.

## P11 implementation plan

1. Extend the existing Core queue with synchronous per-account admission fences plus durable account admission checks at selection, writer claim and dispatch. Archive stops new effects immediately, preserves in-flight uncertainty and human tabs/session/source, and retains principal/exit reservations. Do not use donor Archive because its tab-closing behavior would destroy open work.
2. Add durable Accounts lifecycle commands and finite removal stages in the existing module/queue. Reactivate freshly verifies route/identity and reconciles held work before ordinary admission. Unresolved work remains held. Missing login/challenge/principal change receives contextual login/repair; other accounts continue.
3. Confirm local Remove once with a stable request ID, then drain active calls, remove the exact owned Persona/container/session through the existing donor service and independently read back absence. A lost removal reply authorizes readback only. Resume only known-unfinished local steps after restart. No bridge changes, route-controller duplication or remote generator calls.
4. Add a narrow Core removal transaction: delete account-local credentials and account record/history, retain secret-safe unresolved job tombstones and owner-missing generator/source history without reassignment. Preserve Git credentials, unrelated accounts, source bytes, events and remote inventory. Remove requires no usable deleted credentials.
5. Deliver actual Archive/Reactivate/Remove controls, concise local-only confirmation, saved removal progress, affected job/generator count links and honest observation times. Keep search/selection stable. Bump the finite Accounts package; preserve existing selected packages/settings.
6. T exercises archive/dispatch races, reserved bindings, fresh reactivation, interrupted/lost-reply removal and exact local deletion scope. Reuse P10's real native/HTTPS fixture and qualifying installed setup; select one P11 B journey for each control, denied/remembered confirmation, process restart during partial removal, independent remote inventory/source preservation and another usable account. Keep normal sandbox/CSP. Run required focused/build and changed B before merge, verify remote trees and postmerge main.

## Next

Queue selection/claim/dispatch now use synchronous and durable account admission fences. Finite Archive/Reactivate/confirmed Remove, donor exact local deletion/readback and scoped Core cleanup are implemented. 30 focused account/queue/donor tests PASS, including slow identity Archive, intent-to-call fencing, fresh Reactivate, lost local reply/reopen, unresolved tombstones and preserved source/other secrets. UI and required B remain OPEN. Next deliver lifecycle controls/count links and the targeted installed recovery journey. After verified merge, automatically plan P12 from actual main. All later safe dependency-eligible phases remain in scope.

H/G/P1–P5 remain NOT TESTED and unauthorized. P42/P48 qualify real route/login/remove behavior; fixtures do not substitute for live acceptance. No new live provider, native host or Git operation is authorized.
