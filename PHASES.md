# PCMS implementation phases

Planning baseline: 31 October 2026. **No implementation phase has started.**

## Authority and execution

Use [accepted v42](spec/PCMS-Working-Draft-v42.md), then [design revision 2](architecture/design.md). Preserve those input paths in the repository. This plan schedules their implementation; it does not change them. Older Alpha, Discovery and feasibility material is evidence only. Design references below mean revision 2.

Work on one phase at a time. Resume unfinished work from the latest pushed checkpoint and [todo.md](todo.md). Otherwise select the first dependency-ready phase in the order below. Backup is intentionally scheduled before Refresher once its independent dependencies are ready; no new architecture/service is needed. Dependencies mean implemented interfaces and required non-live evidence. Deferred live checks do not block unrelated coding. The implementation task prompt controls how many phases to execute.

Every phase follows checkpoint **C**: push meaningful code and `todo.md` changes to the actual GitHub remote; record the real commit and next unresolved action. Preserve jobs, inputs and uncertainty if interrupted. If no destination remote is configured, retain local work and report that publishing dependency; invent no repository or commit. No PR ceremony is required by this plan.

Development packages before P39 are incomplete checkpoints, not the final test extension. Add each feature's operating UI with that feature. Show only controls with real handlers. P37 checks shared interaction consistency; it is not a deferred UI implementation phase. All seven modules must be present and enabled in the complete candidate. Runtime holds for wrong routes, unsupported contracts or uncertain effects remain necessary; do not replace features with permanent disable flags.

## Evidence and deferred activation

All product checks below are **NOT TESTED** at this planning baseline. Use the labels from design §12.2:

| Label | Meaning |
|---|---|
| T | Focused tests of changed production code with deterministic faults and independent expected results. |
| B | Persistently installed built XPI on a Firefox build that satisfies `strict_min_version: 154.0`, normal OS sandbox/CSP, actual UI through Core to independently observed fixture effects. Record browser version/build and XPI hash. |
| S | Representative 50-account/1,000-generator synthetic load, source bytes and 90-day Journal volume. These are minimum test sizes, not product ceilings. |
| DSK | Actual production export bytes independently reopened on disk, tracked cleanup and real browser-container restore. |
| G / H | Authorized disposable GitHub operations / existing donor bridge and protected-route integration. |
| P1–P5 | Authorized Creator, source/publication, DEVELOP completion, directory/markers, and login portability respectively. These labels are not phase IDs. |

For each visible outcome, B must exercise its real packaged handler, observable effect and failure recovery. A required B is the smallest installed journey that proves the **changed** boundary; reuse valid unchanged installed fixtures/receipts and do not rerun a broad XPI suite on every code push. A DOM label or accepted RPC alone is insufficient. B may use controlled services and donor test boundaries; label these as fixtures, never live routes or providers. Record required evidence and deferred checks in the active `todo.md`, without a second tracker. An environmentally blocked required B/DSK check remains open; it is not satisfied by disabling sandbox protection. Implemented phases may have explicitly deferred live acceptance; do not call the corresponding provider behavior accepted.

Reuse the completed donor audit/41-test baseline, userScripts/CSP and sandbox lifecycle proofs, small synthetic archive/remap/recovery proof, basic Downloads proof and user-run DEVELOP transport probes. Do not rerun them. New product integration tests below test new code and packaging. The corrected exact-prompt probe does not prove substantive AI success, PCMS Finish, or restart continuity.

Live acceptance is placed after the complete installed candidate, before general use of each corresponding write path. P40 proves protected contexts before live Perchance effects; P41 proves Git writes before live folder/source/DONE writes. P42–P46 qualify their individual contracts. P47 qualifies fleet use. Before acceptance, configure only controlled fixtures or later explicitly authorized disposable targets. This testing restriction must not add recurring product approvals or disable final capabilities. No live mutation is authorized by this planning task. Later authorization must name disposable targets and allowed effects.

## Foundation and module host

### P01 — Protected packaged host

**Dependencies:** None. **Outcome/boundary:** An installable development XPI starts donor protection first and opens one dashboard. No PCMS provider work yet.

**Surface:** Design §§2.1–2.4, 12.1; packaged entry, manifest/build and dashboard shell; initial CI scaffolding.

**Tasks:** Integrate the pinned donor and proven Alpha bootstrap repairs with attribution and explicit build transformations. Keep `persona-route-manager@local`, existing native protocol/allowlist and permissions. Register listeners synchronously behind blocked admission. Set the 154.0 minimum and separate sandbox/privileged CSP. The icon focuses one tab, without a popup or legacy controller. Show the seven built-in navigation entries in order; unfinished areas have no fake controls. Add fast package/changed-code CI and artifact identity.

**Failure/recovery:** Wrong profile, existing Alpha install, unsupported browser, missing permission/bridge or failed bootstrap admits no protected work. Keep Alpha profiles intact. Do not run competing profile route mutations.

**Complete evidence:** T checks bootstrap order, package identity/attribution, CSP and permissions. B installs persistently in a dedicated clean profile on an actually qualifying build (do not use the earlier 154 beta as evidence that the packaged minimum is met), clicks the icon twice, checks one dashboard and blocked startup without a bridge. Normal sandbox remains enabled.

**Deferred:** H at P42 verifies the working host binding and cold protected tabs; live access is unnecessary for shell/package proof. **Checkpoint:** C.

### P02 — Durable records and continuous Core recording

**Dependencies:** P01. **Outcome/boundary:** Real durable records and secret-safe Home/Journal projections survive a cold restart. No queue execution yet.

**Surface:** Design §§4.1–4.2, 9, 11; IndexedDB stores, source blobs, credential boundary and shared queries.

**Tasks:** Implement schema/revisions, active dataset pointer, indexes, content-addressed chunks and full source manifests. Commit events with local state and monotonic sequence. Record all PCMS operations without sampling. Separate secret access from module/UI projections. Add stable cursor reads, draft/view persistence and Home counts with honest unknown states. Retain referenced history; collect only unreferenced blobs after capture pins release.

**Failure/recovery:** Quota, failed transaction, missing blob/reference or recording failure blocks affected writes and preserves earlier data; report the cause. No arbitrary file/byte product cap.

**Complete evidence:** T checks transaction rollback, sequence gaps, redaction and reference closure against expected bytes. B creates fixture records through packaged actions, closes the dashboard/restarts Firefox and reads them back; storage failure shows a useful error. S exercises indexed paging at minimum record counts.

**Deferred:** Larger byte/Journal load at P40, exact archive coverage at P29–P31. No live provider fact is claimed. **Checkpoint:** C.

### P03 — Shared queue, writer holds and global Pause

**Dependencies:** P02. **Outcome/boundary:** Work and global Pause/Resume operate one durable fair queue with safe effect boundaries.

**Surface:** Design §§4.2–4.4, 11; job API, dispatch arbiter, Home status and Work list/details.

**Tasks:** Add logical-key/request deduplication, expected revisions, module/account fair turns, due times, maintenance turns and typed recovery. Separate persistent generator holds from boot/generation leases. Implement BEFORE/POSSIBLE/OBSERVED per effect. Gate immediately before every adapter dispatch, including individual Git writes. Pause stops new automatic module jobs and Perchance/Git writes; preserve donor protection, read-only status, Core recording and enabled Journal/Backup maintenance. Persist Pause and show Pausing until active calls settle. Reconstruct alarms/deadlines on cold background evaluation. Add Work ordering, filters, batch results and contextual details.

**Failure/recovery:** Lost ACK/crash after intent produces read-only reconciliation, never replay or lease-expiry permission. Double clicks return the same job. Resume rechecks dependencies and coalesces missed deadlines; one failed target does not stop others.

**Complete evidence:** T fault-injects each boundary, stale revision, fairness and competing writers. B uses visible Pause/Resume during a fixture call, closes the dashboard, terminates the event page and restarts Firefox: same jobs, durable Pause, no new writes or burst. Work shows Unknown and the exact affected item.

**Deferred:** Actual Git/provider lost-ACK qualification at P43–P47. **Checkpoint:** C.

### P04 — Sandbox runner and module pages

**Dependencies:** P03. **Outcome/boundary:** One compatible fixture module runs finite background steps and a usable page through the real Core API.

**Surface:** Design §§3.2, 4.2, 11; event-page runner, RPC and shell page/action registry.

**Tasks:** Implement `PCMS.defineModule`, finite checkpoint/wait/hold/complete responses, read-only reconciliation and stop. Bind exact frame window/channel to host-held identity, hash, generation, boot and scope. Check page sender/world/container/document. Maintenance capabilities are fixed host classes; a ZIP cannot acquire Backup authority by naming it. Host sanitized local HTML/CSS/media in an opaque sandbox; privileged code remains packaged. Add Other, same-page pinning before Settings, module-only secondary menus and persisted drafts. Page failure offers Open Modules.

**Failure/recovery:** Reject forged null-origin messages, stale/wrong-target requests, raw browser/native/fetch access and undeclared operations. Rebuild runner state after suspension; no endless keepalive. Page closure cannot own a job.

**Complete evidence:** T tests capability denials and bindings. B clicks a module control, observes its fixture effect with dashboard closed, wakes a terminated event page, and checks page error, keyboard/narrow navigation and preserved drafts. This tests the new host, not generic sandbox feasibility again.

