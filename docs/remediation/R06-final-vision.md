# R06 exact-package visual review

Review date 2026-11-06. The vision-capable OpenAI Codex (GPT-6) assistant directly examined the original Firefox PNG pixels. This is the same assistant that worked on the implementation. The separate installed capture driver records actual state, geometry and keyboard observations.

| Identity | Value |
|---|---|
| Source | `1808671a6c5b4826dfc8c3ac1ef92bd8fdc8bc69` |
| Tree | `2f862d4ece13f052bdfb3ba3fc2031a58e7f455a` |
| XPI SHA-256 | `609fae1d42378b6bab1666059d4048303c131b3b331659dd6d7f956f53d514bd` |
| Browser | Firefox 155.0, build 20260817142839, multiprocess, sandbox level 6 |
| Viewports | 1280, 560 and 392 CSS px in the principal matrix. The original manifests preserve actual dimensions, zoom and device scale for narrower variants and the single 1366 px render-error capture. |
| Primary originals | 433 original PNGs in 217 capture groups, 216 full-page and viewport pairs and one standalone error viewport. All match the completed installed archive. [Run 365](https://github.com/Neb963/PCMS/actions/runs/42220618849). |
| Supplemental originals | Measured Home on [run 366](https://github.com/Neb963/PCMS/actions/runs/42225547627). Settled Archive on [run 368](https://github.com/Neb963/PCMS/actions/runs/42227281803). Final Generator page on [run 371](https://github.com/Neb963/PCMS/actions/runs/42229362271). All use the same verified XPI. |

The review directly examined 197 original PNGs from run 365 and 15 supplemental originals across the three settled states. The three measured Home viewport PNGs are byte-identical to their reviewed full originals. A further 89 viewport crops have pixel-identical equivalents in reviewed full images. The test captures include duplicate layouts from separate fixtures. The selected originals cover each materially distinct state and the supplemental captures resolve state-settlement gaps. [Original PNG filenames, hashes, actual widths and per-image findings](evidence/R06-run365-reviewed-pixels.json).

## Findings

| State | What is visible in the reviewed pixels |
|---|---|
| Home | Running and global Pause are separate from the protected-script permission notice. Healthy idle, paused, first-run blocked and unmeasured directory are distinct. With work outstanding, the attention groups preserve Unknown and show their own Mark reviewed controls above waiting DEPLOY. A measured directory displays three independent Top 50, Top 100 and full-list values. |
| Generators and ownership | The empty list says No matching generators. The loaded first page exposes labelled search, four filters and selection above consistently aligned rows at all widths. The final page shows five terminal rows, two selections and First page. All 1,005 records were traversed through 21 actual pages. The folder-only view names its Creator hold before source actions. Created unlisted, published with Git pending and published DONE carry visibly different status. Source files, binary rows and Git evidence remain discoverable. |
| Accounts | Preparing, login, Confirm and Ready have different appropriate actions. The DNS and IPv6 holds show Repair and no Open. Changed principal shows Complete login and a separate route observation. Archived detail and row agree after the normal refresh, with Reactivate and Remove. The injected Accounts render failure shows Reload view and recovery retains the real controls. |
| Refresher | Unmeasured directory, no pool matches, actual separate rank counts, Active and Sleep are distinct. The real stale-source failure keeps prior save history and offers Check Refresh result. Directory visibility remains separate from source-save verification. |
| Work | Compact list rows put task and status before module and account. The actual Creator hold appears under waiting DEPLOY with the exact Creator link. Unknown CREATE directs readback. Pending Git offers Check Git result before the status detail. Completed DEPLOY carries DONE and no AI control. The DEVELOP hold offers review, check, cancel and explicit same-chat attestation. |
| Other, modules and Discover | Discover appears once in Other with its scope description. A user ZIP pin appears once before Settings, with Enable or Disable appropriate to its actual status. The Discover results show Available, Taken and Unknown separately. Actual scrolling gives the entire last Unknown row and a visible focus border. |
| Settings and Journal | Six cards share spacing and layout. Connections separates read access from write. Module registry shows all seven bundled modules enabled. Cycle, Journal and Backup defaults are labelled. Invalid export destination is shown next to Save with specific correction. Journal range fields, record filters and paging remain separate. |
| Backup and restore | The privacy warning precedes export. Preview requires the actual archive and explicit confirmation. DRAIN names all four held contexts and lets the operator preserve or revalidate them before closing only the intended contexts. Complete restore separates archive, login, route, Git and held work outcomes. |
| Search and responsive behavior | Result rows wrap with no hidden controls, and the scrollable results stay above the current page. No-match and storage-failure messages preserve the exact search input and distinct result semantics. Real keyboard submission and result selection pass. |

## Iteration and remaining polish

- IB-01 conditional controls are absent when inapplicable. The actual DEPLOY waits, Creator holds and restore states use their proper action sets. IB-02/03 move IDs and technical evidence into details and visibly separate actions. IB-04/05 show the affected work and its real hold independently of global Running.
- The first Archive capture showed a save in progress. The first supplemental capture verified the selected detail but caught the older Ready row before its normal refresh. The settled supplemental capture waits for the real selected detail, visible Reactivate and matching archived row before each width. Both views then agree. Repeated Archived tokens in that row are P2.
- Remaining P2 findings include tightly adjacent controls in some Settings and Work rows, duplicate secondary status text, raw Discover classifier and Git diagnostic tokens below the actionable state, long Backup explanatory copy, and the additional scroll needed for the lower part of the Discover iframe. The CI font displays a fallback box for a CJK character in some labels. Independent source and search receipts preserve the exact Unicode bytes and result identities.
- Capture and interaction oracles include actual platform widths, zero document horizontal overflow, selected navigation visible, computed hidden geometry and 144 real 24-Tab audits on run 365. Each reached top-document control is visible, enabled and named. Discover iframe behavior is checked through its actual module interaction and scroll tests. Measured Home, settled Archive and the final Generator page each add two matching Tab audits.
- Run 372 queried the native Gecko accessibility tree of the actual remote dashboard document at 1280, 560 and 392 CSS px. Actual search and result navigation reached a waiting DEPLOY. The tree exposed the named searchbox, results list, deployment check button and Creator work link. It excluded the inapplicable AI controls and their attestation text. [Independent native accessibility receipt](evidence/R06-run372-native-accessibility.json).

**Decision. V PASS for the exact XPI.** All required representative states were directly reviewed. The matching interaction and native accessibility checks pass. The remaining findings are P2.
