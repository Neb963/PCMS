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