**Deferred:** Dirty live-editor teardown at P07 B and P46 P3; no provider effect here. **Checkpoint:** C.

### P05 — Local ZIP selection and validation

**Dependencies:** P04. **Outcome/boundary:** Settings → Modules installs a valid selected local ZIP and opens its working page without reinstalling PCMS.

**Surface:** Design §§3.1, 11.2; package parser/store, validation errors and Install control.

**Tasks:** Implement exact manifest/ABI/capability validation, complete payload list, original ZIP/manifest hashes, strict release versions and compatible job/settings schemas. Stream inflation with declared resource budget/quota handling. Reject duplicate keys, unknown fields, missing/hash/CRC/size errors, unsafe/colliding paths, symlinks, encryption and undeclared dependencies. Identical bytes are a no-op; changed same-version bytes and silent downgrade are rejected. No marketplace, remote code or extra ZIP approval.

**Failure/recovery:** Candidate validation is side-effect-free; keep active package, jobs and form input on every import failure. ZIPs cannot add host permissions or secret-reading capabilities.

**Complete evidence:** T tests malformed/adversarial archives and actual accepted payload bytes. B selects files with Install, opens the installed page, reaches a real fixture action and sees precise validation/quota errors without registry damage.

**Deferred:** Safe replacement/rollback is P07; selected local development distribution makes no signed/public acceptance claim. **Checkpoint:** C.

### P06 — Bundled first-install module seed

**Dependencies:** P05. **Outcome/boundary:** First installation seeds seven compatible first-party packages, enabled by default, without overwriting later user choices or restored data. Advanced lifecycle is P07.

**Surface:** Design §§2.3–2.4, 3.3, 11; bundled package resources, initial registry transaction and Settings → Modules.

**Tasks:** Package Accounts, Discover, Creator, Deployer, Refresher, Journal and Backup as valid locally bundled packages. Atomically register their exact hashes/versions, enabled state and first-install marker. Their functional workflows are implemented in later slices; no fake operational controls are exposed. On restart, extension update or restore, preserve existing user-selected ZIP versions, settings, disabled state and module records without reseeding. Show the installed/enabled packages in Modules and render only functional module views.

**Failure/recovery:** Failed or interrupted seed is a durable uncommitted transaction, never a partially enabled fleet. Restart finishes the same initial seed if absent; it does not silently reactivate disabled packages or overwrite restored versions. Existing jobs/settings are not deleted.

**Complete evidence:** T verifies atomic seed, exact package hashes, no repeated/overwrite seed, and interruption. Targeted B installs the built XPI, checks seven enabled packages and working Modules management, restarts and performs an in-place extension update without resetting the registry. No product module workflow is claimed implemented.

**Deferred:** ZIP update/Disable/Enable, dirty-editor teardown and generation handoff are P07. **Checkpoint:** C.

### P07 — Safe module update, disable and cold recovery

**Dependencies:** P06. **Outcome/boundary:** One module generation operates at a time. Manually selected ZIP updates, Disable/Enable and restart preserve unfinished jobs, existing human edits and settings.

**Surface:** Design §§2.4, 3.3, 11; stage/fence/stop/switch lifecycle, website disposer and permission recovery.

**Tasks:** Validate and stage a compatible update using P05. Stop new admission; drain finite effects or hold Unknown; revoke old-generation Core requests; unregister future userscript injection; STOP existing page instances and collect disposer receipts; tear down old runner/UI frames; switch active package/version atomically; rebuild runners, userscript worlds, schedules and UI. Preserve editor text, AI context, undo, form drafts and job provenance. Implement Enable/Disable and the exact Firefox userScripts-permission action; maintain disabled state through restart. Retain incompatible jobs, and roll back only where the retained package can read current records. Do not duplicate routing, Core recording or background services.

**Failure/recovery:** An uncooperative/dirty editor or active AI session holds replacement with **Open affected editor** or **Continue review**, without destructive reload. Crash/restart continues the same lifecycle record. Effects remain fenced while a stop receipt is missing. Disabled module code/pages/jobs stay stopped; mandatory Core recording continues, and enabled Journal/Backup still operate during global Pause.

**Complete evidence:** T injects crashes at stage/stop/pointer/rebuild and checks schema compatibility and no dual generations. A *targeted* installed-XPI B journey updates one fixture module with an unfinished job and dirty editor, checks old-message rejection, no lost draft, Disable/Enable, denied permission and restart recovery. Reuse unmodified P04/P05 evidence; do not rerun their full browser suite.

**Deferred:** P46 checks safe teardown in the real retained AI editor. **Checkpoint:** C.

## Journal, accounts and Git

### P08 — Searchable Journal and completed exports

**Dependencies:** P07. **Outcome/boundary:** Enabled Journal searches Core events and exports checked sequence ranges from Settings, without an open dashboard.

**Surface:** Design §§9, 11; Journal module, packaged Core-owned Downloads adapter and Settings → Journal.

**Tasks:** Build the shared packaged Core Downloads/owned-file service, callable by enabled modules independently of Journal enabled state. Add Journal search/filter/details, manual range export, initial retained-range then incremental exports, count/hash/gap metadata and durable completion watermark. Schedule the 30-minute default with no missed-export burst. Persist pending unique filename/receipt before download; await completion and byte count. Settings shows interval, destination, last result and Export now. Automatic files use the safe relative PCMS Downloads subfolder.

**Failure/recovery:** Missing ACK reconciles exact download identity/path/time/size; ambiguity is visible. Failed export pins unexported records beyond age pruning, preserves watermark and earlier files. Disabled Journal offers Enable, does no Journal search/export and does not stop Core recording or the Core Downloads service. Discover exports and enabled Backup continue.

**Complete evidence:** T checks ranges, gaps, redaction and coalesced scheduling. B/DSK clicks Export now, reopens actual ZIP bytes independently, then proves scheduled exports during global Pause/dashboard closure, disabled suppression, restart and interrupted download recovery. Test unwritable destination and real/simulated Downloads errors honestly.

**Deferred:** Large volume and download interruption at P40/P41; Backup reuses the same packaged Core adapter at P31, even when Journal is disabled. No live check needed. **Checkpoint:** C.

### P09 — Owned-file retention and cleanup recovery

**Dependencies:** P08. **Outcome/boundary:** Automatic Journal retention removes only eligible owned files after a new complete export; the Core-owned shared file-receipt/retention service can also serve enabled Backup without depending on Journal.

**Surface:** Design §9; file receipts, local Journal pruning, Settings retention/result status.

**Tasks:** Implement configurable 90-day local/disk retention, unexported-event pins and per-file cleanup state. Keep the Core file-receipt/download-delete primitives independent of Journal enablement; do not run Journal-specific cleanup while Journal is disabled. Use `downloads.removeFile` before history erasure. Require current profile receipt and matching DownloadItem. Preserve manual/unrelated files, imported source-profile IDs and earlier complete files on failed export. Expose Cleanup needs attention and actual space errors; never shorten retention automatically.

**Failure/recovery:** Cleared history, moved/replaced file, ambiguous ID or delayed `exists` metadata yields a tracked hold. No filename glob or guessed deletion. Resume known cleanup steps after restart.

**Complete evidence:** T boundary tests include age/configuration and receipt authority. B/DSK uses owned expired, manual and unrelated sentinel files, failed new export, cleared history and delayed removal; independently inspect surviving disk bytes. Use a controlled clock, not a wait for retention expiry.

**Deferred:** Backup-specific previous-complete rule and its actual files at P31/P34. **Checkpoint:** C.

### P10 — Add Account through a protected Persona

**Dependencies:** P07. **Outcome/boundary:** Add Account → login → Confirm creates a durable managed account only after post-Confirm identity and route checks.

**Surface:** Design §§5.1, 6.1, 11; narrow donor adapter and Accounts enrollment/list/detail.

**Tasks:** Adapt proven Persona/binding/open/repair primitives, without a second route model. Persist enrollment before setup; protect navigation before opening login. After Confirm, check current principal, Persona/container, donor verified route and canonical unique exit. Reserve bindings across archived accounts too. Show Complete login/Confirm/Repair route in place. Open Perchance uses the exact verified context.

**Failure/recovery:** Missing bridge/permission, challenge, unknown identity, duplicate Persona/exit or changed principal holds enrollment/account only. Use existing repair; never Direct or silent rebinding. No credential entry automation or account registration.

**Complete evidence:** T checks uniqueness, interrupted setup and target tuple. B drives all enrollment controls against independently attributable donor/site fixtures, including duplicate Confirm, wrong container and restart. Readiness cannot be shown from a pre-Confirm check.

**Deferred:** H P42 proves the existing bridge with two accounts before any real protected-account acceptance; 50-account H at P49. **Checkpoint:** C.

### P11 — Account lifecycle and contextual recovery

**Dependencies:** P10. **Outcome/boundary:** Accounts Archive/Reactivate/Remove operate safely and leave remote generators untouched.

**Surface:** Design §§6.1, 11; account fencing, removal progress/tombstones, account filters and generator/job links.

**Tasks:** Archive blocks admission and drains effects; Reactivate checks identity/route and reconciles jobs. Confirm local Remove once, then remove local credentials/session/Persona through donor services. Retain only secret-safe unresolved-effect tombstones and owner-missing generator history. Add count links, fresh observation times, per-account repair and stable search/selection.

