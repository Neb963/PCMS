# Current work

**P17 bounded correction — private creation payload.**

P01–P18 are merged. P18 [PR18](https://github.com/Neb963/PCMS/pull/18), main `b04c3b7ce8a48f5c15009b03cf3a3a09fffa6877`, tree `279e292a54914a9a3a5e027d60b9c754b041fe0a`; [postmerge41302307395](https://github.com/Neb963/PCMS/actions/runs/41302307395) PASS. P18 final source `6a11d6d9d73eb8dc948a339b1f81ed2bc57fd0e2`:212 T/build and required installed B PASS in41301927242, XPI `3c656c66d2c8b682b6585f0e65d01514e9c03b9960cdb3e81b3ed87dc72647f9`. P18 remains read-only; sourceStamp is not provider CAS.

## Implementation plan

The actual Creator save spreads the public minimal template into the new generator. Remove that spread: transmit only name, private flag and empty PJS/HTML; keep srcManifest only at the top level. Preserve template/schema/fingerprint and authenticated inventory checks. Do not borrow or mutate an existing editor/source.

Require the exact generator field set in both independent native service fixtures, with publicId and nested manifest present on the source template so either leak fails. Run existing focused T/build plus the affected installed Creator creation journey, including lost create/rename bodies and actual restart with no duplicate effects. Reuse unchanged P18 source-inspection B evidence. Publish exact files/tree/commit, merge a lightweight correction PR and verify postmerge main.

## Next work and holds

Then resume P19, which requires source-grounded native save revision handling; an unsupported mechanism must hold writes. Accepted Discovery ZIP is located but cannot currently be extracted because the execution environment is unavailable. GitHub reads/writes and Actions remain available; no unavailable local check will be claimed. Do not invent a provider revision API or local-lock protection against external devices. If this remains a genuine dependency, preserve it and continue independent eligible phases P28/P36 in dependency order.

H/G/P1–P5 remain NOT TESTED and unauthorized; P42–P49 need named disposable resources/effects. No live provider/native acceptance mutation or operational login portability is established.

## Correction checkpoint

Implementation now sends the exact four generator fields and top-level empty manifest. Both independent fixtures reject extra metadata. Patch XPI0.18.1; existing installed job selects only the affected creation/recovery journey. Verified source `375ec1afeb46a2102e3834bb3f1a782d25300b85`, tree `a1a62ca85569a2e652f1ce0bfc2c6a31da36adc4`: [41303250000](https://github.com/Neb963/PCMS/actions/runs/41303250000)212 T/build and affected installed B PASS. XPI `866cae23b72583fc2345ab8b655acaff80b2782e58ea1d54b3af535fbf86d8b8`; Firefox155/build20260817142839, normal sandbox6. Independent service enforced exact generator keys, both mutation body losses survived actual restarts with one create/rename each, ambiguous inventory retained attribution and independent Reserved work continued. Merge PR19 and verify main next.
