# Current implementation checkpoint

## P22 — Publication, Refresh Pool and DONE

P21 merged PR28 as6db6939ce938efd088db7fc48be9f7140207754a, tree4b0379afbd19c5912d0cdcc01ba63b21012eecf1, identical to verified6a2d6fac. [41351214740](https://github.com/Neb963/PCMS/actions/runs/41351214740) T/build+B PASS (local107 focused tests; hosted adds unchanged host/package checks). Firefox155.0/build20260817142839/sandbox6; XPI3a185e7dd5288c72583f5c17094cf561c1dafdfddab7792f35fa2c5a9d0f18a3,832331bytes. Real packaged catalog/native complete-source/deletion/binary save and process-death recovery had exactly one unlist and one source save. Git stayed read-only. P20 PR27/evidence remains in history.

### Plan before implementation

Base actual main6db6939c; branch p22-publication-pool-done. Preserve the accepted specification/design and prior phases.

- Recheck the same READY identity and exact independently saved candidate. Use the shared guarded native save for a distinct listing-only PUBLIC effect. Verify complete source, owner and listing from the protected provider, never public-page availability alone.
- Add/upsert Refresh Pool membership atomically with the publication/source receipt. Preserve an existing cycle; a new member starts pending for P35. Do not republish to repair a local pool transaction.
- Use the existing scoped Git writer for a separate matching-version DONE commit/readback. Recheck admission/relevant READY inputs before each Git effect. Preserve root instructions/unrelated files, and retain Published — Git completion pending after denial/loss.
- Reconcile possible publication/Git effects before any retry; only known rejected Git writes may safely rebuild the same logical operation. Complete/release the generator writer only after all receipts are verified.
- Wire honest Generators/Work states and same-job Check. Test failures at publication/pool/DONE, withdrawal, duplicate completion, cold recovery and no READY loop. Targeted installed B independently checks source/listing/pool and bare Git history; restart after publication must not publish again.
- Push/verify checkpoints, merge after required T/B, verify postmerge main, then continue to P23 automatically. Live G/P2 remains NOT TESTED/unauthorized until P43/P45.

Publication/pool/DONE continuation, distinct prepared-operation recovery and same-job contextual status are implemented. 39 selected Deployer/Git production T PASS, including denied DONE access followed by corrected Git-only completion, lost publication response, pool transaction failure, source drift, version withdrawal, update/cycle preservation and preparation crash gaps. Required installed B remains pending. Existing CI jobs/triggers are unchanged; only the targeted journey/test selection changes for the affected source/Git boundary.

Checkpoint ffcd4d3/PR29: local141 focused T/build PASS. Installed B pending. The implementation now keeps same-job Source Check in the Deployer workflow when Git is uncertain, rather than misrouting that Git effect to the source reconciler. Shared source adoption stays unavailable for automatic deployment jobs; their immutable READY inputs remain authoritative.

Installed [41351907805](https://github.com/Neb963/PCMS/actions/runs/41351907805) FAIL: after actual publication and process death, the original operation was verified without replay, but account-hook recovery left the Deployer job RUNNING at POOL. No pool/DONE occurred. Fixed the out-of-band finite-step handoff to persist WAITING; a direct recovery/queue-state regression covers it. This run remains FAIL.