**Failure/recovery:** Interrupted removal resumes its same steps; unresolved external work remains attributable without usable deleted credentials. Never transfer a generator silently. Slow repair must not disable unrelated safe controls/accounts.

**Complete evidence:** T checks archive races, reservations and local deletion scope. B clicks each lifecycle action, denies/remembers confirmation, restarts partial removal, and checks fixture remote inventory/source unchanged and other accounts usable.

**Deferred:** H/P5 at P42/P48 verifies actual route/login behavior, including restored/reactivated accounts. **Checkpoint:** C.

### P12 — GitHub connection and incremental catalog

**Dependencies:** P07. **Outcome/boundary:** Connections configures one repository/main and Generators shows complete folder-only records from read-only observation.

**Surface:** Design §§5.3–5.4, 11; credential-isolated Git reader/catalog and Connections UI.

**Tasks:** Configure repository identity/token once; Reconnect validates read access without exposing the token. Parse exact four-field `PCMS-1` markers, with v1/DEVELOP/NOT_READY defaults only for future creation. Poll main initially every 60 seconds, conditional requests/backoff, immutable SHA cache and changed subtrees. Traverse truncated trees with saved cursors; never apply incomplete scans as deletion. Show marker errors with the affected folder.

**Failure/recovery:** Missing main, auth/ruleset/rate-limit failures are not empty catalogs. Keep drafts/previous observations, saved scan position and precise reconnect action.

**Complete evidence:** T uses malformed markers, moves and truncated multi-page trees. B saves/reconnects Settings, reaches actual fixture catalog rows and errors, restarts an incomplete traversal and preserves filters. S checks 1,000+ folders and no unchanged-input rereads.

**Deferred:** Actual permissions/history/read limits are checked in G P43; do not infer write access from read success. **Checkpoint:** C.

### P13 — Scoped conditional Git writes

**Dependencies:** P12. **Outcome/boundary:** Packaged Git operations conditionally prepare folders/write source/mark DONE without altering protected paths or replaying uncertainty.

**Surface:** Design §§5.3–5.4; per-repository writer, object/ref effects and exact generator/folder recovery views.

**Tasks:** Require allowed paths and observed input/affected SHA maps. Base each tree on current head, preserve modes/unrelated paths/root instructions, delete only previously owned obsolete source. Parent the candidate to observed H, persist its identity/trailer, recheck main and use `force:false`; no invented REST `expected_sha`. Check Pause for every object and ref write. Independently verify reachability, tree/blobs and preservation before completion.

**Failure/recovery:** Lost object/ref ACK inspects content-addressed objects and candidate ancestry. Relevant edits/history rewrite hold; an unrelated ordinary commit can permit a freshly checked base only after attribution resolves. No duplicate logical commit or forced repair. UI opens the exact held folder/job.

**Complete evidence:** T injects each lost response, concurrent relevant/unrelated edit and rewrite. B exercises packaged writer via a controlled scoped operation and its Work recovery; independent fixture history/tree inspection proves outcome and preserved bytes.

**Deferred:** G P43 is required before real Git writes; later module B journeys prove their actual callers. **Checkpoint:** C.

## Discover and Creator

### P14 — Persistent slug checking

**Dependencies:** P08, P10, P12. **Outcome/boundary:** Generators → Check slugs imports, checks, pauses/resumes and exports a durable Discover batch; no Git/provider mutations yet.

**Surface:** Design §§5.3, 6.2, 11; classifier, protected one-tab observation and Discover page.

**Tasks:** Use the shared Core Downloads export service for result files; Journal module state does not gate Discover exports.  Preserve rejected names/normalization collisions and dates. Process one slug at a time, initial two-second completed-check interval and backoff. Match both accepted messages exactly except layout whitespace. Detect actual generator output including required frame content; an iframe shell is insufficient. Implement Import list/Start/Pause/Resume/Export results using saved rows and real Downloads receipts.

**Failure/recovery:** Partial/changed text, inaccessible/empty frame, challenge, conflicting evidence or transport error is Unknown unless independent actual content proves Taken. Unknown stops this batch until user Resume. Do not recheck completed rows automatically. Global Pause dominates.

**Complete evidence:** T includes exact Unicode/punctuation/typo/link-text messages and changed/partial variants. B drives all batch controls through the packaged classifier against rendered fixtures, including a framed generator, export bytes, restart and preserved input/selection.

**Deferred:** P1 P44 qualifies current native slug rules/messages/framed pages; current fixtures do not assert live availability. **Checkpoint:** C.

### P15 — Available slug to verified Git folder

**Dependencies:** P13, P14. **Outcome/boundary:** Available results automatically create only a non-ready `DEPLOYMENT.md` on main and appear as pending generator rows.

**Surface:** Design §§5.3–5.4, 6.2; Discover folder-preparation job, Generators status and batch receipts.

**Tasks:** Conditional folder absence is required. Write exactly Format/Version/Action/Status with the selected defaults; read it back on main. Link the existing batch observation and folder job. Show per-item preparation result without restarting checks. Taken/Unknown produces no folder. No source files or empty placeholder source.

**Failure/recovery:** Existing folder/unrelated contents are preserved; lost Git ACK reconciles the same operation. A failed preparation retains Available plus its date and recovery cause; it does not reserve the slug or create on Perchance.

**Complete evidence:** T tests races and byte-exact folder contents. B starts from Check slugs, observes one independent fixture commit and resulting folder-only row, then faults preparation/restarts and verifies no overwrite or duplicate.

**Deferred:** G at P43, then current classifier/Creator journey at P44. **Checkpoint:** C.

### P16 — Owner adoption and durable allocation

**Dependencies:** P11, P15. **Outcome/boundary:** Creator automatically adopts an affirmative managed owner or reserves an eligible account for a pending folder. No new remote creation yet.

**Surface:** Design §6.3; targeted protected ownership observations, allocations and pre-dispatch account selection in Generators.

**Tasks:** Intake valid folders regardless of NOT_READY. Search bounded target-specific managed-account ownership/inventory through verified contexts; cache attributable affirmative evidence. Adopt exact principal/stable ID/slug with no mapping conflict and no source/listing edit. Otherwise reserve minimum owned + pending allocations, stable account-ID tie break. Allow eligible user override before dispatch. Persist one reservation/job.

**Failure/recovery:** Foreign/conflicting owners hold this target. Incomplete account inventory is Unknown for that account, not negative proof. Absence of affirmative ownership is not a creation veto: P17 separately requires current Available. Keep other jobs/queue turns moving.

**Complete evidence:** T covers concurrent balancing, archived reservations, override races and unknown inventory. B observes an externally owned fixture generator absent from local records, adopts it, verifies unchanged source/listing, and operates account override/restart without double allocation.

**Deferred:** P1 P44 verifies actual remote adoption and current native ownership evidence. **Checkpoint:** C.

### P17 — One-shot unlisted creation and rename

**Dependencies:** P16. **Outcome/boundary:** A valid folder automatically becomes one verified unlisted generator at the requested slug under its allocated owner.

**Surface:** Design §§5.1–5.2, 6.3; private-template create/rename, generator facts and Inspect created generator recovery.

**Tasks:** Reclassify the exact slug immediately before creation; only Available admits it. Qualify empty source-manifest shape in the adapter. Use the private template, never a user's editor. Record pre-create inventory/template fingerprint, one temporary stable identity and one final rename; read back owner, stable ID, final/old slug and unlisted status. Convert reservation into ownership and notify the waiting job.

**Failure/recovery:** Lost create ACK inspects the same account/inventory and candidate identity. Lost rename ACK examines both names for the same ID. Ambiguous result retains reservation/hold; no second create, name substitution or blind rename. Taken/reserved/Unknown writes nothing.

**Complete evidence:** T covers name race, schemas and effect interruption. B runs folder → allocated protected fixture create → rename → Generators result, injects both ACK losses/restart, and independently checks exactly one remote identity and no existing-source changes.

**Deferred:** P1 at P44 before real Creator writes; the wire shape accepted by fixtures is not live proof. **Checkpoint:** C.

## Source and Deployer

### P18 — Complete source inventory and editor inspection

**Dependencies:** P10, P12. **Outcome/boundary:** Generator details can inspect independently read server source, all editor documents and previous-good bytes without writing.

**Surface:** Design §§4.1, 5.1–5.3; packaged source observer, manifests and contextual Open editor/source comparison.

**Tasks:** Map main model/template to `main.pjs`/`index.html`; enumerate every `src/` path including binary files/deletions. Fetch bytes, not CDN pointers. Preserve valid provider-supported path spelling/Unicode/newlines; reject traversal and actual collisions without inventing an ASCII allowlist. Detect dirty editors, pending files and collaboration across documents. Persist newly admitted saved bases and prior history. Diagnose LFS pointers rather than treating them as resolved assets.

**Failure/recovery:** Incomplete enumeration, unsupported name/schema, owner/revision mismatch or dirty editor is visible at this generator. No reload of an active AI editor and no source mutation.

**Complete evidence:** T compares complete sets, binary hashes, deletion and path cases. B opens the exact protected fixture editor, detects another dirty document and reads all source independently; restart retains source snapshots and list context.

