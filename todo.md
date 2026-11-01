# Current implementation checkpoint

## P25 — readiness and same-chat review recovery

P24 merged [PR31](https://github.com/Neb963/PCMS/pull/31) as fd32636e1515e5075236e4fb878bab0435df719e; actual main treed986294d50b0b11ef3f92450af1b2f70fc5fdf67 equals tested04bcadf3. [41354824414](https://github.com/Neb963/PCMS/actions/runs/41354824414):205T/build + required installed B PASS. Firefox155.0/build20260817142839/sandbox6; XPI1b5abf27a4bc0674f5e92510a8f8e3a16b9eab58fd5d83843fbb0bd4bfb9426f. Independent fixture observed exactly one native New Chat and one exact Unicode/newline prompt, dashboard closure, real process restart and inspection hold with no reset/resend. Known native prompt trimming/textarea CRLF normalization hold before Send. Native-disabled/ambiguous fresh chat holds; live compatibility remains P46. P23 postmerge main41353710629 PASS.

### Plan before implementation

Base actual mainfd32636e; branch p25-ai-review.

- Keep native idle separate from attributed success. Extend fixed observation with pending application/save/queue facts; unsupported native terminal attribution stays AI_UNKNOWN, never fabricated SUCCESS.
- Provide Review in Perchance and Check AI Helper on the shared Generator/Work detail. Focus only the revalidated reserved account/Persona/remote/chat; missing or changed documents open protected inspection and hold without fresh chat or resend.
- Permit bounded human readiness only for the same inactive chat after two separated stable full source/editor/revision observations and no pending write, linked-document conflict or uncertain effect. Record HUMAN_VERIFIED_READY only after explicit attestation, with exact hash and times; revoke on any relevant drift. Keep the ordinary success path compatible with one-click Finish in P26.
- Cancel fences future PCMS effects and retains source, writer and review tab. An active native run requires Stop AI in editor and observed settlement, not destructive tab closure.
- Separate parked review tabs from two active automation slots. Preserve at least three parked tabs; no two-review cap or recycling.
- Focused T enumerates active/idle/terminal-unknown/stopped-unsettled, stable fallback, staleness, wrong chat, cancel and cold inspection. Required installed B drives real Review/Check/Cancel controls, independent native counts/source state, late-write invalidation, three parked tabs and restart continuity. No live provider operation or repeated transport probe.
- Push checkpoints; merge only after required T/B, verify main and continue P26. P46 remains NOT TESTED/unauthorized.

P25 implementation not yet started.
