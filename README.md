# PCMS — Perchance Management System

PCMS is a planned Firefox extension for managing Perchance accounts, generators, development/deployment, refreshing, and portable records. It integrates the established PersonaMonkey routing implementation. **Implementation has not started.**

## Project authority

- [Accepted client specification — v42](spec/PCMS-Working-Draft-v42.md)
- [Accepted architecture — design revision 2](architecture/design.md)
- [Implementation phases](PHASES.md) and [current work](todo.md)
- [Agent instructions](AGENTS.md) and [CI guidance](CI-GUIDELINES.md)
- [Project context](memory.md) and [evidence-based lessons](learned.md)

The accepted specification controls product behavior; the design supplies implementation choices. Historical PCMS-Alpha code and research are references, not an alternate product specification.

## Development status

Repository bootstrapped with planning documents only. **P01 — Protected packaged host** is the next eligible phase. No extension code, installation package, CI workflow, or live provider test is included in this bootstrap.

Do not commit credentials, Perchance sessions/cookies, native bridge configuration, or credential-inclusive backups. Live provider mutations require explicit authorization and disposable test targets.