**Deferred:** P2 P45 qualifies current filename fidelity and complete provider readback. **Checkpoint:** C.

### P19 — Guarded source effect and readback

**Dependencies:** P18. **Outcome/boundary:** One shared save path preserves human work and resolves a candidate only from full server readback.

**Surface:** Design §§4.3–4.4, 5.1–5.2; writer hold, native source-save adapter and source-conflict recovery.

**Tasks:** Acquire writer; verify target/route, full base/revision and every editor before dispatch. Save through feature-detected native mechanism with top-level `srcManifest`; use provider revision conflict handling. Store candidate/previous-good and independent full bytes/revision receipts. A previous-good restore uses these same guards and never relists automatically. Modules supply candidates; Core does not become a deployment workflow.

**Failure/recovery:** External revision race, unknown save, manual/collaboration divergence or missing stale-write enforcement holds the writer. A local lease cannot protect against other devices. Never force clean state or repair by overwriting a new base.

**Complete evidence:** T injects stale revision, mid-save external edit and recording failure. B invokes the packaged save against a controlled source service, checks all stored bytes and another dirty editor, then crashes after dispatch and reconciles without a second save. Exact conflict UI preserves both snapshots.

**Deferred:** P2 P45 must establish current remote stale-write behavior before live source changes. **Checkpoint:** C.

### P20 — READY intake and safe update preparation

**Dependencies:** P12, P17, P19. **Outcome/boundary:** Deployer automatically prepares the correct READY version, waiting on the same Creator job before acquiring a Deployer writer claim, without editing source yet.

**Surface:** Design §§5.3, 6.4; version/input identity, common preparation and generator/Work state.

**Tasks:** Pin commit/action/input hash; key by repository/generator/version. Reject VERSION_REUSED with changed action/inputs; do not loop on PCMS commits or external unverified DONE. Supersede only before effects; withdrawal blocks subsequent effects. If the generator does not yet exist, persist WAIT_CREATOR and the dependency/job hold **without** acquiring a Deployer source-writer claim or unlisting/editing anything. Creator retains its own create/rename effect fences until stable remote ID and owner are verified; its Unknown holds remain attributable and cannot be cleared by Deployer. Only after Creator completes/adopts the same remote identity does Deployer acquire its source-writer claim, preserve full previous-good and remove Refresher eligibility. Then verify unlisted before any staging/source edit. Show wait/preparation/conflict with exact links.

**Failure/recovery:** Unknown unlist means no edit. A new READY during AI/possible effects waits for reconciliation; old DONE must not overwrite it. Failed updates remain unlisted. No extra manual Start or third update mode.

**Complete evidence:** T tests intake repetition, version conflicts/withdrawals, out-of-order markers and READY-before-Creator lock ordering (Creator PASS and Creator Unknown). Targeted B observes automatic READY → wait/create → verified remote identity → claim → prepare on fixtures. Assert Creator can acquire its creation fence while Deployer waits, no source claim exists during WAIT_CREATOR, Unknown Creator never unlocks source, unlist precedes source changes, and restart preserves holds/history without starting a completed version.

**Deferred:** G/P2 at P43/P45 verify real Git and listing contracts. **Checkpoint:** C.

### P21 — DEPLOY selected complete source

**Dependencies:** P20. **Outcome/boundary:** A DEPLOY job saves exactly its pinned Git source version; publication is the next receipt chain.

**Surface:** Design §6.4; DEPLOY handler and generator source/version status.

**Tasks:** Read full pinned `main.pjs`, `index.html`, applicable `src/` set and deletions; invoke P19 after rechecking current READY/input/base/owner. Save and independently verify complete server source. Reuse the same path for first version and update. Show Saved — publication pending rather than Published/DONE.

**Failure/recovery:** Changed relevant Git inputs, dirty editor, lost save response or mismatch holds this generator with compare/inspection. Keep previous-good; never relist failed/uncertain source. Other jobs continue.

**Complete evidence:** T verifies pinned-input fidelity and complete set changes. B starts from real packaged catalog intake through protected fixture save, closes/restarts dashboard/browser, independently inspects bytes and proves no manual save requirement or write to another generator.

**Deferred:** P2 P45; DEPLOY has no human review approval. **Checkpoint:** C.

### P22 — Publication, Refresh Pool and DONE

**Dependencies:** P13, P21. **Outcome/boundary:** Verified source becomes public, joins the pool and gets exactly matching-version DONE, with separate honest partial states.

**Surface:** Design §§5.2–5.4, 6.4; common Deployer completion, publication/pool receipts and Generators/Work results.

**Tasks:** Recheck source/current READY identity before listing. Independently verify public/listed state, then transactionally upsert pool membership tied to source/publication receipt. Initialize a pending cycle for P35. Only then conditionally commit/read back matching DONE. Release writer after all uncertainty resolves. Use the same completion service for DEVELOP later.

**Failure/recovery:** Unknown publication observes the exact remote ID/source. Existing pool receipt repairs locally without republishing. DONE denial shows Published — Git completion pending and resumes Git only. Listing/pool/DONE are never inferred from save ACK or public-page load alone.

**Complete evidence:** T faults every boundary and version race. B runs automatic DEPLOY to completion through packaged UI/runtime and independent fixture source/listing/Git history; restart after publication/before DONE proves no repeated publication. Failed update stays unlisted.

**Deferred:** G/P2 P43/P45; directory position is measured separately at P36/P47. **Checkpoint:** C.

### P23 — DEVELOP instruction staging

**Dependencies:** P20. **Outcome/boundary:** DEVELOP safely stores and verifies its three exact `src/` instructions while preserving existing source. No AI send yet.

**Surface:** Design §§5.3, 7.1 PREPARE/STAGE; Deployer handler, pinned input/source records and Work progress.

**Tasks:** Read all four distinct root inputs. Copy only specification.md/ui.md/agents.md into `src/` through P19, after verified unlisting. Preserve all other source. Read back the three files plus the full admitted set. Keep root inputs immutable; prompt.md is sent later, not staged automatically.

**Failure/recovery:** Missing/invalid text, root-input change, staging collision/manual divergence or unknown save retains snapshots and typed hold. Resume observation of the same save, not a blanket restage.

**Complete evidence:** T uses distinct Unicode/newline inputs and preexisting binary src. B drives automatic DEVELOP intake to a verified staging checkpoint, injects interruption and independently checks full fixture source and untouched Git originals.

**Deferred:** P3 P46 tests the new integrated representative task. The existing three-file userscript transport proof is accepted and is not rerun. **Checkpoint:** C.

### P24 — Native chat and exact one-shot prompt

**Dependencies:** P23. **Outcome/boundary:** The job opens one fresh native chat, sends exact prompt text once and reserves its protected editor tab.

**Surface:** Design §§7.1 NEW_CHAT/SEND/AI_RUNNING, 7.2–7.3; native adapter, tab binding and Work context.

**Tasks:** Verify the fresh-chat transition/reference, not just a click. After native input handling compare raw decoded text and UTF-8 digest without trimming. Persist each possible effect immediately before new-chat/send; no queued extra message. Bind job/account/Persona/remote ID/document/chat. Retain the tab with dashboard closed. Active automation slots and human-review tabs have separate budgets; queue on actual resources without recycling review tabs.

**Failure/recovery:** Unknown send/chat, reload/close/navigation or browser restart holds same-job inspection. No resend or fresh-chat recovery button. Definite before-send failure alone can retry its untouched step. Journal stores hashes/digests and boundaries, never prompt/chat capabilities.

**Complete evidence:** T checks exact bytes, double dispatch and tab binding. B uses native-shaped controlled UI through production adapter, independently counts sends/new chats, closes dashboard/restarts Firefox and proves no automatic second send or tab reuse. P25/P40 test parked review capacity after review states exist.

**Deferred:** P3 P46 tests actual integrated native handoff, not another diagnostic probe. **Checkpoint:** C.

### P25 — Readiness and same-chat review recovery

**Dependencies:** P24. **Outcome/boundary:** Work/Generators open the correct chat and distinguish terminal success, stopped, failed and Unknown review paths.

**Surface:** Design §§7.1–7.3, 11.2; terminal/application observer, Review in Perchance and Check AI Helper.

**Tasks:** Attribute native terminal state to this chat/run and await settled file/editor application and empty send queue. Idle alone remains AI_UNKNOWN. Permit bounded human readiness only after revalidated target/chat, no observed active run, two separated stable source/editor observations and no pending write/unrelated conflict. Record HUMAN_VERIFIED_READY, not AI success. Expire it on any relevant change. Focus exact bound target/chat; missing state opens protected inspection without a new chat. Cancel fences future effects and retains work; active AI needs Stop AI in editor and observed settlement.

**Failure/recovery:** Wrong chat/late writes/unstable samples prevent readiness. Reload/restart/update retains inspection hold. Pause cannot undo native AI or discard its tab. Unknown source effects cannot be overridden by an attestation.

**Complete evidence:** T enumerates terminal/fallback cases. B clicks both review/recovery controls and Cancel; verifies correct tab, inactive-stable fallback eligibility, active/stopped-unsettled denial, late-write revocation and restart continuity. Preserve at least three parked review tabs without consuming active automation slots or imposing a two-review cap.

**Deferred:** P3 P46 qualifies current native terminal evidence or this bounded fallback. No dependency on a new AI engine or conversation backup. **Checkpoint:** C.

