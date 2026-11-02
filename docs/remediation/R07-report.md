# R07 — bounded refresh, persistence and dependency wake

Status: **PARTIAL — installed capacity, comparable before/after and long-session gates remain open.** No release claim.

The phase plan was committed before code (`87e45cc`, based on remotely verified R06 `2c83d531`). Authority files, schedules, retention, module enablement and Core dispatch authority are unchanged.

Actual causes: the dashboard queried every active surface every two seconds even when only diagnostic events changed; identical view values produced more events; WAIT_CREATOR work retained a runnable timer while its exact upstream revision stayed unchanged. R01 separately corrected Journal prefix traversal, and R05 added immutable dataset/data-revision query caching.

Changes: Core exposes a read-only meaningful content revision; non-overlapping UI refresh checks it with a 30-second fallback. Explicit actions/typing still query immediately. Identical view saves preserve command deduplication while omitting a nonexistent state transition; changed drafts still persist and record. The existing queue parks only an exact unchanged Creator dependency, and wakes when its revision/state changes or confirmed ownership clears the dependency. No separate scheduler, dropped real events or weaker replay barrier.

Verification:

- Corrected focused run: 52 PASS (queue, records, UI queries, Journal, Refresher). An initial run failed because an interrupted editing script had not applied the queue change; implementation corrected before the passing run.
- Full predecessor R06 source run: 497 PASS / 0 failed, 211.0 seconds. This is not final installed evidence.
- Representative production-code S/DSK run in that suite: 50 accounts, 1,000 generators, 90,000 events/90 days, 32 MiB binary. Seed 36,831 ms; 20 pages 243.6 ms; joined query 934.4 ms; capture 1,392.8 ms (barrier 1,302 ms); archive 7,312.7 ms; ZIP 35,452,474 bytes / 55 entries / 74,943,613 uncompressed bytes (ZIP64); peak RSS 1,108,389,888 bytes. Hardware AMD EPYC 9V74, 9 logical CPUs, 10,451,427,328 bytes memory. Node/fake IndexedDB with independent ZIP reopen, not installed long-session performance.
- R01 actual installed suffix export on source f48a4522: 100,001 events/90 days, one late row, five cursor continuations, 107 ms. See R01 report for artifact identity.
- Extended installed capacity journey records real UI repeated-query round trips and background version-cursor reads, along with existing full backup disk/hash/restart/manual-sentinel oracles. Execution pending.

Required open evidence: final-XPI installed 50/1000/90-day measurements, two automatic 30-minute rounds, comparable baseline, CPU/long-session/update behavior and no-starvation across the integrated candidate. Existing source timers and tests do not substitute for those observations. Earlier phase installed/vision failures are not waived.
