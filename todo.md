# Current implementation checkpoint

## P19 — Guarded native source saving

**Complete, merged and postmerge verified.** [PR #26](https://github.com/Neb963/PCMS/pull/26) merged as `862b9266881c22ae8efdf523284b8cb6333e3c45`, tree `d943b116810289c7da9f5a02483e6c9335c63748`. Postmerge [41347465533](https://github.com/Neb963/PCMS/actions/runs/41347465533): **128 T/build + required installed B PASS**. This documentation checkpoint changes no executable bytes; the tested XPI remains the artifact from that merged source.

### Original plan and delivered boundary

The phase-specific plan was published **before implementation** at [52997bf9](https://github.com/Neb963/PCMS/commit/52997bf913110d271d470fd5cafe32d166b9a4c2), from main `dea0f77e6b5a23135c530e1e998c942a812c9321`. P30–P33 had already merged; their work and accepted authority files remain intact. Scope is exactly P19.

- One Core source primitive pins complete candidate, admitted baseline/previous-good, file set and native checkpoint before mutation. All known exact-target editors, linked documents, pending files/AI and collaboration are checked. Different containers, changed identities, dirty work and unsupported native paths hold the target without renaming or discarding source.
- The donor-bound native handler preserves undo and native preparation/bookkeeping, with exact root/src staging and a top-level manifest. It sends at most one guarded native save request. Scoped native escalation/retry is blocked; server time/count preconditions, response revision, content hashes and fresh page checkpoint observations remain distinct. The existing queue's immediate Pause/Disable/account/batch fences also gate the actual HTTP effect.
- Independent protected complete-source enumeration/downloads verify every root, binary asset, path/deletion, owner, listing and before/after version. POSSIBLE is durable before dispatch. Lost ACK, readback outage or process death resumes **read-only reconciliation of the same operation**, never another save. Document or late human edits hold completion and retain snapshots. Prepared external assets are not blindly deleted after rejection.
- Generators and Work provide complete-source selection, exact candidate/base/server comparison, file previews, affected-editor inspection, same-operation Check, explicit reviewed-base adoption and previous-good restore. Restore uses the same guards and does not relist. Missing restart context uses the existing Accounts OPEN path for route/context/principal checks; no new controller or routine approval flow was added.

### Exact evidence

| Tier | Result and oracle |
|---|---|
| T/build | **128 PASS**, postmerge run above. Production native/Core code plus independent simulated server/editor: full/nested/binary/zero-src sets, exact deletions/unchanged files, path rejection, stale races/no force, dirty/AI/collaboration, route/principal/document/generation/Pause/fence changes, uploads/server rejection, schema drift, lost ACK/outage, transaction/crash boundaries, adoption and guarded restore. Relevant P18, queue, Accounts, package and host checks included. |
| Installed B | **PASS, five scenario groups**, actual persistent XPI → packaged Deployer → Core → donor → native fixture. Complete binary save and dirty second editor; exact Work/restore controls; forced Firefox death after application/before ACK; automatic background asset readback of the original job/operation with no Check click and exactly one effect; stale rejection/conflict preview; protected owner/route/container and unrelated Git preservation. Independent bytes/hashes/counters, not DOM labels alone. |
| Environment/artifact | Firefox **155.0**, build **20260817142839**, normal content sandbox **6**, normal extension CSP, isolated persistent profile. Both CI jobs produced identical XPI SHA-256 **`dbeb42e1f88bd7b516d2f18bd89afc160b7a3e6e2919e599227a2cad013d0c0b`**, **824961 bytes**. [XPI artifact](https://github.com/Neb963/PCMS/actions/runs/41347465533/artifacts/13100205988); [installed receipts](https://github.com/Neb963/PCMS/actions/runs/41347465533/artifacts/13099942111). |

Final PR source `bbb24d27650f54e69c9549a7be266c0e3fdacecb` has the same tree as the merge. [41347037827](https://github.com/Neb963/PCMS/actions/runs/41347037827) independently passed 128 T/B on it; XPI `83468662cf6dcaf1b96f676f46697aa63a3361652beeb3514122e9b19c01fb63`. Postmerge evidence above supersedes that artifact for delivery. A prior complete run [41346211021](https://github.com/Neb963/PCMS/actions/runs/41346211021) passed before the final queue-fence hardening.

B uses real browser FileList/local file bytes with controlled folder-relative metadata. It does **not** claim OS folder-dialog automation coverage. There is no fixture endpoint, native-service replacement or security bypass in the XPI.

### Retained failed evidence

- [41343139936](https://github.com/Neb963/PCMS/actions/runs/41343139936), [41343480074](https://github.com/Neb963/PCMS/actions/runs/41343480074), [41343770675](https://github.com/Neb963/PCMS/actions/runs/41343770675), [41344363114](https://github.com/Neb963/PCMS/actions/runs/41344363114): directory upload/native headless picker failures before a P19 save. Replaced only that test scaffold with the FileList boundary above.
- [41344966328](https://github.com/Neb963/PCMS/actions/runs/41344966328) and [41345535797](https://github.com/Neb963/PCMS/actions/runs/41345535797): missing protected restart context, then REPAIR reaching a missing identity tab. Fixed by the existing Accounts OPEN workflow and automatic read-only source recovery.
- [41345876770](https://github.com/Neb963/PCMS/actions/runs/41345876770): sampled the old owner hold during active reconciliation; its retained diagnostic later showed COMPLETE/OBSERVED. Production now records CHECKING before capture. [41346769872](https://github.com/Neb963/PCMS/actions/runs/41346769872): cold-dashboard observer raced navigation creation before setup; the harness now waits for the actual element. These runs remain failures.

### Live limits and next dependency

The accepted user v1.4 probe `62c1c618-f957-4fc8-88ee-22d6fb17c4e2` established a normal native save, one temporary src file, restoration and deliberately stale rejection without force. It was **not repeated**. No live provider/source/route or product Git mutation was performed; repository implementation checkpoints were explicitly authorized.

**P45 NOT TESTED:** real simultaneous editor race, pre-existing real multi-file/binary tree and current provider path/schema qualification, complete P2 DEPLOY/unlist/publication/pool/DONE acceptance. T/B does not establish those live outcomes. Other G/H/P acceptance and fleet capacity remain in their planned phases.

**P20 is now dependency-eligible.** P19's shared source dependency is available to later Deployer/Refresher phases; their other dependencies still apply. **Stop after P19. No P20 or unrelated phase was implemented.**
