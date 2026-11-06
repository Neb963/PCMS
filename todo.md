# R08 qualified candidate

PCMS 0.49.0 passed all pre-operator fixture gates. [PR #45](https://github.com/Neb963/PCMS/pull/45) merged the exact tested source `1808671a6c5b4826dfc8c3ac1ef92bd8fdc8bc69` with tree `2f862d4ece13f052bdfb3ba3fc2031a58e7f455a`. The verified XPI is 911,159 bytes with SHA-256 `609fae1d42378b6bab1666059d4048303c131b3b331659dd6d7f956f53d514bd`. Use the original [run 365 candidate artifact](https://github.com/Neb963/PCMS/actions/runs/42220618849/artifacts/13503441570).

- Source 531/531 and focused CI 295/295 pass. Installed seven-module integration, routes, independent provider fixtures, search, startup, Backup/Restore and default Journal pass.
- The first capacity attempt skipped Complete login after Firefox restart. The corrected fixture passed the production export checks and both real 30-minute Journal rounds on the same XPI. The second round completed while globally paused. [Run 367](https://github.com/Neb963/PCMS/actions/runs/42226606447).
- Final original-pixel review, keyboard interaction and native Gecko accessibility pass. The exact historical operator search query and cause remain unknown. The P41 comparison reproduced a controlled reply-loss stall and verified the candidate recovery.
- Real P42–P49 remain **NOT TESTED**. Their authorizations and dependencies are in [PHASES.md](PHASES.md).

[Final qualification](https://github.com/Neb963/PCMS/blob/7bbd72e99ac735a2999aebad0e2748742de1ab70/docs/remediation/R08-report.md). [R01–R08 reports and defect closure](https://github.com/Neb963/PCMS/tree/7bbd72e99ac735a2999aebad0e2748742de1ab70/docs/remediation).
