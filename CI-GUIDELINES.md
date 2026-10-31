# PCMS CI guidelines

Use [v42 §7](spec/PCMS-Working-Draft-v42.md#7-development), [design §12.2](architecture/design.md#122-future-verification-checkpoints) and [PHASES.md](PHASES.md). CI must find defects quickly. It is not a second product or a substitute for installed user journeys. This file specifies future CI; no workflow is supplied by the planning task.

## Commit and preflight

P01 introduces a fast changed-code gate and package identity check. Run syntax/build checks and focused tests for changed behavior. An unchanged installed-browser journey with a matching verified artifact/boundary need not be rerun simply because a new phase started. Select relevant critical invariants: donor-first blocked startup and intact permissions/identity; exact source/account/route scope; no replay after possible effects; package hashes/manifest integrity. Keep this set small and stable. Documentation-only changes need links/format/consistency checks, not browser suites.

Do not import Alpha's full historical donor/browser/audit harness for each push. Preserve attribution and explicit donor transformations; check changed transformations/artifact contents without repeating the completed donor research. Do not add invented fixed check names, branch protection or PR approval requirements for an unspecified destination repository.

## Phase and integration

When work crosses UI, module host, route, source, Git or persistence boundaries, run the affected built-XPI tests before calling that phase complete; choose only the journey(s) relevant to the changed contract. Use an actually qualifying Firefox build, normal OS sandbox and extension CSP, persistent installation and a dedicated clean profile. Record browser version/build and source commit/XPI SHA-256. Never weaken sandbox settings to turn an environmental failure green.

Click the visible control through its real packaged runtime. Observe independent fixture state/effect counts/bytes/history. Cover meaningful failure, double-click, interruption, stale-generation and restart cases at the boundary changed. Close the dashboard for background work. Distinguish real Firefox restart from page reload/event-page wake. Tests that inspect DOM strings alone cannot prove a task complete.

Use focused fixtures with independent expected values rather than tests that reproduce implementation reducers. Add expensive tests when their feature exists. An intentionally deferred provider test does not block unrelated coding; an unpassed required phase B/DSK test remains open.

## Release and final acceptance

P41 produces one complete candidate: all seven modules enabled, real navigation/actions, intact donor protection, no fixture endpoint/test bypass or disabled feature substitute. Use production archive bytes and actual same/fresh-profile containers for DSK. Include realistic source/history sizes, 90-day Journal volume, tracked 90-day retention, manual/unrelated-file preservation, interrupted downloads/restores and paused/closed-dashboard maintenance. S uses at least 50 account records/1,000 generators; H separately measures real route capacity.

P42–P49 place authorized H/G/P1–P5 at the latest safe point before accepting each corresponding live write path or fleet use. Use named disposable resources and only the effects authorized for them. Test secrets/sessions and credential-inclusive archives stay local/private. Public CI contains no real token, cookie, session, private route configuration or sensitive trace. No protected-main settings/credentials are invented by this plan.

The minimal trusted release check verifies that the source commit produced the tested XPI hash, expected donor-first manifest/entry and seven enabled modules, with no test bypasses/secrets. Link actual focused, B/DSK/S and authorized live results to that artifact. Do not rebuild a different artifact for delivery. After a fix, rebuild and rerun affected evidence; valid unrelated evidence can be reused with its original identity and justified unchanged boundary. Pending required live cases prevent the corresponding live/full acceptance claim, not further safe implementation.

## Change-to-test selection

| Changed boundary | Select checks |
|---|---|
| Entry/manifest/donor adapter/permissions/target binding | Fast package/scope invariants; B cold blocked start, wrong target and outage. H only for changed real-host behavior. |
| Queue/effects/Pause/leases/recording | T uniqueness/fairness/readback and dispatch race; B interruption, restart, persistent Pause and continued maintenance. |
| ZIP/ABI/sandbox/module page/lifecycle | T adversarial package/compatibility; B active generation, dirty-editor stop, stale sender, disabled work, world registration, seed/update/restore preservation. |
| Git intake/parser/tree/ref writer | T version/path/precondition and concurrent/lost-ACK cases; B caller→remote fixture history; G for changed real Git contracts. |
| Source/Creator/DEPLOY/DEVELOP/Finish | T full byte/path/source-preservation and no-replay; B exact editor/tab/chat, dirty/external edit, paused/stale Finish and completion. P1–P3 for changed live mechanisms. |
| Refresher clock/directory/marker/controller | T independent clock/order/objective/byte checks; B actual rendered fixture and guarded both-file effects; P4 when live recipes/order/rate behavior changes. |
| Core Downloads/receipt + Journal/retention | T ranges/authority/deadlines; B/DSK completed bytes, closed-dashboard/Pause/Disable, history loss, interrupted download and sentinel preservation. |
| Capture/auth/archive/donor restore | T exact coverage/schema/rotation/closure; B/DSK production file, fresh maps, early auth bootstrap, donor rollback and interrupted restore. P5/H for operational login/route claims. |
| Shared queries/navigation/forms/actions | B cross-item search, later pages, keyboard/narrow view, focus/drafts and independent action result. S when query/resource behavior changes. |
| Documentation only | Links, terminology, dependencies and consistency. No broad browser/provider jobs. |

## Fast mechanics and honest results

Cache dependencies/browser downloads by lockfile and version; avoid stale build outputs. Parallelize independent focused jobs only when useful. Cancel obsolete draft runs without discarding durable results or the current candidate's required evidence. Avoid serial waits for irrelevant historical suites. On failure, show the failing operation, expected/observed result and a short redacted trace; retain only useful artifacts.

Report T/source-fixture, B/installed Firefox, S/synthetic scale, DSK/independent disk, or G/H/P/authorized external evidence explicitly. Synthetic PASS is never LIVE. Downloads metadata is not independent disk reopen; restored bytes are not validated login; saved source is not publication or directory rank. Keep deferred checks NOT TESTED with their phase/oracle. Do not weaken a necessary test, suppress a failure or fabricate a run to get green CI.

Shared exports: the packaged Core Downloads service and its receipt ownership are not disabled with Journal. Discover result export and enabled Backup work while Journal is disabled. A disabled Journal cannot run Journal export/cleanup.
