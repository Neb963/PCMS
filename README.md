# PCMS

PCMS is a Firefox extension in development for managing accounts, generators, development/deployment, refreshing, and portable records. It integrates the established PersonaMonkey routing implementation.

## Project authority

- [Accepted client specification — v42](spec/PCMS-Working-Draft-v42.md)
- [Accepted architecture — design revision 2](architecture/design.md)
- [Implementation phases](PHASES.md) and [current work](todo.md)
- [Agent instructions](AGENTS.md) and [CI guidance](CI-GUIDELINES.md)
- [Project context](memory.md) and [evidence-based lessons](learned.md)

The accepted specification controls product behavior; the design supplies implementation choices. Historical PCMS-Alpha code and research are references, not an alternate product specification.

## Implementation and acceptance

PCMS includes all seven modules: Accounts, Discover, Creator, Deployer, Refresher, Journal and Backup, sharing one Core dataset, queue and dashboard. Fresh installs enable all seven; existing user packages, settings and disabled state are preserved. P01–P40 implementation and fixture evidence are complete. P41 qualifies the full acceptance candidate; its exact source, tested XPI hash, artifacts and current result are recorded in [current work](todo.md).

Authorized live acceptance P42–P49 remains **NOT TESTED**. Fixture records do not establish real routes, current provider compatibility, working restored logins or fleet readiness. The candidate is an unsigned development build; signed/general distribution is unestablished.

Use the [installation and verification guide](docs/DEVELOPMENT.md) in a dedicated clean Firefox Developer Edition profile with the existing external PersonaMonkey bridge. Keep Alpha profiles intact and retain the configured Gecko ID. Normal sandbox/CSP and donor-first protection remain required.

Do not commit real credentials, sessions/cookies, native bridge configuration, or credential-inclusive backup archives. Live provider effects need named authorized disposable resources as specified in [PHASES.md](PHASES.md).
