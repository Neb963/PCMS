# Development installation

This is an incomplete development checkpoint. It does not manage providers yet.

Use Node 22+ and Python 3. Run `npm ci --ignore-scripts`, `npm test` and `npm run build`. The XPI and its source/SHA-256 receipt are in `build/`. The test-only IndexedDB fixture dependency is pinned in package-lock.json. No native-host change is needed.

Create a dedicated clean Firefox Developer Edition profile with `about:profiles`. Check its root path and installed extensions before installation. Do not use an Alpha/PersonaMonkey profile. This XPI keeps `persona-route-manager@local`, so installing over that ID replaces the existing add-on. Keep Alpha profiles intact. Startup rejects existing donor data and synced recovery authority without deleting it.

Use a Firefox build whose version satisfies `154.0`. `154.0b10` compares below that minimum. Use the browser's development unsigned-XPI setting if required; keep normal OS sandbox and extension CSP. Install `build/pcms-dev.xpi` persistently with Install Add-on From File. Do not use temporary debugging installation as persistent evidence.

Click the toolbar icon to open PCMS. Repeated clicks focus the same dashboard. A clean profile without the existing PersonaMonkey native bridge reports blocked work. The bridge retains its protocol and allowlist. Do not edit the allowlist for the retained ID. Separate profiles share the native daemon; do not issue competing route mutations from Alpha and PCMS.

The installed test uses an isolated home/profile with no bridge, no login, no provider access and no sandbox overrides. It records the Firefox build, persistent add-on identity and tested XPI hash, then performs a real process restart. Working-host acceptance remains P42.

Donor source: `vendor/provenance.json` and `vendor/personamonkey/LICENSE`. Build-copy transformations: `scripts/donor-overlay.mjs` and the pinned Alpha native transport repair. Original vendor bytes are never changed. The packaged module entry runs in Firefox’s generated nonpersistent background document, as in the pinned Alpha bootstrap. MV3 supplies nonpersistence; do not add the unsupported `persistent` field. Legacy popup/options, public donor command dispatch, workflow startup and native idle-stop scheduling are excluded from the operating host; donor route/privacy/recovery services remain the authority. P02 adds durable Core records and secret-safe projections. Later phases add the private account adapter and one Core queue.
