# Current work

**P30 — portable archive codec and coverage validation. Plan before implementation.**

P01–P18/P28/P29 merged and verified. P29 [PR21](https://github.com/Neb963/PCMS/pull/21), main `d630a968f4ad54c1a4b9424536dddc2d7036f5d3`, exact tree `4d17e0399c61e5bedc0fa11688e54d7783df922e`; post41312348086 PASS (focused and installed). Source691261f3d233b30f7981819f6b8e7dda8b07b800:237 T/build/S+B41311633995; XPIa1b23ac73e122614a04a1b7f5283fcf6dd1b13041faf1db824946dd922ceb371. P19 and descendants retain their independent native-revision evidence hold.

## P30 implementation plan

1. Encode a qualified immutable P29 cut as one standard unencrypted, credential-inclusive, self-contained ZIP. Keep record sections versioned NDJSON/JSON, direct exact module ZIPs and source/history binary entries, narrow auth/cookie sections, donor state, credentials, manifest and COMPLETE marker. Record prerequisites, individual capture times, coverage, runtime-authority exclusions and Journal range/gaps. No disk success or restore writes in this phase.
2. Package a maintained ZIP64-capable codec, pinning exact release/integrity/license. The official zip.js v2.24.0 release/source supports streaming and ZIP64; use its native-stream entry/configuration compatible with existing extension CSP. Do not enable unsafe evaluation, native processes or remote codec URLs. Resolve public npm metadata through the existing Actions environment if local/browser metadata tools remain unavailable.
3. Use bounded byte streams/Blobs and incremental SHA-256 for entries/output, with an established packaged hash implementation rather than a new crypto algorithm. Add only the necessary private Core chunk reader so archive encoding does not require one giant binary/base64 JSON buffer. Preserve exact source bytes and file names inside the captured manifests.
4. Before declaring complete, validate required fields/sections, immutable package/blob/reference closure, configured credential presence, entry SHA-256/length, manifest digest and completion count. Decode with CRC and ZIP bounds/duplicate/unsafe-path/encryption/split/compatibility checks before exposing a valid archive. A checksum is integrity, not authenticity; no password/encryption/signature program.
5. Any incomplete cut, missing credential/package/blob, corrupt entry, unsafe/duplicate path, malformed bounds, incompatible schema, resource/quota error or interrupted encoding stays incomplete and retains the cut/previous usable backup. Do not infer success from a Blob or parser ACK.
6. Required evidence is focused production codec T/build: independent expected bytes and independent ZIP reader, round-trip, full source/history/binary/package/auth/secret fidelity, required-section/closure faults, CRC/SHA/manifest corruption, duplicate/traversal/incompatibility and bounded large/binary plus actual forced ZIP64 structures. Reuse P29's unchanged native/UI B and its source/XPI identity. P31 alone supplies manual Settings export/B/DSK; P32–P34 restore. Select only required tests in CI; no broad browser/provider rerun for this codec-only phase.
7. Push meaningful exact remote code+todo checkpoints, verify parents/trees/files, record actual results, merge a lightweight verified PR and verify postmerge main, then automatically continue P31 and remaining eligible work.

## Holds and evidence limits

Local execution and the connected browser metadata page were unavailable; GitHub reads/writes/Actions work. Public registry metadata is not a live provider operation. No unavailable local check is claimed.

P19: pinned accessible Alpha app.saveGenerator lacks a qualified provider revision/precondition recipe. Accepted Discovery ZIP cannot be extracted while local execution is unavailable; P18 sourceStamp/providerRevision:null is not CAS. P20–P27/P35/P37/P38 and descendants remain blocked. P36 is independent after eligible Backup work.

H/G/P1–P5 NOT TESTED/unauthorized; P42–P49 need named disposable resources/effects. P48 validates actual login inventory/portability and P49 real50-account resources. Synthetic bytes/scale never establish operational login/route/fleet readiness.

## Dependency/CI checkpoint

Official upstream sources establish zip.js2.24.0 and noble-hashes2.4.0. The existing focused Actions job now reads their public npm version/integrity metadata, checks module/package invariants and builds. The unchanged P29 installed journey is reused from41311633995 and postmerge41312348086; it is not rerun for codec-only work. P30 implementation/required codec tests remain pending. The temporary metadata command will be removed after exact lockfile resolution.
