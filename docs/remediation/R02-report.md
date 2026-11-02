# R02 — Git commit identity and safe writer liveness

Date: 2026-11-02. Base: R01 source `f48a45228ba0fca83fd43c502a5113a072b68faf`, tree `cb1e1fe8467bec453e73a53a5a5db79863272297`. Accepted v42/design2 and repository governance unchanged.

**Status: FIXED_PENDING_B / PARTIAL. R01 final and R02 installed gates remain open.**

## Inspection and root causes

The phase plan was committed to todo before R02 code. I-D's independent public raw-object proof is reused; no public/content-repository test write or repeated investigation. The actual writer compared REST message bytes exactly, despite content-addressed raw identity including a terminal LF that REST may omit. The existing test fixture echoed raw bytes and missed the difference.

| Defect | Grade | Change | Closure |
|---|---|---|---|
| ID-01/02 | Reproduced | Exact SHA + tree + ordered parents + author/committer names/emails/instants + deterministic message; permit only omission of one final LF. Same saved operation can reconcile, then normal existing lock release/wake runs. | T PASS; B pending |
| ID-04 / IF-05 | Confirmed test-model gap | Independent Node and actual Git-plumbing HTTPS models normalize by default. Old strict predicate would fail these existing writer/lost-ACK cases. | T PASS; installed Discover/Git pending |
| ID-05/06 | Confirmed | POST response SHA must match planned SHA; status and expected/observed identity recorded before independent readback. Typed auth/missing/conflict/validation/rate errors; 500/lost response remains unknown. | T PASS; B pending |

## Verification

`node --test tests/git-commit-identity.test.mjs tests/git-writer.test.mjs tests/discover-preparation.test.mjs tests/git-catalog.test.mjs`: see actual focused result in checkpoint. Independent `git hash-object -t commit --stdin` proves raw final LF changes identity. Valid raw/API presentation cases pass; altered operation trailer, internal/CRLF/additional whitespace, SHA/tree/parents/author/committer fail. Existing lost blob/tree/commit/ref ACK and restart tests now use normalized API presentation; no duplicate POST/ref, no force, unknown ref stays held. Concurrent ordinary edits preserve unrelated files/modes; target conflict holds; lock release wakes unrelated work only after proof. HTTP 400/401/403/404/409/422/429/500 cases assert safe status evidence and terminal versus possible disposition.

Installed Firefox cannot run locally with its normal sandbox (R01 report). Required CI journeys are actual installed Discover→protected local fixture→Core writer→independent bare Git, plus Git caller/Work restart/readback. They have not yet run on this code and are NOT TESTED. Real G/P43 remains NOT TESTED, unauthorized by this task.

## Safety and remaining work

No trim, force update, shortened identity, arbitrary branch/path, replay or uncertainty clearing. POST is not completion proof. Readback, exact scoped trees/blobs, ancestry and operation attribution remain required. Available does not reserve a slug; existing folder/source is never overwritten. Historical inaccessible candidate/slug remains unknown; no live repair was attempted. Checkpoint publication and exact B/CI identities will be recorded once produced. R03 route work can be implemented safely while these release gates remain explicitly open; none is waived.
