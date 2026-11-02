# P41 remediation — active work

The P41 candidate was rejected. Its prior fixture receipts do not close the I-A–I-F findings. Real P42–P49 acceptance remains **NOT TESTED**. Authority: accepted v42, design revision 2, AGENTS.md and CI-GUIDELINES.md (unchanged).

## Actual baseline / program

- main `a3a084dcdb52cb51ff1ef82d1287d18fa7661129`, tree `9fa5ffa20dd70ef2c4570541ee49255eacd2f6d0`; no open PRs or remediation branches at inspection.
- Package manifest: all 29 files verified. Read all contracts and I-A–I-F reports. Operator material remains private outside the repository.
- Order: R01 diagnostics → R02 Git → R03 route lifecycle → R04 dependencies → R05 search → R06 UI/vision → R07 load → R08 exact-artifact rehearsal. Each phase needs its own report and honest tier results.

## R01 plan (before code changes)

1. Extend the existing event boundary with a strict typed diagnostic allowlist; classify exceptions without echoing messages, credentials, arbitrary causes or URLs. Enrich local transitions atomically with state, code, operation and recovery context. Preserve legacy events.
2. Preserve typed failures at queue dispatch/readback, with effect identity, elapsed time and no-replay decision. Record failure before any further action; keep possible effects unknown.
3. Add a direct primary-key bounded event range query for archive intervals. Preserve stable cut, gaps, pruning and watermark rules.
4. Add an atomic redacted current checkpoint inventory to default support/automatic exports. Version and hash all required sections; retain schema-1 verification. Do not include raw private records or backup credentials.
5. Add production-code oracles for failure causality, adversarial redaction, actual quota/transaction failure and 100k-prefix bounded seek. Update independent disk parser and installed fault/ZIP test, then run focused tests/build plus installed Firefox/DSK when available.
6. Review diff; publish checkpoints and `docs/remediation/R01-report.md`. R01 remains open until its required installed/disk semantics pass. No operator testing or ready claim.

## Environment / evidence

- Firefox connector get-info and list-pages both return internal server errors. Local Firefox/geckodriver absent at initial inspection. Check existing CI/local setup before declaring B blocked; never weaken sandbox.
- Prior CI success: main code merge `71e672b9` run `41457499428`; historical evidence only.

### R01 checkpoint

- Implemented typed diagnostic projection, atomic transition context, original queue cause/no-replay, default hashed current checkpoint ZIP section, RPC search outcome fingerprints, safe Git HTTP/comparison witnesses, bounded event range seek and legacy verifier.
- 66 focused T checks PASS. Actual fake-IndexedDB 100001-row suffix oracle traverses <=3 cursors for one row. This does not qualify installed performance.
- Published source `c6b96096` / tree `dd678fdd1364b3b141c9d511b399d3801786f876`; remote tree matched exactly. Git CLI push lacks credentials; connector CAS publication works.
- Local Firefox155.0b1 could not create a session: sandbox uid_map EPERM/content-process crashes. No sandbox workaround applied. Extended installed Journal/independent disk test and selected CI for this changed boundary. Required B/DSK pending; see [R01 report](docs/remediation/R01-report.md).
- CI run 41505996118 passed the R01 installed Journal causal-fault/independent disk step and startup step on source e3c8087b; remaining integration steps were still running at observation. This is evidence of the executed local fault scope, not provider acceptance.
- Review added per-read Git status witnesses, file failure codes, explicit HELD semantics, bounded redaction metadata and effect timings. Added actual installed 100001-event/90-day tail-export oracle; these last changes require the next matching CI receipt.

## R02 plan (before R02 code)

R01's default installed disk fault/continuity step passed on e3c8087b. Latest diagnostic additions and installed 100k-range measurement are awaiting matching CI; this is not a waived release gate. Continue safe bounded Git implementation, keeping R01 and all final gates open until exact evidence is collected.