### P26 — PCMS editor Finish and accepted-source save

**Dependencies:** P25. **Outcome/boundary:** The PCMS-owned editor button accepts an exact reviewed candidate and safely saves it without a separate user save.

**Surface:** Design §7.2 and SAVE_ACCEPTED; packaged editor-chrome control, acceptance records and paused completion UI.

**Tasks:** Attach outside CodeMirror/src/output/saved HTML; module supplies state, packaged listener supplies authority. Revalidate caller/generation/target/chat and capture all root/pending src bytes, revision and acceptance ID. Briefly prevent edits without losing undo. Ordinary attributed success needs one click; eligible Unknown uses one explicit readiness attestation within this action. Revoke/hide on navigation or fence. Pause records Accepted — PCMS paused, no writes; Resume rechecks exact hash/revision before P19 save/readback.

**Failure/recovery:** Double click reuses acceptance. Capture race, AI/human late edit or stale version keeps both snapshots and requests review; acceptance does not approve new bytes. No token in DOM and no source injection.

**Complete evidence:** T tests authority/staleness. B clicks the actual packaged button in an editor fixture, confirms full server bytes and no button in source/output. Exercise paused click, changed-source Resume, duplicate click, wrong document and late AI write without manual save/publication.

**Deferred:** P3 P46 verifies this new control against actual Perchance. **Checkpoint:** C.

### P27 — DEVELOP source writeback and completion

**Dependencies:** P22, P26. **Outcome/boundary:** One accepted DEVELOP result automatically completes Git source → publication → pool → DONE.

**Surface:** Design §§5.4, 7.1 GIT_SOURCE–DONE, 7.3; Deployer completion and generator/Work receipts.

**Tasks:** Write complete accepted/saved source to the same Git folder via P13. Preserve all four root originals/unrelated entries and only delete obsolete owned source. Verify exact output before P22. Recheck Perchance source against acceptance and Git before publication. Support updates using the same sequence, and retain diagnostics across dashboard/tab/browser loss.

**Failure/recovery:** Git conflict or source drift holds before publication. Source commit success is not publication; publication success is not DONE. Resume the first unfinished receipt, including Git-only completion after listing; never restage/rechat/resend to recover.

**Complete evidence:** T faults completion edges. B starts from READY with distinct instructions, goes through review/Finish to full independent fixture receipts, tests first version/update and interruption, and verifies originals, accepted bytes, listing, pool and version. No hidden manual steps.

**Deferred:** G P43 and P3 P46 are required for live acceptance. **Checkpoint:** C.

## Backup and restore

### P28 — Scoped authentication and cookie collectors

**Dependencies:** P11. **Outcome/boundary:** Packaged collectors report exact required managed-session coverage without exposing secrets or copying AI/site workspaces.

**Surface:** Design §§10.1–10.2; donor cookie service, `perchance-auth-1` and Settings → Backup coverage.

**Tasks:** Capture schema-checked top-level app-storage.user authentication subrecord plus session-change guard, not the whole document. Enumerate managed Persona cookies across partition/FPI dimensions with exact attributes/session/expiry identity. Record absent/not-required separately from failed/unknown collection. No new broad IDB/OPFS collector. Preserve raw secrets only inside privileged capture data. Show unavailable account/schema as incomplete and exact context/times, never credentials.

**Failure/recovery:** Rotation, inaccessible origin, unknown schema or unestablished required auth key prevents complete coverage. Bounded retries may stage fresh data; stale cache is labeled stale. Never replace a development/review tab for collection.

**Complete evidence:** T uses scoped fixtures with rotation, unexpected schema, partitions, expiry and binary secret-byte fidelity. B reads actual fixture origin/cookies in protected container contexts and shows secret-safe coverage/error UI. Assert unrelated origins/AI stores are untouched.

**Deferred:** P5 P48 qualifies current login inventory and real sessions; source-grounded keys are not yet exhaustive live proof. **Checkpoint:** C.

### P29 — Consistent complete capture cut

**Dependencies:** P28, P07. **Outcome/boundary:** Back up now freezes one immutable checked PCMS/donor/auth capture, or reports exact missing coverage. Archive encoding follows P30; browser download follows P31.

**Surface:** Design §§10.1, 10.4; capture coordinator, donor portable-state inventory and Backup progress.

**Tasks:** Inventory all Core records/drafts, jobs/effects/acceptance, installed/staged packages/settings, source/history blobs, retained Journal, credentials and all donor-owned extension data. Stage bounded per-account auth/cookie reads before the short Core/donor barrier. Track principal/session/storage-change provenance; join to checked revisions or mark incomplete. Pin blob references, include possible effects, release barrier once immutable cut exists. Record individual collection times and external prerequisites. Exclude older disk backup/export bytes, live leases and AI workspaces.

**Failure/recovery:** Unavailable/unstable participant, donor revision failure or missing reference releases only this barrier, preserves Pause/writer holds and last complete backup, and names missing data. Do not hold Core while opening 50 origin contexts or waiting for human review.

**Complete evidence:** T verifies declared coverage/reference closure with missing credentials/blobs and concurrent changes. Targeted B exercises the installed production capture coordinator through a controlled test harness and observes its real Settings → Backup progress, session rotation, closed-origin failures and immutable capture against Core/donor revisions while other jobs continue. Do not expose **Back up now** as a successful disk-export action until P31 supplies it. S measures collection and barrier behavior for 50 participants.

**Deferred:** Actual auth consistency at P48 and host collection load at P49; encoding/disk completeness at P31. **Checkpoint:** C.

### P30 — Portable backup archive codec and coverage validation

**Dependencies:** P29. **Outcome/boundary:** A completed immutable capture can be encoded as one unencrypted, credential-inclusive, self-contained ZIP and independently parsed/validated without any browser Downloads action.

**Surface:** Design §10.3; versioned archive format, streaming/chunking, ZIP64 when required, manifest and COMPLETE marker.

**Tasks:** Encode full captured Core, module ZIPs, donor extension state, scoped auth/cookies, credentials, source/history and Journal references using direct binary entries, not giant base64 JSON strings. Record prerequisite disclosures, exact sizes/digests, schema versions, closure and sequence gaps. Validate CRC, entry SHA-256, completion marker, duplicate/unsafe paths, ZIP bounds, compatibility and required fields before declaring complete. Preserve original bytes and diagnose partial/incomplete captures honestly. Use a packaged, maintained ZIP codec; no new archive framework or native process.

**Failure/recovery:** An invalid/missing section, corrupted bytes, incomplete capture, excessive size/quota or interrupted encoding cannot become a complete archive. Preserve pinned source and the previous usable backup; no user-facing success or remote mutation is inferred from a created Blob.

**Complete evidence:** T checks round-trip with independent expected bytes, missing required secrets/blobs, corrupted/duplicate/traversal entries and incompatible schemas. Targeted production-code archive tests cover large/binary payloads and ZIP64 path without forcing a full browser/download/restore suite at this stage.

**Deferred:** Manual browser disk export and Settings UI are P31; staged restore is P32–P34. **Checkpoint:** C.

### P31 — Manual Backup export and shared Downloads integration

**Dependencies:** P30, P09. **Outcome/boundary:** **Back up now** produces an actual checked, unencrypted production archive under Firefox Downloads, with a durable receipt and safe last-good preservation.

**Surface:** Design §§9–10.3, 11; enabled Backup UI, Core-owned Downloads service, file receipts and manual/automatic ownership records.

**Tasks:** Connect the P30 codec to the shared packaged **Core Downloads adapter** built in P08; it must not depend on Journal being enabled. Export outside the short P29 capture barrier. Use unique recorded relative filenames, durable pending/completion receipts, Firefox download completion/byte count and independently verifiable archive contents. Show coverage, destination, last complete result and unencrypted credential notice. Preserve all manual files and earlier complete backups; configure a safe PCMS subfolder. Apply common receipt-aware retention primitives without performing disabled-module operations.

**Failure/recovery:** A download/ACK/quota/disk failure retains previous complete files and the capture evidence. A lost download ID uses exact identity reconciliation; an ambiguous file remains held, never declared success or deleted by filename guess. Disabling Journal does not disable Backup export; disabling Backup stops this action. No claims of independent physical disk reopen from extension metadata.

**Complete evidence:** T validates receipt authority, target filename, disabled Backup/Journal separation and failed download recovery. Targeted B/DSK clicks **Back up now**, independently reopens actual production disk ZIP bytes and checks all declared sections, malformed/partial status, interruption and preservation of manual/unrelated sentinel files. Reuse P30 codec tests instead of rerunning the entire ZIP corpus.

**Deferred:** Same/fresh-profile restore is P32–P34, six-hour schedule/restart and 90-day Backup cleanup are P34; live login portability is P48. **Checkpoint:** C.

### P32 — Staged dataset and donor restore

**Dependencies:** P31. **Outcome/boundary:** Restore preview/confirmation stages a replacement with a durable fresh-container map and recoverable previous cut. No write admission yet.

**Surface:** Design §10.5 steps 1–3/5; archive importer, dataset generations, donor restoration and Backup restore UI.

