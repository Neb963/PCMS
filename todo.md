# Current work

**P28 — scoped authentication and cookie collectors. Implementation plan before code.**

P01–P18 merged and verified. P18 PR18 mainb04c3b7ce8a48f5c15009b03cf3a3a09fffa6877/tree279e292a54914a9a3a5e027d60b9c754b041fe0a, post41302307395 PASS. Bounded P17 payload correction [PR19](https://github.com/Neb963/PCMS/pull/19) merged as `db61deab2168fb12cc4eb9b9f910291b383b9416`, exact tree `f1cb79dbf1acfe91f885dec00052c708873ff679`. Source375ec1afeb46a2102e3834bb3f1a782d25300b85 passed212 T/build + required B41303250000; XPI866cae23b72583fc2345ab8b655acaff80b2782e58ea1d54b3af535fbf86d8b8. Postmerge41303419331 in progress; verify before completing this phase.

## P19 hold and dependency selection

P19 requires a shared native source save with actual provider revision conflict handling. Available pinned Alpha code calls app.saveGenerator() but supplies no qualified revision/precondition recipe. P18 providerRevision is null; sourceStamp is a fingerprint only. The accepted discovery-v3.zip is located in the user's files, but the current execution environment is unavailable and cannot extract it. Text retrieval supplied no primary revision fields. No new historical/live investigation, invented provider facade or force-save is authorized. P19 is unimplemented/held for access to that exact source evidence; P20–P27, P35/P37/P38 and their descendants remain dependency-blocked. P28 depends only on completed P11; select it next. P36 is also independent but follows P28–P34 when eligible.

## P28 implementation plan

1. Add fixed packaged perchance-auth-1 isolated-world read of the top-level origin's schema-checked app-storage.user authentication fields and sessionTokenLastChangeTime. Preserve exact strings; reject unknown schema, rotation, wrong principal/document/origin. Report absent separately from unavailable. Never read arbitrary origin data, sessionStorage, IDB, OPFS, src or AI workspace.
2. Reuse the donor's existing cookieService.list for the exact managed Persona store, including firstPartyDomain:null and partitionKey:{}. Preserve normalized identity and all cookie attributes/session/expiry. Stage auth before/after cookie reads, detect cookie/session changes and bound retries. Reuse an attributable protected top-level context or open a separate read-only collection context; never replace a development/review editor.
3. Add one finite Backup CAPTURE coverage job on the existing Core queue/module host. Retain private capture bytes in Core blobs and references; return only secret-safe completeness/context/times/counts. Recheck module generation/account revision at admission; unavailable/archived/changed contexts are explicit incomplete coverage. Global Pause permits enabled Backup maintenance; disabling Backup stops new collection. Preserve previous valid/stale evidence and exact retry diagnostics across restart.
4. Settings → Backup gets actual Check session coverage/progress/results, per-account cause and exact Accounts recovery links. Explain known adapter coverage and exclusions. No successful Back up now/disk-export control before P31. Existing installations require explicit compatible Backup0.2 update; no reseed.
5. T covers exact Unicode/secret bytes, absent/unknown/rotation, cookie isolation/expiry identity, persistence, stale account/module and safe projections. Affected B clicks packaged coverage against real protected fixture localStorage and Firefox cookies in two containers, checks private bytes independently, unrelated stores untouched, negative schema/rotation and secret-safe UI, Pause/Disable and actual restart. Reuse unchanged research and P18 evidence. No live login portability claim.
6. Push meaningful code+todo checkpoints, verify exact remote commits/trees/files, run focused T/build and affected installed B through existing two jobs, merge verified outcome and verify postmerge main. Then P29 and all independent eligible work.

## Holds

H/G/P1–P5 NOT TESTED/unauthorized. P42–P49 require named disposable targets/effects. P48 must qualify current login inventory and operational sessions. Cookie/auth bytes are synthetic evidence, never proof of live login/route portability. Local execution remains unavailable; only actually completed remote Actions checks will be claimed.

## Collector checkpoint

Added the fixed top-level auth read and strict privileged session/cookie validation. The donor reuses cookieService.list in the exact managed store, observes cookie-change epochs and compares guarded auth before/after, preserving the original tab. No broad storage/AI collector or new native protocol exists. Code is not yet integrated into Backup UI/runtime; T/build/B pending.

## Runtime checkpoint

Backup0.2 now runs finite CAPTURE coverage turns through the existing sandbox/module host/Core queue. Raw capsules are hashed/pinned private Core blobs; projected progress contains no secret fields. Account/module guards, bounded rotation retries, missing account/Persona diagnostics, previous complete coverage and disabled read settlement are implemented. No archive/export success path is exposed. PR19 postmerge41303419331 passed both jobs. Focused T and required B remain pending.

## Primary UI checkpoint

Settings → Backup now provides actual queued session coverage, progress, per-account causes/context/times and exact Accounts recovery links, search and ten-account pages. The query projection excludes capsule/blob IDs, tokens, emails and cookie values. Search/page state persists; polling keeps the search control stable. No disk-export control is present. Verification is pending.
