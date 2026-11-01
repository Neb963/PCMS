# Current work

**P16 — Owner adoption and durable allocation: planned from verified main.**

P01–P15 are merged. P15 [PR #15](https://github.com/Neb963/PCMS/pull/15), main `ab3c679a76c27fc206ee0446e832890a3406248d`, exact tree `76e968bc55367426e6d036eff2c73d32011951a7`; postmerge [41291121005](https://github.com/Neb963/PCMS/actions/runs/41291121005) PASS. Final P15 source255bf35c passed159 T/build and required actual Discover→Git B in41252948395, XPI759a778741e7d544ee4145c050447104fc4d10c6e8b831305d7726ee22cb0450.

## P16 implementation plan

1. Implement Creator0.2 finite steps over the existing Core records/queue. The existing Git observer automatically admits each current valid folder regardless of NOT_READY/READY; preserve source/listing/history and one durable job per target. No provider creation yet and no manual Start panel.
2. Add a fixed read-only targeted ownership operation through the existing donor-protected, currently verified account/container/document. Reuse pinned Alpha ownership/page-read primitives without its old negative-ownership creation veto. Return only exact principal/stable remote ID/slug/listing evidence. Keep tokens/source/response text inside the page. Existing login/editor contexts are observed without navigation or edits.
3. Examine managed accounts in bounded sequential queue turns with a small affirmative evidence cache. Missing context, unavailable account or incomplete response is Unknown for that account. Adopt one affirmative matching managed owner without mapping conflict or source/listing change. Conflicting owners/IDs and positively established foreign ownership hold only this target. Absence of affirmative ownership permits local allocation; P17 separately requires fresh Available before any creation.
4. Add narrow atomic Core data operations for adoption/reservation/override. Count confirmed ownership plus all pending reservations once, retain archived reservations and select the minimum eligible nonarchived Ready account with account-ID tie break. Persist the same reservation/job through restart. Reject override after a create/rename dispatch or possible write; preserve prior allocation on failed/stale selection.
5. Extend the one queue only as needed for a fixed read-only observation of a saved candidate account, enforcing its exact revision, account fence and existing global/per-account budgets. No unbound write scope or second scheduler/controller. Global Pause and module Disable stop admission; same-operation readback retains uncertainty safely.
6. Add actual Generators list/details owner/reservation/progress/cause, Work/account links, typed ownership recheck and pre-dispatch account override. Preserve selection/filter/draft/focus; no false Created/Published state. Reserved work remains explicitly awaiting the P17 implementation in this checkpoint.
7. Focused T covers concurrent balancing, archived reservations, unique adoption/mapping conflicts, unknown inventory without a false veto, override races/dispatched rejection, readonly account scope/fences and restart/no duplicate reservation. Required B uses production XPI/real controls and protected rendered/native-protocol fixtures: adopt a remotely owned generator absent locally, independently verify unchanged source/listing, then operate account override and real restart without double allocation. Reuse completed donor/transport research and unchanged writer evidence.
8. Publish frequent meaningful code+todo checkpoints and verify remote files/commits/trees. Run local focused checks where available and the affected installed journey in existing CI; merge verified P16, verify postmerge main and automatically continue P17.

## Next action and holds

P16 code is not yet written. Next implement atomic local ownership/reservation primitives and the fixed read-only provider observation, then finite intake and actual Generators controls.

The runtime is restored at `/workspace/scratch/a60548e2a34d/PCMS`; clean checkout matches verified main. Dependencies installed with npm ci --ignore-scripts. P13–P15 evidence remains its original GitHub CI identity; no unavailable historical local command is claimed run.

H/G/P1–P5 remain NOT TESTED and unauthorized. P44 separately qualifies current provider ownership/adoption contracts. P42–P49 need explicit disposable external resources/effects; all current provider/native tests use isolated local fixtures.

Atomic allocation/adoption checkpoint: a narrow Core transaction supplies current accounts/generators/job/module/repository to synchronous Creator policy. Reservations minimize confirmed ownership plus pending allocations, retain archived reservations and reject stale/dispatched/disabled overrides. Adoption binds exact principal/ID/slug and preserves source references. Five focused local tests PASS, including concurrent balancing, reopen/idempotent override/races, source preservation and conflicts; provider adapter/UI/required final T/B remain OPEN.
