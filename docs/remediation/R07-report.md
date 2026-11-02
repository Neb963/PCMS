# R07 — bounded refresh, persistence and dependency wake

Status: **PARTIAL — installed capacity, comparable before/after and long-session gates remain open.** No release claim.

The phase plan was committed before code (`87e45cc`, based on remotely verified R06 `2c83d531`). Authority files, schedules, retention, module enablement and Core dispatch authority are unchanged.

Actual causes: the dashboard queried every active surface every two seconds even when only diagnostic events changed; identical view values produced more events; WAIT_CREATOR work retained a runnable timer while its exact upstream revision stayed unchanged. R01 separately corrected Journal prefix traversal, and R05 added immutable dataset/data-revision query caching.

Changes: Core exposes a read-only meaningful content revision; non-overlapping UI refresh checks it with a 30-second fallback. Explicit actions/typing still query immediately. Identical view saves preserve command deduplication while omitting a nonexistent state transition; changed drafts still persist and record. The existing queue parks only an exact unchanged Creator dependency, and wakes when its revision/state changes or confirmed ownership clears the dependency. No separate scheduler, dropped real events or weaker replay barrier.

Verification:

- Corrected focused run: 52 PASS (queue, records, UI queries, Journal, Refresher). An initial run failed because an interrupted editing script had not applied the queue change; implementation corrected before the passing run.
- Deployer integration after queue changes: 61 PASS / 0 failed,75.1seconds.
- Full predecessor R06 source run: 497 PASS / 0 failed, 211.0 seconds. This is not final installed evidence.
- Representative production-code S/DSK run in that suite: 50 accounts, 1,000 generators, 90,000 events/90 days, 32 MiB binary. Seed 36,831 ms; 20 pages 243.6 ms; joined query 934.4 ms; capture 1,392.8 ms (barrier 1,302 ms); archive 7,312.7 ms; ZIP 35,452,474 bytes / 55 entries / 74,943,613 uncompressed bytes (ZIP64); peak RSS 1,108,389,888 bytes. Hardware AMD EPYC 9V74, 9 logical CPUs, 10,451,427,328 bytes memory. Node/fake IndexedDB with independent ZIP reopen, not installed long-session performance.
- R01 actual installed suffix export on source f48a4522: 100,001 events/90 days, one late row, five cursor continuations, 107 ms. See R01 report for artifact identity.
- Extended installed capacity journey records real UI repeated-query round trips and background version-cursor reads, along with existing full backup disk/hash/restart/manual-sentinel oracles. Execution pending.

Required open evidence: final-XPI installed 50/1000/90-day measurements, two automatic 30-minute rounds, comparable baseline, CPU/long-session/update behavior and no-starvation across the integrated candidate. Existing source timers and tests do not substitute for those observations. Earlier phase installed/vision failures are not waived.

## Observed R07 installed and comparable source results

CI[41512200622](https://github.com/Neb963/PCMS/actions/runs/41512200622), sourcebef12ba9 / tree514f1c89, exact XPI SHA-256 `87ac1cf4b0afef3cdb6e0d7d0bac01df4e0a80b11a799503046c5a1836be7f00`, Firefox155.0/build20260817142839/sandbox6: installed capacity and independent backup disk test PASS.50accounts/1001generators including prior source/90000 synthetic events/90days/32MiB binary. Four global pages401.8ms; exact late query70.1ms; three warm UI round trips57.2/57.3/61.2ms with **zero** background version-cursor continuations.21 Core pages1089ms. Two independently reopened archives35,773,465 and35,824,960bytes,90,413 and90,541events, barriers2252/2630ms, captures44.7/60.3seconds. These are manual/fault-recovery exports, not two automatic30-minute rounds.

The recorded aggregate RSS5,059,891,200bytes included all Firefox processes; a failed Creator restart helper leaked its replacement session. It is not a qualified profile-scoped memory figure. Corrected cleanup/session tracking and profile-tree RSS/CPU sampling require the next run. CPU model and sampled CPU/wall time added; prior4CPU/16,760,344,576bytes hardware receipt lacks CPU model. No memory improvement claim.

Comparable S (not Firefox): same hardware and deterministic50/1000/90000/90-day/32MiB fixture on actual P41 main versus remediated records/query source. Independent event-token index verifies view-event counts and real mutation invalidates the cache. Initial harness attempts had missing dependency/global setup and an unnecessary full-prefix diagnostic count; corrected before the final measurements. Raw small receipts: [baseline](evidence/R07-query-baseline.json), [remediated](evidence/R07-query-remediated.json). Warm additional table-page calls **63→0**; version cursors across10queries **10540→1054**; identical view events **10→1**. Every10 explicit observation events remained (event deltas20→11). Warm median query times ~765.5ms→~1.14ms in fake IndexedDB; cold query676.8ms→920.6ms. No browser speedup or lower cold-start cost is inferred.

Full post-R07 source suite499 PASS/0fail/202.8seconds. Subsequent module accessibility marker received its1 relevant page-lifetime test; subsequent Creator protection/readback correction has its focused16-test result in R04/R08. Long-session/automatic rounds and final required state/vision gates remain open.

Run352/source ded70205 representative capacity is **FAIL**: its first independently reopened35,774,039-byte archive contains90419events/50accounts/1001generators/32MiB binary (SHA-256 `9256fb9d2312642a3241f600211c68d1bed66a36b742dc5870a018c854eeb3a9`,2028ms barrier,61.66s capture); the second cut exceeded the five-second barrier before staging. Scoped Firefox-tree aggregate peak RSS3,424,321,536bytes includes shared pages; sampled CPU429.91s over292.64s wall. Hardware4logical CPUs/16,760,344,576bytes/AMD EPYC7763. Four global pages421.14ms; warm round trips58.77/58.57/62.67ms with0background version-cursor continuations; exact later search85.05ms;21Core pages/1001rows1485ms. These partial measurements are neither an overall capacity PASS nor a memory improvement claim. Blob-backed cut storage and repeated installed export verification are the next correction; no deadline waiver.