1. Verify commit GET identity against exact expected object SHA/tree/ordered parents/author/committer and deterministic message. Permit only the observed omission of exactly one terminal LF; no trim or other normalization.
2. Validate/persist safe POST identity/status metadata without trusting POST as independent completion. Preserve possible-effect attribution and read-only same-operation recovery, no force and no second commit/ref on ambiguity.
3. Correct independent Node and actual bare-Git HTTPS fixtures to emulate GitHub's message representation by default. Add negative message/trailer/tree/parent/actor cases and lost-ACK normalized readback.
4. Run production Git/Discover focused tests; select actual installed Discover→Git fixture and Git writer/Work journey in CI. Reuse the package's independent public raw-object proof (do not repeat research or mutate a content repository).
5. Publish R02 report and checkpoints with exact tier scope; merge only verified work. Live G/P43 remains NOT TESTED.

### R02 implementation checkpoint

- Exact commit SHA/tree/ordered parents/name/email/time are required. Only exactly one terminal LF may be absent from GET message presentation; all other bytes and trailer remain exact.
- POST object identity is checked and recorded, while independent GET/reachability remains required. HTTP rejection classes are typed; server/lost replies remain POSSIBLE and cannot replay.
- Independent Node/bare-Git HTTPS fixtures now normalize the presentation, so prior writer tests exercise the formerly missing case. New raw `git hash-object` oracle and malicious drift cases pass with the focused Git/Discover suite. Installed matching evidence pending.

## R03 plan (before R03 code)

R02 source/T checkpoint: cd6ed32c / tree16e5032cc274c81e21db5b0045cb7fb95f992726, 32 focused tests PASS. R01 exact installed scale and R02 installed checks remain open; no release waiver.

1. Add read-only current protection observation to the existing private donor adapter. Persisted READY is enrollment history; never extend the donor TTL or synthesize positive proof.
2. Extend the existing Accounts flow with a bounded internal RENEW purpose that verifies the existing route/binding, checks unchanged exits, then returns to enrolled READY without opening another login tab or claiming a fresh login. Use the one queue and immutable effect identity.
3. Add Accounts maintenance/deadline and on-demand ensureProtection, with boot-scoped proof invalidation, deduplicated current job, conservative backoff for known failures and read-only handling of POSSIBLE outcomes. No new Persona, route selection or native protocol.
4. Wire startup/wakes/deadlines and truthful account projections. Preserve human login/Confirm, archive/removal/Pause/restore fences and strict DNS/IPv4/IPv6/principal checks.
5. Test cold/TTL/outage/unchanged-binding/recovery/double-admission/no-extra-open behavior against actual Core and Accounts code; use independent installed native fixture for matching B evidence. Report untested live H distinctly.

### R03 checkpoint

- Implemented existing-binding RENEW flow, donor current proof observation, proactive/cold/on-demand maintenance and deadlines, known-failure backoff, unknown same-operation readback, truthful route projection. No new route/Persona/tab or login confirmation.
- 56 focused Accounts/donor/binding/source tests PASS. Added stale/cold/dedup/no-extra-setup/backoff/no-replay oracles. Installed native-fixture/process/TTL matrix pending; [R03 report](docs/remediation/R03-report.md).
- R01 exact CI41506387916 (source f48a4522) completed focused + all installed steps successfully, including actual 100001-event suffix export. Retrieve its receipt before closing the report. R02/R03 are not covered by that artifact.

## R04 plan (before R04 code)

1. Require `folderPresent === 'YES'` in Creator intake/allocation and final creation preflight. Update legacy test fixtures to the real catalog value and add explicit NO/malformed negative cases.
2. Before new Creator preparation, ask existing Accounts to ensure current protection. A pre-mutation route hold records its dependency and resumes the original RESERVED job after proof returns, with a new observation cycle only; never override/replay CREATE or RENAME.
3. Propagate upstream Creator job/account/cause into Deployer projections and Work. Wake on changed dependency/verified identity; retain WAIT_CREATOR as waiting without a source claim or premature publication.
4. Coalesce unchanged dependency checkpoints while retaining meaningful transitions and bounded fallback reconciliation. Test same-job repair, allocation/override/no-replay, rejected folder values and unrelated work.
5. Record exact focused/installed scope in R04 report; native/Creator/Deployer installed checks remain required on the integrated XPI.

### R04 checkpoint

