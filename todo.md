# Current implementation checkpoint

## P24 — native chat and exact one-shot prompt

P23 merged [PR30](https://github.com/Neb963/PCMS/pull/30) as 0db87e7945b799644dde3361468e10d24710dfe3; remote main tree9a6d0f5895ecf1b75532bad84fcbd6f6db162885 equals tested b1a962da. [41353318368](https://github.com/Neb963/PCMS/actions/runs/41353318368):193T/build + required installed B PASS. Firefox155.0/build20260817142839/sandbox6; XPI499da05004e1b5658d02f3e3b20fd7ca390d9b4e00b727e07fda82862ee0977f. Independent complete source/Git byte oracles and two native saves proved exact staging and cold readback without replay. No AI or live mutations were tested.

### Plan before implementation

Base actual main0db87e79; branch p24-native-chat. Preserve all existing verified phase receipts.

- Add one fixed native AI adapter through existing protected donor scope; feature-detect editor/input/send/new-chat/session controls. Reuse accepted historical mechanism evidence; do not repeat live probes or implement streaming transport.
- Resume the staged DEVELOP job. Persist distinct new-chat and send possible boundaries, independently verify fresh transition, exact raw input and UTF-8 digest, and retain exact account/Persona/remote/document/chat binding. No automatic repeat after unknown effects or lost document continuity.
- Preserve protected tabs with dashboard closed; account for at most two actively automated DEVELOP jobs separately from later parked review. Never reuse another job's review tab.
- Verify native input behavior against captured evidence before enabling dispatch. Known native transformation, unsupported context or ambiguous transition must hold before Send, with precise diagnostics; no silent prompt rewriting.
- Add Work/Generator context and same-operation Check. Record sanitized digests, not prompt/chat capabilities.
- Focused T checks exact Unicode/newline bytes, duplicate calls, stale document/binding, pause/module fences, unsupported native behavior and restart/no replay. Required installed B uses production adapter and independent native new-chat/send counts, dashboard closure and forced Firefox restart. Merge only when full bounded outcome and required evidence are satisfied; preserve any genuine external hold and continue independent eligible phases.

P24 fixed donor/native adapter, staged-job continuation, separate chat/send effects, document/tab reservation, exact-input guards and inspection-only restart behavior are implemented. Local focused73T PASS; build and required installed B pending. Edge whitespace/CRLF that native controls transform hold before Send; no silent trim. A native-disabled initial New Chat also holds rather than inventing a fresh transition. Existing transport evidence is reused; actual provider compatibility remains P46. Live integrated native acceptance remains NOT TESTED/unauthorized (P46).

Checkpoint00a0cb5e/run41354256306: focused T/build PASS; installed B failed in fixture navigation (duplicate dashboard closure), before its AI oracle. Corrected observer selection; required B remains pending.
