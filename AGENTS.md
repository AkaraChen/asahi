# AGENTS.md

## Web App Split

The DiffsHub fork is split across three workspace apps:

- `apps/web` is the Next.js shell: routes, layout, metadata, CSS, and public
  assets.
- `apps/app` owns the reusable page implementations, components, frontend
  interaction logic, and worker-related UI.
- `apps/server` owns the Hono diff API implementation.

Keep imports on those boundaries. `apps/web` should call public exports from
`@asahi/app` and `@asahi/server` instead of importing app internals through a
local alias. Do not recreate a separate vendor mirror, patch queue, or
patch-management scripts.

Use these commands:

- `pnpm build:web` builds the Next.js shell.
- `pnpm dev:web` builds once, then starts the web app.
- `pnpm typecheck:app` checks the extracted frontend package.
- `pnpm typecheck:server` checks the extracted API package.
- `pnpm typecheck:web` checks the Next.js shell.

When syncing from upstream, clone or fetch `pierrecomputer/pierre` in a
temporary directory, compare `apps/diffshub`, and copy or merge the needed
changes into the split packages above.
