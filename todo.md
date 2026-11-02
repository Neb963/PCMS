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
