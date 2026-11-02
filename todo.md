# Current implementation checkpoint

## Complete candidate; external acceptance held

P01–P41 are implemented and verified at their required available fixture tiers. This execution completed P38–P41 sequentially. No safely eligible implementation work remains without the external resources below. All G/H/P1–P5 live cases remain **NOT TESTED**; no live provider mutation was performed.

### Frozen acceptance artifact

- Source `decd5e84d3546ccd11686c577b95cf94ba0cb0b6`; tree `1c8abd2a99b8c2bb1fbede6f75944b0debbc529f`.
- [Qualified XPI and identity](https://github.com/Neb963/PCMS/actions/runs/41456369462/artifacts/13145834186),892656 XPI bytes. SHA-256 `ba8c844dafc72afb44aea1ca7d9d00940e8b021471086995283dd9c6aca7d127`. Keep this exact tested file for acceptance.
- [Run41456369462](https://github.com/Neb963/PCMS/actions/runs/41456369462):73 focused T/build + artifact preflight and all three same-XPI installed B/DSK journeys PASS. Every installed receipt matches the artifact hash. [Installed receipts](https://github.com/Neb963/PCMS/actions/runs/41456369462/artifacts/13147920509). Firefox155.0/build20260817142839/normal sandbox6.
- Real persistent/cold/blocked/wrong-profile startup; seven fresh enabled packages; actual Journal Disable retained across restart; exact user-registry hashes; full keyboard/narrow/search/later-page/focus/module install-update-disable-enable/source-draft/cold one-save journey; production disk backup and same/fresh-profile scoped restore; early auth/cookies/binary/history/draft/packages/Pause/Unknown preservation; valid/rejected synthetic login and explicit recovery all PASS. Same-device fresh profiles do not prove fresh-device or live login portability.
- [PR42](https://github.com/Neb963/PCMS/pull/42) merged `71e672b9ca80e1d39022550fd2b420c976a127f1`; remote tree exactly equals tested source above. Postmerge [41457499428](https://github.com/Neb963/PCMS/actions/runs/41457499428) PASS (both focused and all installed steps). This handoff changes documentation only and retains the frozen artifact.

### Completed phases and reused evidence

| Phase | Verified checkpoint | Required evidence |
|---|---|---|
| P38 automatic Refresher control | [PR39](https://github.com/Neb963/PCMS/pull/39), merge5d9d9f58; testedf2226d6e | [41435567394](https://github.com/Neb963/PCMS/actions/runs/41435567394):117T/build+B PASS; automatic initial/repeat both-marker/full-binary saves, measured directory pressure, Pause/settings/closed-dashboard/restart. XPI46dade12363bb0a6d7af3ec48ca4eea623c5ce6079f918863d10cfa9631978b6. Postmerge41436091125 PASS. |
| P39 shared UI and recovery | [PR40](https://github.com/Neb963/PCMS/pull/40), mergeb0df16b3; testedc45798cb | [41442868974](https://github.com/Neb963/PCMS/actions/runs/41442868974):78T/build+B PASS; cross-item search/grouped attention/Reviewed separation/late paging/focus/module lifecycle/durable selected-source one-save recovery. XPIe2b670e17297764aca25eff37d4acd7e23ba8e842cca22ff30139edbef1f36b8. Postmerge41443089685 PASS. |
| P40 representative capacity | [PR41](https://github.com/Neb963/PCMS/pull/41), merge158ca1d5; testeda01a8e2b | [41454197903](https://github.com/Neb963/PCMS/actions/runs/41454197903):138S/T/build+full installed S/B/DSK PASS. XPI814ea942bcd066dd131cc97c6a832651c8a8fb18eac3b9d8a25cca14463bff52. Postmerge41455581307 PASS. |
| P41 complete candidate | [PR42](https://github.com/Neb963/PCMS/pull/42), merge71e672b9; testeddecd5e84 | Exact artifact and73T+B/DSK above. Seven complete enabled fresh packages, retained user choices, safe installation guidance and unchanged donor-first/security contracts. |

P40 used50 account records/1001 generators/90000 operations over90 days/32MiB retained binary,4 logical CPUs/16.76GB reported browser-runner memory. Actual4 global pages2395ms/exact late search227ms/21 Core pages1093ms. Installed archives35,775,596 and35,825,279 bytes independently passed CRC/every-entry/source/history hashes; captures48078/60525ms with atomic barriers3083/2506ms. Real staging stop/restart/Check same operation, native cancellation, destination failure, Backup Disable and exact previous/manual/unrelated preservation PASS. Peak aggregate Firefox RSS4,211,781,632 bytes includes shared pages. These are measured fixture sizes, not capacity ceilings or50 working routes.

T/S independently verified1000 fair per-item reads across50 accounts/maintenance turn2/restart-preserved review checkpoints,1101 catalog folders/1105 initial requests/unchanged poll1 request and0 folder reads, and forced ZIP64/74,937,420 uncompressed bytes with independent disk hashes. Unchanged native retention B/DSK [41449213129](https://github.com/Neb963/PCMS/actions/runs/41449213129), sourcec9800711/XPI068ac8f1f7d83ff5d11fda473260b6dcab295d35ab312ec1262f9e810c620552, passed actual owned deletion/Pause/closed-dashboard/manual-unrelated-moved-history-loss preservation/restart/no-repeat. Its boundary did not change afterward.

P41 changed only build version, trusted artifact checks, selected test wiring and docs, so P40 scale/large disk/retention evidence is reused with its original identity. Earlier unchanged creator/Git/source/AI/one-Discover/one-directory/parked-tab boundaries retain the actual receipts in PR history. Prior failed/partial runs are not PASS; their measured corrections and useful lessons remain in learned.md/history.

### Exact remaining holds

| Phase | Dependency/resource and remaining oracle |
|---|---|
| P42 H | DependencyP41 complete; needs named configured real host/existing bridge, two authorized isolated accounts/distinct exits, lifecycle/outage/repair and independent unchanged remote-generator observations. |
| P43 G | Independent dependencyP41 complete; needs named disposable repository/main, suitable Contents token and Git-only clean profile; exact real history/tree/concurrent/lost-ACK/ruleset-denial observations. PCMS's implementation repository was not authorized as that disposable target. |
| P44 P1 | NeedsP42+P43 and named authorized account/slug targets for current classification/ownership and once-only unlisted creation. |
| P45 P2/G | NeedsP44 and disposable full source/publication targets for exact bytes/revisions/dirty-conflict/lost-ACK/listing/pool/DONE acceptance. |
| P46 P3/G | NeedsP45 and authorized native AI instructions/chat/target for same-chat readiness, actual PCMS Finish and independent source/Git/publication completion. |
| P47 P4 | NeedsP45 and authorized small directory/marker cases and existing pools; actual source/functional/rendered before-after positions and rate/propagation observations. |
| P48 P5/H/DSK | NeedsP42 and authorized managed login contexts plus a configured fresh-device destination; actual principal/route/exit/Git access and rejected-session outcomes. |
| P49 H/S/DSK/P4/P5 | NeedsP46+P47+P48 and representative50 real managed routes/exits and existing authorized pools; final host/fleet/90-day maintenance observations on the frozen candidate. |

No dependency is bypassed, no external permission/credential is invented, and no deferred verification is marked passed. Overall readiness: **complete fixture-qualified unsigned acceptance candidate; live/provider/portability/fleet acceptance pending**. Follow [installation guidance](docs/DEVELOPMENT.md); preserve held jobs, human edits, previous-good/original source and the exact tested XPI.