**Tasks:** Validate complete archive before restoration writes, including embedded package compatibility and reference closure. Preview coverage/age/secrets/prerequisites; confirm replacement once. Persist maintenance/source/Git hold and previous-good checkpoint. Allocate fresh destination containers on same-device and fresh-profile paths; persist logical Persona/source/destination map per step. Restore donor extension data through existing services, remap all references and invalidate runtime route/lease/tab authority. Keep old dataset/containers isolated.

**Failure/recovery:** Dirty/active AI editor requires exact contextual safe-stop/inspection, not reload. Crash resumes the same mapping without duplicate containers. Pre-switch failure keeps prior cut under maintenance until original donor bindings are safely recovered; an IDB pointer alone is insufficient rollback.

**Complete evidence:** T rejects corrupt/missing/incompatible archives before writes. B/DSK selects a real production archive, interrupts after actual container/donor changes on same and fresh profiles, and verifies durable mapping, prior cut and safe donor rollback. No unrelated container changes.

**Deferred:** Auth import ordering is P33; per-account real operational success remains P48. **Checkpoint:** C.

### P33 — Authentication bootstrap and restore validation

**Dependencies:** P32. **Outcome/boundary:** Restored local data becomes an active checked cut; per-account login/route/work status stays explicit until independently validated.

**Surface:** Design §10.5 steps 4–7; target-scoped document_start bootstrap, account recovery and restore report.

**Tasks:** Import remapped cookies with complete metadata, respecting expiry. Register one-use packaged auth bootstrap before protected native origin startup; merge schema-checked auth into fresh defaults synchronously and remove registration after receipt. Recheck bytes/rotation and closure before switching cut. Rebuild exact installed enabled packages/scripts/alarms, preserve Pause, invalidate leases, reconcile possible effects read-only. Restored DEVELOP retains acceptance/context and requires same-chat inspection, never automatic send. Verify Git credentials read-only and actual account principal/route/unique exit before its work.

**Failure/recovery:** Missing bridge leaves participant staged; missing key/Persona/login/route cannot be reported operationally restored. Switch only after required local imports succeed. Show Archive valid / Extension data restored / Login / Route / Work reconciled separately; unaffected validated accounts can proceed when maintenance/Pause permits.

**Complete evidence:** T checks every mapping/reference. B/DSK proves bootstrap precedes fixture site scripts, compares actual imported bytes/attributes and fresh IDs, tests cookie rotation/missing prerequisites/session rejection, and shows exact account recovery without unsafe admission.

**Deferred:** P5 P48 tests real same/fresh-device identity and route after local import. **Checkpoint:** C.

### P34 — Automatic Backup and restart completion

**Dependencies:** P33. **Outcome/boundary:** Enabled Backup captures/exports every six hours and completes/reconciles interrupted restore without dashboard dependence or missed-work bursts.

**Surface:** Design §§3.3, 9–10; Backup deadlines, retention integration and final restore/maintenance recovery UI.

**Tasks:** Persist configurable six-hour/90-day defaults and relative destination. Rebuild deadlines on every cold event page/startup/Enable; perform at most one due operation. Enabled Backup works during global Pause, disabled Backup performs no manual/automatic capture/export/restore. Drain dispatched work safely on update/disable. Resume staged restore steps after browser restart, switch only after validation and retain previous cut until verified. Show stale last-success state when disabled and effective settings without duplicate module settings.

**Failure/recovery:** Failed capture/export never deletes earlier complete backup; preserve at least one prior complete until the replacement checks pass. Imported source-profile file IDs cannot authorize cleanup. Missing external setup remains named, not synthesized or exported from OS.

**Complete evidence:** T tests deadline coalescing and disable/Pause races. B/DSK closes dashboard, advances controlled deadlines, restarts Firefox mid-capture/download/restore and compares active/staged data plus actual files. Exercise real production retention with cleared history/manual sentinels and no extra captures on Enable.

**Deferred:** P48 operational portability; P49 real 50-account capture duration/load. No bridge export/import service or AI conversation restore. **Checkpoint:** C.

## Refresher

### P35 — Eligible Active/Sleep cycles

**Dependencies:** P22. **Outcome/boundary:** Refresher shows durable pool eligibility and the mandatory configurable 24h Active/72h Sleep cycle. No refresh effects yet.

**Surface:** Design §§8.1, 11; cycle records/heartbeat, Refresher list and Settings durations.

**Tasks:** Count eligible Active time, including fair-queue wait but excluding route/source/manual/Deployer/global/module holds and browser closure. Use session nonce, boot ID and monotonic live segments; credit only adjacent valid heartbeat intervals across event-page reconstruction, never uncertain gaps. Sleep uses wall time. Stagger initial starts without spending unearned Active time. Duration changes default to next cycle. Add Pause/Resume Refresher, effective settings and pending/Active/Sleep/Available Active counts.

**Failure/recovery:** Late heartbeat, OS suspend, clock jump or expired evidence starts a fresh eligible segment with no unobserved credit. Sleep expiry admits a full new budget safely; no catch-up saves. Sleeping remains public.

**Complete evidence:** T uses independent clock timelines for all holds, duration changes and bulk start. B exercises module/global Pause, disable, event-page termination, browser closure and Sleep progression; UI shows real states/settings without zeroing unknowns.

**Deferred:** Live eligibility/routing and fleet load at P47/P49; clock correctness is required now. **Checkpoint:** C.

### P36 — Actual rendered directory measurements

**Dependencies:** P10, P07. **Outcome/boundary:** Refresher and Home show actual three-band measured counts/positions separately from source saves.

**Surface:** Design §§8.2, 11; one protected directory observer and visibility projections.

**Tasks:** Wait for native displayed-list completion, including lazy/paged data; extract true generator entries after filters/pins, first displayed duplicate only. Store complete ordered snapshots/context/timestamps and exact size. Count confirmed owned generators separately from eligible Active. Use 60-second initial cadence, 120-second freshness, five-second initial post-save observation. Show Unknown with last good age, Not seen only after complete absence, Not measured before any satisfactory snapshot.

**Failure/recovery:** Challenge, changed layout, blocked frame or incomplete loading cannot prove absence. Keep last good snapshot and contextual cause. Raw max=1000 API and historical 735 count are not ranking/size oracles.

**Complete evidence:** T/B uses rendered filtered/pinned/lazy fixtures and navigation distractions; independent expected DOM order proves counts and positions. Close dashboard/restart observer and verify incomplete results never erase confirmed facts.

**Deferred:** P4 P47 qualifies actual current rendered structure/order/propagation before live controller use. **Checkpoint:** C.

### P37 — Safe markers in both root files

**Dependencies:** P19, P35, P36. **Outcome/boundary:** An eligible refresh changes one owned marker in both PJS and HTML and independently verifies the complete saved source.

**Surface:** Design §8.4; versioned marker planner, shared writer and Refresher per-generator save results.

**Tasks:** Admit a qualified PJS top-level comment boundary and parsed HTML comment-safe boundary after doctype when present. Insert once or replace exact owned marker; never regex-append into raw text/script/style/template. Prove every other byte and all src unchanged. Recheck owner/public/base/revision/eligibility, retain previous-good, use P19, then full readback and public check. Expose failures at the affected pool row.

**Failure/recovery:** Duplicate, user-modified, ambiguous or unsupported marker placement holds this target. Unknown save reconciles; do not overwrite the user's base to repair it. No Sleep, Unlisted, dirty or developing target is eligible.

**Complete evidence:** T parses adversarial source contexts and compares all unchanged bytes; execute representative generator fixtures to check comment behavior. B verifies both marker changes and full fixture server source, public state, conflict/unknown handling and continued other work.

**Deferred:** P4 P47 qualifies actual PJS/HTML recipes and functionality before live Refresh writes. Static comparison alone cannot prove semantic neutrality. **Checkpoint:** C.

### P38 — Adaptive three-band control

**Dependencies:** P35, P36, P37. **Outcome/boundary:** Refresher automatically selects and repeats useful refreshes using measured top 50 → top 100 → full-list priorities.

**Surface:** Design §8.3; greedy controller, rate/backoff state and Refresher/Home observations.

**Tasks:** Implement lexicographic projected gains, measured movement/insertion/propagation estimates and risk/oldest/fair tie breaks. Admit one writer initially; remeasure/recompute after verified save. Permit repeated Active refreshes, not just absent entries. With no positive demand, wait. Start with design spacing, measured latency floor, three-round speed adjustment and provider Retry-After/exponential backoff. Separate predictions, save receipts and actual positions. Back off filtered/no-response targets.

**Failure/recovery:** Incomplete/stale observation selects nothing. Unknown save enters reconciliation, not timed retry. Resume/startup coalesces work; no speculative burst or sleeping target substitution.

**Complete evidence:** T checks deterministic 30/60/90+ Active scenarios, saturated bands, pins/filters, no-gain wait and throttling. B drives Pause/Resume and settings through the installed controller against an independent moving-directory fixture; confirm resulting saves, measurements and retained cycles.

**Deferred:** P4 P47 small authorized qualification; P49 measured fleet tuning. No rank/optimality guarantee. **Checkpoint:** C.

## Complete-candidate integration

### P39 — Shared UI continuity and cross-item recovery

**Dependencies:** P11, P15, P17, P27, P38, P34. **Outcome/boundary:** The already operating pages give one consistent searchable path to every real task and recovery action.

