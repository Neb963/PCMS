# Development installation

P01 is an incomplete host checkpoint. It does not manage providers yet.

Use Node 22+ and Python 3. Run `npm test` and `npm run build`. The XPI and its source/SHA-256 receipt are in `build/`. No dependencies or native-host changes are needed to build.

Create a dedicated clean Firefox Developer Edition profile with `about:profiles`. Check its root path and installed extensions before installation. Do not use an Alpha/PersonaMonkey profile. This XPI keeps `persona-route-manager@local`, so installing over that ID replaces the existing add-on. Keep Alpha profiles intact. Startup rejects existing donor data and synced recovery authority without deleting it.

Use a Firefox build whose version satisfies `154.0`. `154.0b10` compares below that minimum. Use the browser's development unsigned-XPI setting if required; keep normal OS sandbox and extension CSP. Install `build/pcms-p01.xpi` persistently with Install Add-on From File. Do not use temporary debugging installation as persistent evidence.

Click the toolbar icon to open PCMS. Repeated clicks focus the same dashboard. A clean profile without the existing PersonaMonkey native bridge reports blocked work. The bridge retains its protocol and allowlist. Do not edit the allowlist for the retained ID. Separate profiles share the native daemon; do not issue competing route mutations from Alpha and PCMS.

The P01 installed test uses an isolated home/profile with no bridge, no login, no provider access and no sandbox overrides. It records the Firefox build, persistent add-on identity and tested XPI hash, then performs a real process restart. Working-host acceptance remains P42.

Donor source: `vendor/provenance.json` and `vendor/personamonkey/LICENSE`. Build-copy transformations: `scripts/donor-overlay.mjs` and the pinned Alpha native transport repair. Original vendor bytes are never changed. Legacy popup/options, public donor command dispatch, workflow startup and native idle-stop scheduling are excluded from the operating host; donor route/privacy/recovery services remain the authority. Later phases add the private account adapter and one Core queue.
