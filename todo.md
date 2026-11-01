# Current implementation checkpoint

## P20 — READY intake and safe update preparation

Base main `efd84eaaba651a9fa78789ba1de1d08fb8171e7c`, tree `59835227893ac8a69f0023114c1ccdc18cb03c50`. Remote inspected 1 November 2026: P01–P19 and P28–P33 merged; no open PR. P19 postmerge T/B evidence remains valid and is not repeated. This invocation continues sequentially through all eligible phases.

### Plan before implementation

- Read immutable Git objects from the current catalog; pin action/version/commit, exact required bytes and input digest in the existing Core blobs/jobs. Reject changed input under the same version and external unverified DONE.
- Automatically intake READY once. Persist WAIT_CREATOR with its existing dependency job, without a Deployer writer hold. Never clear Creator uncertainty or steal its creation fence.
- Supersede only before effects; withdrawals and relevant input changes fence subsequent writes. Preserve every old candidate and receipt.
- After verified owner/remote identity, acquire the existing writer hold, inspect every editor and preserve complete previous-good. Verify unlisted before preparation completes; use the native guarded save mechanism for listing, with independent source/listing readback and no replay after possible effects.
- Wire finite module steps and contextual Generators/Work status/recovery into the packaged runtime. No manual Start and no second queue/controller.
- Run focused T/build checks, then targeted normal-sandbox installed B against independent Git/provider fixtures: READY-before-Creator, Creator Unknown, source-lock ordering, unlist-before-edit, withdrawal/version conflict and restart. Record B as open until actually run.
- Push meaningful checkpoints, verify remote commit/tree, merge only completed verified work, then select P21 automatically. If a genuine boundary blocks P20, retain its exact state and select safe independent P34 or P36.

### Evidence and holds

Checkpoint: immutable input reader, automatic version/Creator intake, same-job source preparation and contextual UI are implemented but unverified. Existing source/native focused regression: 46 T PASS before runtime wiring. P20-specific 10 T PASS; combined selected T result is recorded in the next checkpoint. Required B is pending the targeted installed_deployer.py journey. Local qualifying Firefox download failed with proxy CONNECT timeout; use existing hosted Firefox setup without changing security settings. CI selection replaces the prior P19 journey, adds only P20 tests, and retains the same two jobs/cache/trigger frequency. No broad suite is added. G/H/P1–P5 remain NOT TESTED and unauthorized, except existing supplied P19 source evidence. No live provider mutation is authorized. Required installed evidence may use controlled fixtures. Accepted specification/design/PHASES remain unchanged.
