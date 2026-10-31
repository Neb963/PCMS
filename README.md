# PCMS

PCMS is a Firefox extension in development for managing accounts, generators, development/deployment, refreshing, and portable records. It integrates the established PersonaMonkey routing implementation.

## Project authority

- [Accepted client specification — v42](spec/PCMS-Working-Draft-v42.md)
- [Accepted architecture — design revision 2](architecture/design.md)
- [Implementation phases](PHASES.md) and [current work](todo.md)
- [Agent instructions](AGENTS.md) and [CI guidance](CI-GUIDELINES.md)
- [Project context](memory.md) and [evidence-based lessons](learned.md)

The accepted specification controls product behavior; the design supplies implementation choices. Historical PCMS-Alpha code and research are references, not an alternate product specification.

## Development status

**P01 — Protected packaged host** is in progress. It includes the integrated donor, a dashboard shell, deterministic XPI build and focused/installed checks. It is an incomplete development checkpoint; provider workflows are not implemented. See [current work](todo.md) for exact evidence and holds.

Build and installation: [Development guide](docs/DEVELOPMENT.md). Use `npm test` and `npm run build`.

Do not commit credentials, account sessions/cookies, native bridge configuration, or credential-inclusive backups. Live provider mutations require explicit authorization and disposable test targets.
