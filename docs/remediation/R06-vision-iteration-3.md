# Installed pixel review — iteration3 remains FAIL

2026-11-02. Current vision-capable Codex assistant inspected each original listed PNG as pixels; no separate serving model identity/reviewer is exposed. CI41524792814; sourceded70205f1b5e83d2234b810e03e9f6ec3741c14; XPI036981e6a58d2f582aa556466db312e1e7adb6021dd7b34a20e1428c0584bb7a; Firefox155.0/build20260817142839/normal sandbox6. Visual artifact13179224725 ZIP SHA-256b5cd035fbf81fa61a5fde0c8e6ab66959185ad95aa7fe5d893b0519742115d43. Synthetic fixture data only.

| Original pixels | SHA-256 | Findings | Decision |
|---|---|---|---|
| `visual-only/work-deploy-wait-1280-viewport.png` | `d750203877b3372d81104310daff1756d479ba984e8dd437d77baf409d5bfe87` | Prior raw phase and Work self-link corrected. Task, wait cause and original check are legible. | Scoped PASS |
| `shared-ui/account-ready-392-viewport.png` | `c2da05c1206e7067042a25b2ff8e6da9ede7c4c0e38c39142b3e80bc62a097fb` | Account preview is bounded and groups64 matching needs-attention jobs, retaining the full67-job link. The active Accounts label clips at the left edge of the navigation scroller. | Prior flood corrected; P1 nav clipping remains |
| `visual-only/generators-392-viewport.png` | `a0eec97ee4f6c8148d7438f0e609d55cbf148d0f08f19acb99a3b69e41d81fc6` | All four filters now fit two rows and initial generator rows are visible; states and route cause are readable. | Scoped PASS |
| `visual-only/refresher-1280-viewport.png` | `651c942ad156c859ef78d9f1af807c8ba497eb5a9db016537e4e79ce239b4d7f` | Raw codes are gone, but missing-account instructions have no applicable Accounts action; cycle button/link also touch. | P1 contextual recovery action; corrected pending matching pixels |

The matched corrections close only the listed predecessor visual findings at these states/viewports. Added active-navigation reveal/resize handling and an actual contextual Accounts link plus grouped Refresher actions need fresh installed pixels. Expanded real-journey login/unknown-create/created/published-pending/DONE/AI-review/refresher-failure/disabled/paused captures are prepared on the evidence branch but NOT TESTED. Full B/V/accessibility/state coverage and exact final artifact remain BLOCKED.
