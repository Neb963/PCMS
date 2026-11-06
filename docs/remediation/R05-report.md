# R05 — joined search, filters and retained selection

Date: 2026-11-02. Base R04 `fed3b34845fd194cd329acfc0e2dfadcdf9254f1` / tree `d992a74898785992bfea61bc074041cf947d6fd6`. Plan committed before code. Authority unchanged.

**Status. FIXED_AND_VERIFIED in the installed search and paging fixtures. The original operator query and cause remain unknown.**

## Root causes and changes

IB-06/07 are confirmed contract gaps: the Generator list searched only projected generator strings, missing owner display labels; account/listing/work filters and multi-selection were absent. A joined read-only projection now supplies these fields/filters, immutable cursor identity and selected-only paging. The same actual Core dataset remains authoritative. Selection is retained in existing view state and grants no new operation. All managed generator records can be found even before Git configuration; old catalog-only listing hid owned records in that state.

IB-10/IF-03 source amplification: every shared query reread all three projected tables. A bounded cache reuses immutable dataset/data-revision cuts. Diagnostic-only events and view persistence do not invalidate data snapshots. Real account/generator/job mutations increment dataRevision transactionally. Historical cursors retain exact membership; Work still reads current status where its historical page requires it. No source/credentials/private checkpoints enter the cache.

Global search now fences an earlier response immediately on input, before debounce. RPCs have a bounded timeout with a visible error instead of an indefinitely pending field. Default diagnostic traces record query length/digest, request identity, result count and elapsed time; no raw search text. Generator errors stay with the list and stale cursors reset safely.

**IB-09:** The old operator's actual query/profile response is unavailable. Existing source/fixture matches cannot establish its historical cause. The known friendly-owner omission is repaired, but no claim that it explains universal/global failure is made.

## Verification

15 focused production query/record/continuity tests PASS. New actual fake-IndexedDB tests: 1,005 joined Unicode-owner generators, account/listing/work/folder filters, all later pages (502 Public matches, including row1003), selected-only IDs, cursor-filter identity, and cache invalidation. Instrumented Core list calls do not increase across diagnostic-only event/view writes and do increase after a real generator mutation. Existing stable snapshot, joined cross-item search, Work current status and record privacy tests pass.

Extended installed UI test uses actual owner search, listing filter, row multi-selection/selected-only/navigation, and independently reads the default query diagnostic from IndexedDB. Cold route recovery must now prove AUTO_RENEW_VERIFIED; it may not pass by a routine manual Open. This matching installed test is **NOT TESTED** until CI executes it. Universal historical search closure, out-of-order installed/empty/error matrix and full loaded list/visual acceptance remain open.

## Safety / remaining work

No second store/query authority/queue; cache keys are immutable cuts/data revisions and retain at most8 entries. No search cap or selection-granted source action. View drafts, module fences, account/source scope and uncertain operation identities remain. R06 must inspect actual pixels and conditional controls; R07 measures long-running cache/read/write costs; R08 reruns exact final XPI integration. Required missing evidence prevents R05 PASS and final readiness. Real P42–P49 remains NOT TESTED.

Observed B: sourcebef12ba9/XPI87ac1cf4b0afef3cdb6e0d7d0bac01df4e0a80b11a799503046c5a1836be7f00, CI41512200622 shared UI PASS: actual owner-label/listing/multiselect/selected-only/navigation/default diagnostics, keyboard global later pages and real restart. Installed capacity also PASS:50accounts/1001generators/90k events, exact row0999 global result70.1ms. Historical IB-09 remains UNKNOWN; installed out-of-order/error matrix and final required state coverage remain open. Pixel review exposed WebDriver clear not delivering input events in screenshot setup; capture now uses actual Ctrl+A/Backspace, rather than claiming a production search failure from that harness artifact.

## Additional installed search matrix prepared

Added test-side actual Port-delivery ordering and IndexedDB transaction-failure probes to the existing installed shared-UI journey. Production query/record/render/navigation code is retained. Synthetic records cover mixed-case Unicode owner names, duplicate labels with different IDs, folder and job targets, no matches, stale response rejection, explicit database-error feedback/retry and default correlated query events. This new B matrix is NOT TESTED until the next matching CI execution. Six focused source query/page-lifetime checks pass. Historical IB-09 universal cause remains UNKNOWN.

## 357 evidence and next bounded correction

357 shared UI reaches real Core/IDB Unicode/duplicate-ID/folder/job navigation, no results, out-of-order delivery, actual one-shot IDB failure, preserved input and retry. It then fails its private diagnostic query with JOURNAL_RANGE_INVALID: Core correctly requires first and last together, but the harness supplies only first. Supply current immutable last sequence and retain the typed failed-event assertion. Integrated independently stops at an unawaited initial permission button before search. These are diagnosed harness failures, not proof of the historical operator cause. Complete R05 B/DSK and exact final V remain open. The actual error pixels also need a short storage cause and Search-again instruction; original code stays in causal records and error metadata.

358/sourcea775e392/XPI3514adb5: full installed shared UI/search contract PASS, receipt df813f6efb26c7735738f966c5a35b11bf043f4b914893b57ac356c5b12e96cb from independently reopened artifact13225424798. Includes Unicode/case, duplicate labels with distinct IDs, exact folder/job navigation, no-match, out-of-order Core replies, actual IDB query failure, retained input, explicit human error/retry and default causal record.40 strict Tab audits PASS. This closes that installed regression on this source; historical operator’s exact query/root remains UNKNOWN and is not retrospectively attributed. Final artifact/state V still gates acceptance.

## Exact installed search diagnosis

Run 365 passes shared and integrated search on source `1808671a6c5b4826dfc8c3ac1ef92bd8fdc8bc69` and XPI `609fae1d42378b6bab1666059d4048303c131b3b331659dd6d7f956f53d514bd`. Actual keyboard submission, Unicode and case folding, duplicate display names with different account IDs, exact folder and job links, empty results, later-page results, out-of-order delivery, one-shot actual IndexedDB transaction failure, retained input and retry all pass. The default causal record preserves a typed storage failure and correlation without raw search text. [Run 365 receipt index](evidence/R08-run365-completed.json).

Run 369 independently compares the original P41 and run 365 XPIs in clean Firefox 155.0, build 20260817142839, sandbox level 6. Both execute the real packaged DOM, Port, Core and IndexedDB flow. A controlled delivery fault drops the first valid Core reply. The independently recorded reply contains the exact expected generator in each build. P41 remains on “Searching…” after 64.008 s. The candidate retains the input and gives “Search timed out. Try Search again.” with `CORE_REQUEST_TIMEOUT` at 60.090 s. The next visible Search and result click reach the exact generator. [Independently reopened comparison](evidence/R05-run369-reply-loss.json).

This reproduces an installed failure in the common search control and verifies recovery under the same fault. The original operator query, profile and response are unavailable. Its exact cause remains unknown.

Run 370 drove all 21 visible Generator pages over 1,005 independently named records. Each appeared once in expected order. The query, final five rows and both cross-page selections remained after navigating through Work and back. Receipt SHA-256 `b8745208367b74699c39d658ff2bec6a4ac9f0b5eef92505a509320cd4bdde1a`. The PNGs from that run displayed a contradictory fixture state because the synthetic rows had been marked Owned without a remote identity. The follow-up capture uses folder-only rows with an allocated account. [Run 370](https://github.com/Neb963/PCMS/actions/runs/42228549967).
