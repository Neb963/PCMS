# Candidate installation and verification

PCMS contains the complete seven-module implementation. P41 qualifies one acceptance XPI; [todo.md](../todo.md) records the current result, exact source commit, XPI SHA-256, Actions artifact and pending external evidence. Use the qualified artifact when that result is PASS. Signed/general distribution is unestablished. Live acceptance P42–P49 is still NOT TESTED.

## Dedicated profile and prerequisites

1. Use a dedicated clean Firefox Developer Edition profile created with `about:profiles`. Check its root path and installed extensions. Keep Alpha/PersonaMonkey profiles intact. PCMS retains `persona-route-manager@local`; an installation over that ID replaces the existing add-on. Existing donor data or synced recovery authority causes `CLEAN_PROFILE_REQUIRED` and is preserved.
2. Use a qualifying browser. The manifest minimum is `154.0`; `154.0b10` compares below that floor. Recorded installed evidence uses Firefox155.0/build20260817142839 with normal content sandbox6 and multiple processes. Keep normal OS sandbox and extension CSP. Stop installation on an incompatible browser/profile.
3. Keep the established PersonaMonkey native bridge and WireGuard setup available. The retained ID uses the existing native-host allowlist; do not edit it or install a competing bridge. A missing/incompatible bridge leaves protected work blocked with its actual prerequisite.
4. Separate profiles share the native daemon. Stop competing route-changing work in Alpha or another profile before protected PCMS use. If that isolation cannot be established, stop setup. Never select or add a Direct fallback.
5. Extract the qualified Actions artifact and compare the XPI SHA-256 with `identity.json`. Install that same `pcms-dev.xpi` persistently using **Install Add-on From File**. Use the Developer Edition unsigned-add-on setting when required; temporary debugging installation is not persistent evidence. Preserve the tested file for acceptance.
6. Click the toolbar icon. Repeated clicks focus one dashboard. In **Settings → Modules**, verify the seven enabled fresh-install packages and grant website scripts through the operating Firefox control when requested. Existing new-PCMS profiles retain their selected packages/settings/Disable choices; an extension update does not force the bundled defaults over them.

Do not bypass a host/account hold. Use its contextual Open, Confirm, Repair or Check action. Unknown source, Git, AI or download effects retain their original operation and require readback before further work. A timeout does not authorize replay.

## Operating surfaces

Home groups attention and current work; reviewing an item does not resolve it. Global search links accounts, generator folders and exact work. Generators contains folder-only intake, Discover slug checks and per-generator creation/source/development recovery. Accounts supplies protected enrollment and lifecycle controls. Refresher measures the rendered directory and manages eligible Active/Sleep work with guarded both-file marker saves. Work retains per-item/batch results and exact Journal links. Other lists enabled module pages; Settings contains shared configuration, Modules, Git, Journal, Backup and Advanced details.

Global Pause stops ordinary work while enabled Journal/Backup maintenance continues. Disabling a module stops its module work. Core recording and the shared Downloads adapter remain available independently of Journal. No missed-work burst or automatic replay of an uncertain write is authorized by Resume.

## Backup and restore

Settings → Backup uses safe relative `PCMS/…` folders under Firefox Downloads. Wait for the original export's actual complete receipt. Native completed target size/existence and exact receipt identity are checked; the archive carries full entry hashes and an immutable cut identity. Independent disk reopen is an acceptance test, not a claim that the extension reopens every physical disk byte.

Backups are unencrypted and credential-inclusive; keep them private. They include PCMS-held source/history, packages/settings/jobs, scoped managed authentication/cookies and donor extension data. AI workspaces/chats and OS/native process secrets are excluded. The external bridge, WireGuard setup and allowlist remain prerequisites.

Restore allocates fresh destination containers and starts with persisted Pause and held uncertain work. Local data import, actual login and protected-route validation have separate results. Use Complete login/Repair/Check where required. A fresh profile on the source device does not establish fresh-device portability.

## Build and focused verification

Use Node22+ and Python3:

```sh
npm ci --ignore-scripts
npm run build
python3 scripts/release-preflight.py build/pcms-dev.xpi
```

Preflight requires clean committed P41 source. `build/identity.json` and the inner build identity bind that source to the exact XPI. A local build has its own identity; acceptance uses the artifact already tested at the recorded hash. Run the changed-boundary tests selected in the existing two-job [workflow](../.github/workflows/host.yml) and [CI guidance](../CI-GUIDELINES.md). Preserve qualifying Firefox sandbox/CSP and use synthetic local fixtures in public CI.

P40 records representative50-account/1000-plus-generator synthetic capacity with90-day Journal data, source/binary history, queue/catalog measurements and actual disk/restart/cancellation checks. Its record counts do not establish50 working routes. P41 checks the same candidate across startup, full shared UI/module/source recovery and scoped production backup/restore. Earlier unchanged boundary evidence retains its original commit/artifact identity.

## Authorized external acceptance

P42 needs a configured real host and two isolated managed accounts. Independent P43 needs a named disposable Git repository/main and suitable Contents token in a Git-only profile. P44–P47 need the authorized account/slug/source/AI/directory targets; P48 needs authorized login contexts and a configured fresh-device destination; P49 needs representative50 real routes/exits and existing authorized pools. Keep these cases NOT TESTED until their required independent observations pass. No live provider mutation is part of the synthetic fixtures.

Donor provenance is in [vendor/provenance.json](../vendor/provenance.json) and its license. Build-copy transformations retain the established donor route/privacy/recovery authority and exclude legacy management surfaces, public donor dispatch and competing workflow startup. No donor re-audit or native-service redesign is required for installation.
