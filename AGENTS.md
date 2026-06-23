# AGENTS.md

## DiffsHub Fork

DiffsHub lives in `apps/diffshub` as a direct fork of
`pierrecomputer/pierre/apps/diffshub`.

Edit `apps/diffshub` directly and commit the resulting tree. Do not recreate a
separate vendor mirror, patch queue, or patch-management scripts.

Use these commands:

- `pnpm build:diffshub` builds the app.
- `pnpm dev:diffshub` builds once, then starts the app.
- `pnpm typecheck:diffshub` runs TypeScript checks for the app.

When syncing from upstream, clone or fetch `pierrecomputer/pierre` in a
temporary directory, compare `apps/diffshub`, and copy or merge the needed
changes into this fork.