**Surface:** Design §11; shared shell/projections/action registry and optional Advanced details.

**Tasks:** Complete cross-account/generator/folder/job search and exact links. Check concise Home attention/current work/counts/visibility and View all links, folder-only Generators, Accounts, Refresher, Work batches/history, searchable Other and all six Settings sections with name search. Retain multi-selection/filters/row anchors/scroll/focus/drafts on data updates, errors and navigation. Show per-item batch results; multiple selection grants no new operation. Keep Reviewed separate from Resolved. Pin enabled module pages once before Settings; no blank pages for background-only/disabled modules. Diagnostics link to exact Journal operation. Add only missing shared wiring; do not defer module controls here.

**Failure/recovery:** Page load/missing handler has contextual Open Modules/error; stale generation controls cannot act. Unknown never becomes zero/complete. Failed form save retains input; recovery does not detour through unrelated Settings.

**Complete evidence:** B uses keyboard/narrow windows across all real installed pages and representative error/recovery actions, then disable/update/restart. Independent fixture outcomes confirm actions, not DOM strings. T checks shared routing/projections where changed.

**Deferred:** Live UI journeys remain P42–P48; visual polish alone is not acceptance. **Checkpoint:** C.

### P40 — Representative synthetic capacity

**Dependencies:** P39. **Outcome/boundary:** Complete installed PCMS remains usable with at least 50 accounts/1,000 generators and representative retained data under measured resources.

**Surface:** Design §§4.1–4.3, 5.4, 8–11, 15; existing lists, queue, catalog, capture and archive paths.

**Tasks:** Use representative binary/source/history bytes and 90-day operation volume; record actual fixture sizes and hardware. Measure paging/search, request counts/cache/backoff, fair queue progress, memory, source/blob retention and capture duration/barrier. Enforce two automated Perchance operations globally/one per account, one Discover tab/one directory observer and two active DEVELOP operations initially; parked review tabs use actual resource budgets, not two-slot policy. Measure archive staging/ZIP64 and download interruption under load.

**Failure/recovery:** Resource exhaustion queues/holds transparently without source loss or arbitrary capacity caps. No 1,000-editor fan-out. Large batches cannot starve maintenance or unrelated accounts.

**Complete evidence:** S/B/DSK records measured resources and independent per-item progress; sample later pages/batches, several parked reviews, restart, large archive reopen and interrupted export. Fix demonstrated bottlenecks and rerun affected checks only.

**Deferred:** H/P5 fleet resources at P49; synthetic records do not establish actual protected-exit capacity. **Checkpoint:** C.

### P41 — Full-capability acceptance candidate

**Dependencies:** P40. **Outcome/boundary:** One complete XPI and safe installation instructions are ready for authorized live acceptance.

**Surface:** Design §§2, 12.2, 15; package build, selected Firefox target and release/preflight CI.

**Tasks:** Include all seven implemented modules enabled in a fresh install, intact donor/bridge behavior and every primary UI action. Preserve user packages/disabled state on existing new-PCMS profiles. Package no fixture endpoints, credentials, legacy popup, production feature-disable flags or test bypasses. Document clean-profile/known-ID installation, existing external bridge prerequisite, normal sandbox and actual supported Firefox build. Record source commit → built XPI hash; use this artifact for acceptance. Signed/general distribution is unestablished and not claimed.

**Failure/recovery:** Incompatible browser/profile or competing shared-daemon instance stops installation/protected use with exact guidance; never overwrite Alpha. An incomplete feature or required B/DSK failure keeps candidate open. Do not deliver a crippled final test package.

**Complete evidence:** T/B/DSK focused release check verifies artifact contents, persistent install/cold startup, seven enabled modules, full UI/backend journeys and scoped backup/restore on the same candidate. Reuse valid earlier evidence; rerun affected boundaries after fixes.

**Deferred:** All G/H/P1–P5 are still NOT TESTED until P42–P48; fleet acceptance is P49. A full-capability candidate is not yet live acceptance. **Checkpoint:** C plus real XPI hash and known pending checks.

## Authorized external acceptance

### P42 — Existing donor host acceptance

**Dependencies:** P41. **Outcome/boundary:** Two real isolated accounts are safely usable through the existing working bridge before any live Perchance write.

**Surface:** H; design §§2.3–2.4, 5.1, 6.1.

**Tasks:** Verify only the new combined XPI, preserved donor identity/binding, operator actions and packaged protected routing. The existing native bridge and PersonaMonkey routing implementation are an accepted baseline; do not rerun donor research or redesign the bridge.  Verify dedicated profile, preserved ID/allowlist, absence of competing active route-mutating profiles, donor-first cold protection and actual post-Confirm identity/binding/distinct exits. Exercise Open Perchance, outage/repair, Archive/Reactivate, dashboard closure and restored account-tab startup without Direct fallback. Test confirmed local Remove on a disposable account and independently verify its remote generators remain unchanged. Do not re-audit/reconfigure the bridge to make a test pass.

**Failure/recovery:** Unavailable/duplicate exit, unexpected principal or host fault holds only affected accounts; no real source work. Record exact observation and contextual repair.

**Complete evidence:** H/B through the candidate UI plus independent donor/provider observations and outage readback. Fixture success cannot substitute.

**Deferred:** Representative 50-account route capacity at P49; two-account success proves no fleet capacity. **Checkpoint:** C with secret-safe observations.

### P43 — Disposable Git acceptance

**Dependencies:** P41. **Outcome/boundary:** Real folder/source/DONE writes are qualified before live workflow commits.

**Surface:** G; design §5.4 and Settings/Generators/Work.

**Tasks:** With an authorized disposable repository/main and suitable Contents token, run scoped operations, concurrent relevant/unrelated commits, lost object/ref ACK recovery, ruleset denial and no-force history conflict. Use a Git-only clean test profile with no enrolled Perchance accounts or pool, so enabled automatic modules cannot cause out-of-scope provider writes. Independently inspect one attributed reachable commit, exact tree/blobs/protected originals, later DONE and no READY loop. Check Pause before individual object writes.

**Failure/recovery:** Ambiguous ancestry/input remains held; never force/reset or duplicate a logical commit. Keep token out of artifacts.

**Complete evidence:** G/B against the candidate with independent remote history/tree reads. Full workflow caller evidence follows below.

**Deferred:** Real source/publication order at P45/P46; no Perchance access is needed here. **Checkpoint:** C.

### P44 — Creator/provider acceptance

**Dependencies:** P42, P43. **Outcome/boundary:** Discover → verified folder → adopted or once-created unlisted generator works on authorized targets.

**Surface:** P1; design §§6.2–6.3.

**Tasks:** Qualify exact Available/reserved messages, actual framed generator content, Unknown and current slug rules. Test affirmative managed owner absent locally without source/listing edits, conflicting owner, and unknown inventory without a false nonownership gate. On disposable Available slug, verify private empty-manifest schema, one create/rename, correct stable ID/owner/unlisted status, balancing/reservation and contextual controls.

**Failure/recovery:** Use controlled response loss around authorized calls to verify attribution/readback without creating extra generators. A changed contract holds this path; never improvise a second creation. Check fresh availability after observation/name race.

**Complete evidence:** P1/B plus independent account inventory/identity/listing and G folder reads on the exact candidate.

**Deferred:** Source/publication at P45; large-scale creation is neither needed nor authorized by a capacity fixture. **Checkpoint:** C.

### P45 — Full-source DEPLOY acceptance

**Dependencies:** P44. **Outcome/boundary:** A real first version and update complete DEPLOY → source verification → public → pool → DONE safely.

**Surface:** P2/G; design §§5.1–5.4, 6.4.

**Tasks:** Use authorized disposable source with PJS/HTML, binary src and actual supported Unicode/space filenames. Qualify full enumeration, deletion and provider revision conflicts, including an external edit and dirty manual editor. Verify unlist-before-edit, previous-good retention, exact source readback, public/listing identity, pool and matching DONE. Exercise lost save/listing ACK and Git-completion-pending recovery.

**Failure/recovery:** Missing stale-write protection holds source changes; failed update remains unlisted. Independent reads resolve possible effects before a retry. Do not publish an incomplete/changed version or automatically relist rollback.

**Complete evidence:** P2/G/B uses actual UI/automatic intake and independent saved bytes/revisions, listing and remote Git receipts on the candidate.

**Deferred:** AI-specific acceptance at P46; measured directory success at P47. **Checkpoint:** C.

### P46 — Native DEVELOP completion acceptance

**Dependencies:** P45. **Outcome/boundary:** Representative native AI development finishes through the actual PCMS editor control and automatic completion sequence.

**Surface:** P3/G; design §7.

**Tasks:** Use distinct substantive instructions on authorized disposable targets. Verify integrated staging/same native chat/exact one send while reusing prior transport evidence. Observe actual terminal success/error/stopped/unknown and settled application; qualify stable inactive human fallback when needed. Review opens exact tab/chat. Click PCMS Finish for full accepted save/Git/public/pool/DONE; exercise paused click/changed candidate, close/reload/restart, late write and module-update dirty-editor hold. Keep dashboard closed during native work and preserve parked reviews.

**Failure/recovery:** An unavailable native success signal may use only the bounded explicit fallback, labeled accurately. Active/unstable/uncertain writes remain held; no prompt resend, fresh chat, destructive reload or false success.

