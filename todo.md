# Current implementation checkpoint

## P21 — DEPLOY selected complete source

P20 merged as [a17cb4d](https://github.com/Neb963/PCMS/commit/a17cb4df65fbd8e2ea5f43782767a20361e5a06c), tree39a50442c1ac457a65f5c2b6bfd1cedac9bbf5be, identical to verified PR27 HEAD882c68d. [41350798299](https://github.com/Neb963/PCMS/actions/runs/41350798299) focused109T/build and required installed B PASS. The normal-sandbox Firefox155.0/build20260817142839 test proved automatic READY-before-Creator without a Deployer source lock, protected adoption, exact byte-preserving unlisting and one-effect readback after process death. Prior failed runs and corrections remain in Git history/learned.md. Main tree verified independently through GitHub and fetch.

### Plan before implementation

Base is actual main a17cb4d; branch p21-pinned-deploy-source. Preserve P20 and P28–P33.

- Continue a prepared DEPLOY on the same durable job and persistent writer; retain its original previous-good and unlist receipt. No approval or manual Save.
- Read the complete pinned input manifest (roots, binary src and exact paths). Recheck current READY inputs, owner, unlisted baseline and every editor through the existing shared source writer.
- Start a distinct source effect identity while preserving the observed unlist history. Reset only the completed current-effect pointer; never erase POSSIBLE or old receipts.
- Independently verify the complete stored set, including deletions. Show Saved — publication pending in Generators/Work. Do not publish or mark DONE in P21.
- Add focused production T for exact pinned bytes, relevant Git/source drift, dirty editors, Pause, stale revision, lost ACK and cold recovery. Extend only the affected installed B journey: actual Git intake → protected native full-source save, dashboard closed, process death after application, exact independent bytes/counts and no other-generator/Git writes.
- Push meaningful checkpoints; merge after required T/B, verify postmerge main and automatically proceed to P22. G/P2 remain deferred to P43/P45, NOT TESTED/unauthorized.

Same-job pinned-source continuation and contextual Saved — publication pending UI implemented. Focused T and targeted installed B are in progress. CI retains the same two jobs/triggers and replaces only the affected journey with installed_deploy_source.py; local Firefox remains unavailable. No live provider effect is authorized.
