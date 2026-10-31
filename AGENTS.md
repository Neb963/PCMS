# PCMS agent instructions

Read the accepted [v42 specification](spec/PCMS-Working-Draft-v42.md), then [design revision 2](architecture/design.md), [PHASES.md](PHASES.md) and [todo.md](todo.md). Keep the authority files unchanged. Older Alpha, Discovery and research are evidence only. [memory.md](memory.md) is non-authoritative context; [learned.md](learned.md) records useful actual lessons.

1. Work on one phase at a time. Inspect the actual checkout, remote and current work. Resume unfinished work from the latest pushed checkpoint before selecting the first dependency-ready phase. The implementation task prompt controls the number of phases to execute.
2. Deliver the phase's real behavior and applicable primary UI together. Use the one Core record set, queue, module host and dashboard. Follow design contracts; do not add a second controller, service, workflow engine or approval program.
3. Preserve donor-first fail-closed protection and account/source scope. Use the existing bridge and retained Gecko ID only in a dedicated clean profile; do not edit the native-host allowlist when the retained ID is already configured. Do not overwrite Alpha or run competing profile route mutations. Never fall back to Direct.
4. Preserve human edits, previous-good source, root Git instructions and unfinished jobs. Unknown external effects require readback of the same operation. A timeout, expired lease or double click does not authorize replay.
5. Follow [CI-GUIDELINES.md](CI-GUIDELINES.md) for tests and before CI changes. Complete required focused/installed checks for the changed boundary and record their actual tier; reuse unchanged passing fixture evidence rather than repeating the whole suite. Reuse completed research; new code still needs its relevant integration evidence. Deferred live checks remain NOT TESTED and do not block unrelated safe coding.
6. Keep credentials, cookies, live sessions, personal route configuration and credential-inclusive archives out of public GitHub/CI. Do not perform live mutations without explicit authorization for those targets/effects. Make ordinary authorized internal steps automatic.
7. Push small meaningful code plus `todo.md` checkpoints frequently to the actual GitHub remote. Record the real commit, results, holds and next action. If publishing is unavailable, preserve local work and report the exact dependency; invent no remote evidence.
8. Keep `todo.md` limited to current/next eligible work. Add a specific linked diagnostic note only when necessary. Keep memory short; add lessons only from actual evidence. Do not copy specification checklists into extra status files or weaken requirements/tests to make checks pass.

The shared packaged Core Downloads adapter belongs to Core and remains usable by Discover and enabled Backup when Journal is disabled.

The complete acceptance XPI must include all seven modules enabled and all required controls operating. Global Pause preserves enabled Journal/Backup maintenance; module Disable stops that module. Core event recording always continues.