**Complete evidence:** P3/B/G independent source/listing/Git receipts plus time-ordered redacted durable events distinguish AI readiness, human acceptance and completion. No separate manual save/publish.

**Deferred:** None for this journey; unavailable authorized cases remain NOT TESTED with exact scope. **Checkpoint:** C.

### P47 — Directory and both-marker acceptance

**Dependencies:** P45. **Outcome/boundary:** Refresher is qualified on small authorized live cases before fleet tuning.

**Surface:** P4; design §8.

**Tasks:** Compare actual rendered filters/pins/list size/order with stored measurements. Qualify PJS/HTML marker placement and unchanged function/other bytes on disposable supported source. Independently read back both marker changes and source, then measure propagation/positions separately. Observe retry/backoff/no-gain behavior and recheck Active/Sleep/manual/Deployer holds through the real UI. Use existing authorized pools for 30/60/90+ Active scenarios where available; deterministic variants already belong to P38.

**Failure/recovery:** Unsupported recipe or incomplete directory holds affected work; never infer rank from a save or keep refreshing filtered entries. Unavailable live workload sizes remain explicitly NOT TESTED, not synthetic-live conversions.

**Complete evidence:** P4/B independent source/functional checks and rendered before/after snapshots with observed timing/rate limits.

**Deferred:** Remaining authorized workload sizes and fleet tuning at P49; no broad fleet activation before small safe cases pass. **Checkpoint:** C.

### P48 — Real login portability acceptance

**Dependencies:** P42. **Outcome/boundary:** Production backup restores actual managed logins/routes on same-device and fresh destination contexts with honest limits.

**Surface:** P5/H/DSK; design §10.

**Tasks:** Qualify narrow required auth inventory and cookie/FPI partitions against current login, including session rotation. Restore the production disk archive using fresh containers and document_start bootstrap. Test interrupted donor staging/rollback, missing external bridge setup and rejected/expired session. Use an authorized configured fresh-device destination for portability; a fresh profile on the source device alone cannot prove that case. Verify per-account principal, protected route/unique exit, Git read access and safe work reconciliation.

**Failure/recovery:** New required auth storage needs a narrow adapter update, never whole-AI/site backup. Missing setup leaves staging/holds and named prerequisite. Preserve Pause, prior cut and exact data/operational outcome separation. No bridge/OS secret export or native service change.

**Complete evidence:** P5/H/DSK independent actual disk bytes, container/auth checks and live identity/route observations. A rejected session is reported, not silently counted as restored login.

**Deferred:** Fleet capture/route load at P49; an unavailable destination remains NOT TESTED for that portability claim. **Checkpoint:** C.

### P49 — Host capacity and final acceptance

**Dependencies:** P46, P47, P48. **Outcome/boundary:** The complete candidate has measured fleet evidence and a truthful final capability/acceptance result.

**Surface:** H/S/DSK/P4/P5; design §§12.2, 15.

**Tasks:** On authorized host/resources, validate representative 50 distinct managed account routes/exits and bounded work, alongside the already completed 1,000-generator synthetic load. Use existing authorized generator pools for remaining 30/60/90+ Active workloads and fleet controller tuning; no bulk remote creation merely to satisfy a record count. Measure real scoped collection duration/change witnesses, short capture barrier, archive resources, schedules, UI responsiveness and account outage isolation. Confirm all seven modules enabled/full capabilities, source protection, paused maintenance and no catch-up bursts on the final XPI hash.

**Failure/recovery:** Lack of accounts/exits/destination/pool authorization is an exact pending capacity case, not a new architecture blocker or permission to claim PASS. Any contract failure holds that affected activation; preserve source/jobs and existing complete backup. Fix and retest changed boundaries.

**Complete evidence:** Required preceding G/H/P receipts, P40 S measurements and final H/DSK/live workload observations all identify the tested artifact and actual sizes. Report implemented, fixture-tested, live-verified and remaining NOT TESTED separately. Claim full acceptance only when required cases pass; never label 50 record fixtures as 50 working routes.

**Deferred:** No unnamed acceptance check. Explicit pending evidence carries its exact oracle/resource; no false final completion. **Checkpoint:** C with final artifact identity and evidence locations.

## Coverage and dependency check

This map assigns requirement groups to implementation and independent acceptance. It is not a second progress tracker. Detailed semantics stay in v42/design; every phase uses C and the common evidence rules above.

| Accepted scope | Implementation home | Necessary acceptance |
|---|---|---|
| v42 §§1–2: KISS, one extension, module limits, automatic work, honest results | P01–P07 and each module slice | T/B at the affected slice; P41/P49 complete candidate |
| §2 and §4: minimum capacity, bounded tabs, background/dashboard closed, restart | P02–P04, P07, P12, P24, P40 | B/S; H P42/P49 |
| §4 Core 1–4: donor-first automatic use, shared records/access, modules/requests | P01–P07, P10–P13 | T/B; H P42 |
| §4 Core 5–7: fair queue, no duplicates/overlap, manual work, uncertain effects | P03, P18–P20, P24–P27 | T/B; G P43, P1–P3 P44–P46 |
| §4 Core 8–9: continuous recording, consistent capture, restore hold, global Pause | P02–P03, P08–P09, P26, P28–P34 | B/DSK; P5 P48 |
| §4 ZIP roles/lifecycle/startup, enabled seed, saved jobs/settings, no dual generation | P04–P07; module-specific Disable/Enable checks in P08/P34/P35 | T/B including dirty editor; P3 P46 |
| §4 Pause/Resume and disabled-module distinction, no missed-work burst | P03, P07–P09, P26, P34, P35 | T/B/DSK; live boundaries P42–P49 |
| §5.1 Accounts enrollment, lifecycle, identity/route uniqueness, repair/limits | P10–P11 | T/B; H P42/P49, P5 P48 |
| §5.2 Discover exact classification/frames, normalization, dated persistence/all controls | P14 | T/B; P1 P44 |
| §5.2 initial marker-only main folder, no overwrite, no name reservation | P12–P15 | T/B/G P43/P44 |
| §5.3 automatic intake/adoption/foreign conflict/balanced allocation/override | P16 | T/B/S; P1 P44 |
| §5.3 recheck Available, one create/rename/unlisted owner, uncertain recovery | P17 | T/B; P1 P44 |
| §5.4 marker syntax/unique version/READY withdrawal and own-write suppression | P12–P13, P20 | T/B/G P43–P46 |
| §5.4 full source/binary/path fidelity/previous-good/manual and external edits | P18–P21, P23, P26–P27 | T/B; P2 P45 and P3 P46 |
| §5.4 DEVELOP exact instructions/new chat/prompt/tab/terminal or bounded review | P23–P25 | Existing transport evidence reused; B/P3 P46 |
| §5.4 PCMS Finish ownership, accepted save, paused click, correct review/recovery | P25–P27 | B; P3 P46 |
| §5.4 DEPLOY/DEVELOP updates, unlist-before-edit/failure, source→Git→public→pool→DONE | P20–P27 | B/G/P2/P3 P43/P45/P46 |
| §5.5 mandatory eligible Active/wall Sleep, defaults/settings/staggering/restart | P35 | T/B; P4 P47/P49 |
| §5.5 rendered directory/fixed three-band priorities/adaptive repeat saves/both markers | P36–P38 | T/B; P4 P47/P49 |
| §5.6 complete secret-safe recording/search, 30m/90d export/local retention | P02, P08–P09 | T/B/DSK/S P40 |
| §5.7 all extension/donor data, credentials/scoped auth, exact exclusions/prerequisites | P28–P31 | T/B/DSK; P5 P48 |
| §5.7 complete unencrypted file, checked bytes, fresh-container staged restore/rollback | P30–P34 | T/B/DSK; P5/H P48 |
| §5.7 6h/90d automation, no burst, previous complete/manual/unrelated file preservation | P09, P31, P34 | T/B/DSK P34/P40/P41 |
| §6 exact navigation/Home/Other/module pages/pinning/Settings last | P01, P04–P07; live projections in module slices; P39 | B/S P39–P41 |
| §6 Generators/Accounts/Refresher/Work: lists/details/batches/contextual actions | P03, P10–P11, P14–P38 | B at each slice; P39–P40 and relevant live journey |
| §6 Connections/Modules/Refresher/Journal/Backup/Advanced, one settings interface | P05–P13, P35, P28–P34, P39 | B/DSK, G/H/P5 where applicable |
| §6 interaction/search/errors: dedup, no false success, persisted input/focus, keyboard/narrow UI | P02–P07 and each visible slice; P39 | T/B/S with actual packaged effects, not mockup parity |
| §7 lean work files, one phase at a time, pushed recovery, risk-based CI/evidence | These six files; CI scaffolding P01, feature-specific tests thereafter | Document consistency now; actual code/evidence on implementation |

All 49 dependencies point to earlier phases and form an acyclic graph. Git and account/source branches do not depend on Refresher or Backup. Journal/Backup reuse the Core-owned Downloads service; DEPLOY/DEVELOP/Refresher reuse one source writer; all completion uses one queue and receipt model. Live G and H checks are independent; P47 does not wait for AI acceptance, and P48 does not wait for source-writing journeys. P49 joins the required acceptance branches. No completed research is a phase prerequisite to rerun.
