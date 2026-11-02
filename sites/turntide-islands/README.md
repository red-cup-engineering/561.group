# @emsenn/turntide-islands

Turntide Islands is the 561 Group package for the Discord-native community and its durable knowledge-vault surface.

This package replaces the earlier `@emsenn/turntide-islands.discord.com` app boundary.
The executable package is downstream only of `@emsenn/infography`; prior Discord/steward/vault code is preserved under `dev/content/triage/` as provenance instead of remaining in the runtime dependency graph.

## Commands

- `pnpm check` - typecheck the package.
- `pnpm build` - build `dist/`.
- `pnpm test` - verify the built package surface and dependency boundary.
- `pnpm emit` - print the package carrier as JSON.
- `pnpm build:site` - write the static semantic site to `dist/site/`.

