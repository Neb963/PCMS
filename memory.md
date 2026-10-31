# PCMS handoff memory

**Non-authoritative.** Requirements are [v42](spec/PCMS-Working-Draft-v42.md); engineering contracts are [design revision 2](architecture/design.md). Use [PHASES.md](PHASES.md) and [todo.md](todo.md) for work. Baseline: 31 October 2026.

- This is the new PCMS plan, not a continuation of Alpha phase IDs. No destination repository was assigned. No code, workflow, XPI, branch, commit, CI run or live operation was created in the planning task. P01 is next.
- Retain the input package's `spec/`, `architecture/`, `research/` and `evidence/` paths. The six work files live at repository root. Input manifest hashes matched. Authorities were not edited.
- Design's reuse baseline is Alpha `c5b23b77f50db7ffe50e2ef705a8bf0b5879e36e`, donor `9995f6eadfa54be6cc0001f4e04f2a2d9b9401bf`. Read-only reuse directions are in design §12.1; no broad re-audit is needed.
- Existing bridge/Gecko ID decision: `persona-route-manager@local`, dedicated clean Firefox profile, unchanged working native protocol/allowlist. Separate profiles share the native daemon. Preserve Alpha installations and avoid competing route mutations.
- Firefox API floor is 154 with a build that actually satisfies `strict_min_version: 154.0`. The normal-sandbox feasibility proof used 154.0b10; it is not packaged minimum-version acceptance. The user's old 153.5 ESR is not a fixed target. Signed/general distribution support is unestablished.
- Prior donor/41-test, basic userScripts/CSP, sandbox lifecycle and synthetic archive/remap/recovery proofs are completed evidence. New production code still needs its assigned B/DSK checks.
- Completed DEVELOP probes establish three-file transport and corrected exact input/send observation. Corrected run `local-mvvnba4i` starts with LOG_RESET; it is a separate run. Identical 14-byte fixture files do not prove substantive AI work, terminal success, Finish/publication or browser-restart continuity. Do not rerun the diagnostic probe or follow superseded continuation instructions in older reports.
- PCMS owns Finish and publish inside editor chrome. Preserve the same protected chat/tab. Idle is not success; only the design's stable inactive explicit human fallback can replace unavailable terminal attribution. Backup does not clone AI conversations/workspaces.
- Ship seven enabled modules. Disable stops that module; global Pause permits enabled Journal/Backup. Core always records. Defaults: Journal 30 minutes, Backup 6 hours, retention 90 days; Refresher 24h eligible Active / 72h wall Sleep.
- P42–P49 hold authorized external acceptance, with exact oracles. Safe coding and installed fixtures can proceed first. Real 50-account routes and fresh-device sessions cannot be inferred from synthetic records/restored bytes.

- Planning correction: 49 phases; module seed (P06) is separate from lifecycle (P07), archive codec (P30) from Downloads/manual Backup (P31); Backup branch P28–P34 precedes Refresher P35–P38. P20 waits for Creator without taking Deployer source claim. Shared Downloads is Core-owned regardless of Journal enablement. This is schedule/context, not new product authority.