- Exact YES catalog guard; Accounts protection prerequisite and same-job safe Creator wake; current Creator dependency/account/cause in Deployer/Work; unchanged dependency records coalesced; truthful still-waiting check feedback.
- 84 Creator/allocation/creation/Deployer T tests PASS (~76s), with same-job/no-owner-rescan/no-write-before-proof and exact YES negatives. Narrowed refinement is checked separately. Matching B/visual remains pending; [R04 report](docs/remediation/R04-report.md).
- R01 downloaded receipt independently identifies Firefox155.0/build20260817142839, sandbox6, XPI40111aec89f9227f96afed31f825fc8aa027a46132bef7952aef9ae7911470d1:100001 events/90days,1 tail row,5 tail cursor reads,107ms actual UI→Downloads→disk. No provider acceptance inferred.

## R05 plan (before R05 code)

1. Use the existing Core projections to join generator owner display names, listing and work state. Add account/listing/work filters and multi-selection retained across page/navigation/restart; selection grants no mutation authority.
2. Cache immutable projection snapshots by dataset/data revision (bounded entries); diagnostic-only events and UI view saves must not force whole account/generator/job rereads. Keep historical cursor cuts stable and current Work state truthful.
3. Preserve real UI→RPC→Core queries and privacy-safe diagnostics. Fence stale responses immediately when typing, retain query/filter/paging state, and show actual query failures near controls.
4. Extend source tests for joined owner search/filtering, late pages, changed data versus diagnostic-only changes and cursor identity; extend actual installed UI fixture for owner/Unicode/filter/selection/restart and default diagnostic trace.
5. Keep historical operator universal search root UNKNOWN unless actual installed evidence establishes it. Publish R05 report with that limit; a synthetic match is not historical incident closure.

### R05 checkpoint

- Joined generator search by human owner/slug/folder; owner/listing/work filters, retained multi-select and selected-only paging; stale response fencing and bounded RPC errors.
- Bounded immutable data-revision projection cache; UI diagnostic/view writes do not force full data scans; real mutations invalidate it. 15 query/record/continuity T tests PASS, including1005 Unicode-owner generators/later pages and instrumented cache oracle.
- Actual installed owner/filter/selection/query-diagnostic and cold AUTO_RENEW checks added; not yet executed. IB-09 historical universal search cause remains UNKNOWN; [R05 report](docs/remediation/R05-report.md). R06 can safely refine actual UI while this acceptance gate stays open.

## R06 plan (before R06 code)

Baseline pixel inspection completed in this session: operator Work screenshot has roughly the first third of the viewport spent on shell/search/host notice; concatenated Journal/generator/back links; raw UUID/hash facts dominate the task; repeated deployment metadata; irrelevant AI attestation on DEPLOY; weak action grouping and long vertical whitespace. CI Settings screenshot similarly leaves a narrow, sparsely styled link list below a large repeated host notice. These are image-grounded findings; raw operator pixels remain private.

1. Rework the existing CSS/components into compact consistent shell, controls, rows, filters and action groups; preserve every real control and exact navigation.
2. Enforce authored [hidden] visibility, hidden focus exclusion and responsive layout. Keep status global vs account-specific distinct. Place technical IDs/hashes/startup detail in optional details and keep causes/next actions primary.
3. Add descriptions to Other and concise task labels; remove repeated default host banners and empty instructional copy without removing security failures.
4. Capture actual installed screenshots for primary/settings/module/work states at1280/560/390 widths, with artifact/browser/state/hash provenance. Inspect actual pixels with the vision-capable assistant, record defects and repeat after fixes. Capture alone is not PASS.
5. Run actual keyboard/controls/conditional-state/accessibility checks. Missing or failed screenshot/model/functional tiers keep R06 BLOCKED. Required final R08 review must use the exact final XPI.

### R06 checkpoint

- Pixel baseline inspected directly (private operator Work + CI Settings). Implemented compact shell/controls/rows/filters/focus, authored hidden rule, optional technical evidence, contextual dependency and module descriptions; all existing controls retained.
- Actual installed capture matrix added with exact artifact/viewport/image hashes and hidden/overflow checks. No final screenshot or V PASS yet; [R06 report](docs/remediation/R06-report.md).
- Full production-code suite running with bounded4-file concurrency before integrated CI. Do not treat screenshot capture or DOM checks as visual acceptance.
- R06 capture wiring is ready for matching CI; full source run has not yet produced its completion summary. Do not label the in-progress broad run PASS. Published R01 receipt does not qualify these later changes.
