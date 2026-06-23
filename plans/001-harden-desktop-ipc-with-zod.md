# Plan 001: Harden desktop IPC payloads with zod schemas

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in "STOP conditions" occurs, stop and report. When
> done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 99a64aa..HEAD -- apps/desktop/package.json apps/desktop/src apps/desktop/test`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts below against live code before proceeding.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: security, correctness
- **Planned at**: commit `99a64aa`, 2026-06-23

## Why this matters

`apps/desktop` exposes Electron IPC methods through preload. TypeScript types
describe the renderer API, but main receives runtime `unknown` values and
currently casts them by handler signature. A malformed renderer call can reach
GitHub CLI loaders or tab/window state with bad shapes. Make the IPC DTOs real
runtime contracts with `zod`, and infer TypeScript DTO types from those schemas
so the schema becomes the only source of truth.

This plan intentionally covers all current desktop IPC request payloads, not
just one handler.

## Current state

Relevant files:

- `apps/desktop/package.json` — desktop package manifest; does not currently
  declare `zod`.
- `apps/desktop/src/shared/desktopTabs.ts` — tab IPC channel names and request
  TypeScript interfaces.
- `apps/desktop/src/shared/githubPullRequests.ts` — GitHub repository/PR IPC
  channel names and request TypeScript interfaces.
- `apps/desktop/src/preload/index.ts` — exposes `window.asahi` and forwards
  `unknown` values to IPC.
- `apps/desktop/src/main/index.ts` — registers IPC handlers and currently
  trusts handler parameter types.
- `apps/desktop/test/*.test.ts` — Bun tests exist, but no desktop test script
  exists yet.

Current excerpts:

`apps/desktop/src/preload/index.ts:20`

```ts
listOwnerRepositories: (request: unknown) =>
  ipcRenderer.invoke(LIST_OWNER_REPOSITORIES_CHANNEL, request),
listRepositoryPullRequests: (request: unknown) =>
  ipcRenderer.invoke(LIST_REPOSITORY_PULL_REQUESTS_CHANNEL, request),
getViewerTabRequest: (id: string) =>
  ipcRenderer.invoke(DESKTOP_GET_VIEWER_TAB_REQUEST_CHANNEL, id),
openViewerTab: (request: unknown) =>
  ipcRenderer.invoke(DESKTOP_OPEN_VIEWER_TAB_CHANNEL, request),
selectDesktopTab: (request: unknown) =>
  ipcRenderer.invoke(DESKTOP_SELECT_TAB_CHANNEL, request),
```

`apps/desktop/src/main/index.ts:197`

```ts
ipcMain.handle(
  LIST_OWNER_REPOSITORIES_CHANNEL,
  (_event, request: DesktopListOwnerRepositoriesRequest) =>
    listGitHubOwnerRepositories(request)
);
```

`apps/desktop/src/shared/desktopTabs.ts:10`

```ts
export interface DesktopViewerPrTabRequest {
  id: string;
  type: 'pr';
  owner: string;
  repo: string;
  number: number;
  body?: string;
  title?: string;
  viewerAvatarUrl?: string;
}
```

`apps/desktop/src/shared/githubPullRequests.ts:56`

```ts
export interface DesktopListOwnerRepositoriesRequest {
  owner: string;
  ownerType: DesktopRepositoryOwner['type'];
}

export interface DesktopListPullRequestsRequest {
  repositories: DesktopSelectedRepository[];
}
```

Repo conventions:

- Shared desktop DTO/channel definitions live under `apps/desktop/src/shared`.
- Main-process IPC handlers live in `apps/desktop/src/main/index.ts`.
- Existing focused tests use Bun under `apps/desktop/test`.
- Verification commands from recon:
  - `pnpm --dir apps/desktop typecheck`
  - `bun test apps/desktop/test`

Known current baseline issue at planning time: `pnpm --dir apps/desktop typecheck`
and `bun test apps/desktop/test` were failing before this plan was written. The
executor should make both green by the end, but must keep changes scoped to the
desktop package.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Add dependency | `pnpm --dir apps/desktop add zod` | exit 0; `apps/desktop/package.json` lists `zod` |
| Typecheck | `pnpm --dir apps/desktop typecheck` | exit 0, no errors |
| Tests | `bun test apps/desktop/test` | exit 0, all desktop tests pass |
| Audit touched files | `git status --short` | only in-scope desktop files and `plans/README.md` changed |

## Scope

**In scope**:

- `apps/desktop/package.json`
- lockfile changes caused by adding `zod`
- `apps/desktop/src/shared/desktopTabs.ts`
- `apps/desktop/src/shared/githubPullRequests.ts`
- `apps/desktop/src/main/index.ts`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/renderer/global.d.ts`
- `apps/desktop/test/*.test.ts`
- `plans/README.md`

**Out of scope**:

- `apps/app`, `apps/server`, and `apps/web`
- changing GitHub GraphQL/REST behavior
- changing tab UX, colors, layout, or PR body rendering
- introducing a custom validator instead of `zod`

## Git workflow

- Branch name suggestion: `advisor/001-desktop-ipc-zod`
- Commit message style: use the existing conventional-ish style when practical,
  for example `fix(desktop): validate ipc payloads`.
- Do not push unless the operator explicitly asks.

## Steps

### Step 1: Add zod to the desktop package

Run:

```sh
pnpm --dir apps/desktop add zod
```

Do not add a wrapper validation library.

**Verify**: `rg -n '"zod"' apps/desktop/package.json` -> one match.

### Step 2: Move request DTOs to zod schemas

In `apps/desktop/src/shared/desktopTabs.ts`:

- Import `z` from `zod`.
- Define schemas for:
  - `DesktopSelectTabRequestSchema`
  - `DesktopViewerPrTabRequestSchema`
  - `DesktopViewerTabRequestSchema`
- Export request types with `z.infer<typeof ...Schema>`.
- Keep `getViewerTabPath(tab: DesktopViewerTabRequest)` unchanged in behavior.

Use shape constraints:

```ts
const nonEmptyString = z.string().min(1);

export const DesktopViewerPrTabRequestSchema = z.object({
  id: nonEmptyString,
  type: z.literal('pr'),
  owner: nonEmptyString,
  repo: nonEmptyString,
  number: z.number().int().positive(),
  body: z.string().optional(),
  title: z.string().optional(),
  viewerAvatarUrl: z.string().url().optional(),
});
```

If existing callers pass empty strings for optional `title`, `body`, or
`viewerAvatarUrl`, keep those fields optional but do not coerce empty strings
inside the schema; normalization belongs at the caller or rendering boundary.

In `apps/desktop/src/shared/githubPullRequests.ts`:

- Import `z` from `zod`.
- Define and export:
  - `DesktopSelectedRepositorySchema`
  - `DesktopListOwnerRepositoriesRequestSchema`
  - `DesktopListPullRequestsRequestSchema`
- Infer `DesktopSelectedRepository`, `DesktopListOwnerRepositoriesRequest`, and
  `DesktopListPullRequestsRequest` from the schemas.
- Keep response/result interfaces as TypeScript types unless they need runtime
  parsing. This plan is only for inbound IPC request payloads.

Suggested shape:

```ts
const repositoryName = z.string().min(1);

export const DesktopSelectedRepositorySchema = z
  .object({
    owner: repositoryName,
    name: repositoryName,
    nameWithOwner: repositoryName,
  })
  .refine(
    (repository) =>
      repository.nameWithOwner === `${repository.owner}/${repository.name}`,
    { message: 'nameWithOwner must match owner/name' }
  );

export const DesktopListOwnerRepositoriesRequestSchema = z.object({
  owner: repositoryName,
  ownerType: z.enum(['personal', 'organization']),
});

export const DesktopListPullRequestsRequestSchema = z.object({
  repositories: z.array(DesktopSelectedRepositorySchema),
});
```

**Verify**: `pnpm --dir apps/desktop typecheck` may still fail on existing
baseline errors, but it must not show errors caused by missing schema exports or
broken imports. If the baseline errors remain, proceed to Step 5.

### Step 3: Validate every IPC request in main

In `apps/desktop/src/main/index.ts`:

- Import the new schemas from `../shared/desktopTabs` and
  `../shared/githubPullRequests`.
- Parse every inbound IPC payload before passing it to app logic.
- Return an existing `DesktopGitHubFailure` style object for GitHub list
  handlers when parsing fails.
- Throw a plain `Error('Invalid desktop IPC payload')` for tab/window handlers
  when parsing fails. The renderer currently does not depend on structured
  failures for these calls.

Handlers to cover:

- `LIST_OWNER_REPOSITORIES_CHANNEL`
- `LIST_REPOSITORY_PULL_REQUESTS_CHANNEL`
- `DESKTOP_OPEN_VIEWER_TAB_CHANNEL`
- `DESKTOP_GET_VIEWER_TAB_REQUEST_CHANNEL`
- `DESKTOP_SELECT_TAB_CHANNEL`
- `DESKTOP_CLOSE_VIEWER_TAB_CHANNEL`

`DESKTOP_GET_VIEWER_TAB_REQUEST_CHANNEL` and `DESKTOP_CLOSE_VIEWER_TAB_CHANNEL`
currently take raw strings; give them a small shared schema such as
`DesktopTabIdSchema = z.string().min(1)` in `desktopTabs.ts`.

Do not validate `get-api-base-url` or `get-api-access-token`; they take no
renderer payload.

**Verify**: `pnpm --dir apps/desktop typecheck` progresses past IPC schema
imports and handler parsing. If unrelated baseline errors remain, fix them in
Step 5.

### Step 4: Keep preload and renderer types inferred from schemas

In `apps/desktop/src/preload/index.ts`, narrow function signatures from
`unknown` to the inferred DTO types where practical:

```ts
listOwnerRepositories: (request: DesktopListOwnerRepositoriesRequest) =>
  ipcRenderer.invoke(LIST_OWNER_REPOSITORIES_CHANNEL, request),
```

In `apps/desktop/src/renderer/global.d.ts`, keep using the inferred request
types exported from shared modules. Do not duplicate DTO shapes in this file.

**Verify**: `pnpm --dir apps/desktop typecheck` has no preload/global typing
errors.

### Step 5: Restore current desktop verification failures inside scope

At planning time, desktop typecheck failed in `apps/desktop/src/renderer/App.tsx`
and the existing GitHub pull request conversion test had stale argument order.
Fix these if they still fail:

- Replace `ReturnType<typeof prQueries[number]>` with the actual query result
  element type, for example `(typeof prQueries)[number]`.
- Build `DesktopViewerPrTabRequest` with `id` present, or change the local
  temporary object type so `id` is not duplicated/overwritten.
- In `apps/desktop/test/githubPullRequests.test.ts`, call
  `toDesktopPullRequest(pullRequest, 'owner/repo', undefined, 'ADMIN')`.

Do not use this step to refactor app structure.

**Verify**:

```sh
pnpm --dir apps/desktop typecheck
bun test apps/desktop/test
```

Both commands must exit 0.

### Step 6: Add schema regression tests

Create or extend tests under `apps/desktop/test`.

Add cases for:

- valid `DesktopListOwnerRepositoriesRequestSchema`
- invalid owner repo request with empty owner
- valid `DesktopListPullRequestsRequestSchema`
- invalid selected repository where `nameWithOwner` does not match
- valid `DesktopViewerTabRequestSchema`
- invalid viewer tab with non-positive PR number
- invalid `viewerAvatarUrl`
- valid `DesktopTabIdSchema`

Follow the style in `apps/desktop/test/selectedRepositories.test.ts`: use
`bun:test`, direct imports from shared modules, and plain `expect`.

**Verify**: `bun test apps/desktop/test` -> all tests pass, including the new
schema tests.

### Step 7: Add a desktop test script

In `apps/desktop/package.json`, add:

```json
"test": "bun test test"
```

Optionally add a root script:

```json
"test:desktop": "pnpm --dir apps/desktop test"
```

This keeps the existing test files reachable by a standard command.

**Verify**:

```sh
pnpm --dir apps/desktop test
pnpm --dir apps/desktop typecheck
```

Both commands must exit 0.

## Test plan

New tests should live in `apps/desktop/test/desktopIpcSchemas.test.ts` or be
added to existing test files if that is smaller.

Model the structure after `apps/desktop/test/selectedRepositories.test.ts`.
Use `safeParse` for invalid payload cases and assert `success === false`; use
`parse` or `safeParse` with `success === true` for valid cases.

Final verification:

```sh
pnpm --dir apps/desktop typecheck
pnpm --dir apps/desktop test
```

Expected result: both exit 0.

## Done criteria

- [ ] `zod` is a direct dependency of `apps/desktop`.
- [ ] Inbound desktop IPC request DTO types are inferred from exported zod
      schemas, not hand-written interfaces.
- [ ] Every current IPC handler that accepts a renderer payload parses it before
      using it.
- [ ] Invalid payloads cannot reach GitHub CLI loaders or tab creation logic.
- [ ] Existing desktop typecheck failures are resolved.
- [ ] Existing stale Bun test is fixed.
- [ ] New schema tests cover valid and invalid payloads.
- [ ] `pnpm --dir apps/desktop typecheck` exits 0.
- [ ] `pnpm --dir apps/desktop test` exits 0.
- [ ] No files outside the scope list are modified, except lockfile changes from
      adding `zod`.

## STOP conditions

Stop and report back if:

- `zod` cannot be added to `apps/desktop` without changing package manager or
  workspace structure.
- A request payload is also consumed outside `apps/desktop` and changing its type
  would require edits in `apps/app`, `apps/server`, or `apps/web`.
- Validating IPC payloads appears to require changing GitHub API behavior.
- Verification fails because of a non-desktop package.
- Any secret/token value appears in command output; do not copy it into reports.

## Maintenance notes

Future IPC channels should add a zod schema in the relevant `shared/*` module
first, export `z.infer` types from that schema, then parse in main before use.
Reviewer should check that no new handler takes a typed parameter directly
without a runtime parse.
