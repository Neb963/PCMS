# Current work

**P09 — Owned-file retention and cleanup recovery: implemented and verified; merge/postmerge next.**

P01–P08 are merged. P09 [PR #9](https://github.com/Neb963/PCMS/pull/9), verified code `9221569b6da7f416d9b85b13473e34f7440c5038`: [41231534454](https://github.com/Neb963/PCMS/actions/runs/41231534454) T and installed B/DSK PASS. Firefox 155.0/build 20260817142839, normal sandbox 6; XPI SHA-256 `357652aaa44b9486c2d1be7905df96d7d61f4977712a042038133c76a011d3ef`.

## Implemented and evidence

- Configurable 90-day Journal local/disk retention, exact current-profile automatic receipt authority and current DownloadItem identity/size. Manual/unrelated/imported files remain protected. New completed corresponding export required; failed latest export/increased retention prevent a new remove.
- Per-file finite CLEANUP jobs in the one queue. Durable intent precedes removal; durable acknowledgement, missing history, moved file and stale metadata are tracked independently. Read-only recovery never repeats removal. Browser history is retained. Core primitives work for enabled Backup with Journal disabled; Backup-specific prior-complete/file acceptance remains P31/P34.
- Only old exported unpinned event prefixes are pruned atomically. Pending ranges and explicit capture pins preserve records; unexported events survive expiry. Monotonic sequences, stale-cursor recovery and visible historical gaps remain. Completed export payload copies can be released without losing pinned bytes or source/job history.
- T verifies age/configuration, authority, final-policy races, interruption/no replay, pins, payload release, stale cursor and policy reconsideration. B/DSK clicks real retention/Disable/Enable/Export/check controls, independently opens production ZIPs, advances controlled receipt ages, erases actual Downloads history, physically moves a file, creates a real unwritable destination and checks actual surviving bytes. Eligible removal runs while Paused/dashboard closed; native stale exists becomes a hold. Real process restart preserves the same cleanup operation with no second remove intent. Firefox loses these Downloads history rows on this restart; the resulting holds remain honest, while independently verified disk preservation/removal passes.
- Installed failures remain visible in PR #9. Run 41231204335 exposed a scheduler defect: wake acknowledgement consumed other pending deadlines. The fix retains due WAITING work until actually handled/held; its regression proves no idle alarms after actual completion. Run 41231437980 then caught a test reading the legitimate VERIFYING transition too soon; the final test waits for the exact native metadata hold without dropping disk/no-replay assertions.

## Next

Merge the verified phase through PR #9, verify actual main commit/tree and postmerge focused/installed run. Then write P10's actual implementation plan and proceed automatically with protected account enrollment, preserving donor-only route authority and post-Confirm identity checks. No interphase confirmation.

No live provider/route/Git effects are authorized or tested. P42–P49 retain their named disposable-target/effect holds. This remains a development checkpoint, not full product readiness.
