# Plan 002: Wire PR diff comments to GitHub inline threads

> **Executor instructions**: Follow this plan in order. Keep the implementation
> inside the existing `apps/app`, `apps/server`, `apps/web`, and `apps/desktop`
> split. Do not add a vendor mirror, patch queue, OAuth flow, markdown renderer,
> realtime polling, or generic emoji picker.
>
> **Drift check (run first)**:
> `git status --short`
> `git diff --stat HEAD -- apps/app/src apps/server/src apps/web/app apps/desktop/src`
> If comment UI, desktop API, or GitHub PR loading changed since this plan was
> written, compare this plan against live code before editing.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MEDIUM
- **Depends on**: none
- **Category**: product, GitHub integration, review UX
- **Planned at**: 2026-06-24

## Why this matters

The current PR diff comments are local UI annotations. Asahi should treat the
PR diff as the place for GitHub inline review threads: load existing threads,
render them next to code, create new comments, reply, resolve/unresolve, and
react using the user's desktop GitHub identity.

The accepted product boundary is recorded in
`docs/adr/0001-github-pr-comments-start-desktop-only.md`.

## Scope

**In scope**:

- Desktop-only GitHub write support through `apps/server` and the local desktop
  API.
- Load GitHub inline threads for an opened PR.
- Render anchored threads near the matching code line or file header.
- Show resolved threads collapsed by default.
- Create single comments immediately, with optimistic UI and retry on failure.
- Reply to existing inline threads, optimistically.
- Resolve/unresolve visible threads, optimistically.
- Support single-line, multi-line, reply, and file-level review comment targets
  that GitHub supports.
- Render GitHub-returned markdown HTML for published comments.
- Render optimistic local text as text until GitHub returns canonical HTML.
- Reactions for PR review comments: aggregate counts, current viewer state,
  optimistic add/remove, no per-user list.
- Header refresh button that reloads the full PR view, including diff and
  GitHub inline threads, without preserving scroll/selection/drafts.

**Out of scope**:

- Public web GitHub write access or OAuth/session design.
- Pending review queues or batch submit.
- Editing or deleting published GitHub comments.
- Deleting failed optimistic comments.
- Apply suggestion.
- Realtime polling/subscriptions.
- Sidebar badges, unresolved counts, filters, or comment search.
- New keyboard shortcuts.
- Dedicated gh-auth/permission empty states.
- Generic emoji picker or decorative visual effects.

## Design constraints

- Follow `CONTEXT.md` language: use GitHub inline comment/thread terminology.
- Follow current Asahi/DiffHub design DNA: compact spacing, existing CSS tokens,
  restrained hover/focus states, and familiar GitHub reaction vocabulary.
- `apps/web` may keep using public exports from `@asahi/app` and
  `@asahi/server`; do not import app internals through local aliases.
- `apps/app` should receive comment/thread capabilities through public props or
  package exports. It should not shell out to `gh`.
- `apps/server` owns GitHub REST/GraphQL calls.

## Implementation Steps

### Step 1: Add server GitHub inline thread DTOs and API calls

In `apps/server/src`, add or extend GitHub review-comment support:

- Fetch PR review threads with GraphQL so thread state such as resolved and
  collapsed is available.
- Include comment author, avatar, raw body, GitHub-rendered HTML, anchor data,
  reactions, and current viewer reaction state.
- Create a top-level review comment with REST.
- Create a reply with REST `in_reply_to`.
- Resolve/unresolve threads with GraphQL mutations.
- Add/remove reactions for PR review comments with REST reactions endpoints.
- Return structured failure objects consistent with the existing
  `DesktopGitHubFailure` style.

Use GitHub's official review comment and reactions endpoints as the source of
truth for supported anchors and reaction names.

### Step 2: Expose the API through the desktop Hono server

In `apps/server/src/desktop.ts`, add desktop routes for:

- list inline threads for PR
- create inline comment
- reply to inline thread/comment
- resolve/unresolve thread
- add/remove reaction

Validate incoming JSON with `zod`, mirroring the existing route style.

### Step 3: Add renderer API wrappers

In `apps/desktop/src/renderer/desktopApi.ts` and shared desktop types:

- Add functions for every new desktop route.
- Keep request/response DTOs imported from `@asahi/server` where practical.
- Preserve the existing local API token flow.

### Step 4: Replace local saved-comment state with thread state in `apps/app`

In `apps/app/src/lib/types.ts` and related helpers:

- Model `GitHubInlineThread`, `GitHubInlineComment`, anchors, reactions, and
  optimistic/failed state.
- Keep a compatibility adapter only if needed to avoid rewriting the whole
  sidebar at once.
- Existing fake/local comment terminology should disappear from UI copy.

### Step 5: Load threads with the patch

In `usePatchLoader` or a focused hook called by `ReviewUI`:

- Load diff data and GitHub inline threads for desktop PR tabs.
- Map thread anchors to current `CodeView` items by path and line/file anchor.
- Skip or sidebar-only any thread that cannot be safely anchored in the current
  diff; do not invent fragile recovery for outdated comments.
- Reset loaded threads on full refresh/reopen.

### Step 6: Render thread annotations near code

Replace `ExampleAnnotation` with a GitHub thread annotation component:

- Render comments in thread order.
- Render GitHub `bodyHTML` for published comments.
- Render optimistic local body as text.
- Collapse resolved threads by default.
- Provide Reply and Resolve/Unresolve controls.
- Render file-level comments in the file header area if the diff library can
  anchor there; otherwise use the nearest file-level annotation surface without
  creating a separate issue-comment area.

### Step 7: Implement optimistic operations

In app state handlers:

- New top-level comment: create temporary thread/comment, publish, reconcile
  returned ids/bodyHTML/author/avatar/reactions, or mark failed and allow Retry.
- Reply: append temporary reply, publish, reconcile or mark failed and allow
  Retry.
- Resolve/unresolve: flip state immediately, rollback on failure.
- Reaction add/remove: update count/current-viewer state immediately, rollback
  on failure.
- Show GitHub API failures with toast notifications.

Do not refetch every thread after each successful operation.

### Step 8: Add header refresh

Add a refresh action in `DiffsHubHeader` that triggers a full PR view reload:

- reload diff
- reload GitHub inline threads
- clear scroll position, selected lines, and drafts

Keep the control visually consistent with existing header icon buttons.

### Step 9: Verify

Run:

```sh
pnpm typecheck:server
pnpm typecheck:app
pnpm typecheck:web
pnpm build:web
```

For desktop changes, also run the existing desktop verification command if one
is available in `apps/desktop/package.json`; otherwise run the narrow test suite
that covers touched desktop files.

Manual smoke:

- Open a desktop PR tab.
- Existing GitHub inline threads render near code.
- Resolved threads start collapsed.
- Create single-line, multi-line, and file-level comments.
- Reply to a thread.
- Resolve and unresolve a thread.
- Add and remove a reaction.
- Trigger a failed operation if possible and confirm toast + retry state.
- Use header refresh and confirm diff + threads reload.

## STOP conditions

Stop and report if:

- GitHub's API cannot return thread resolved state with the available `gh`
  authentication.
- `@pierre/diffs` cannot represent file-level annotations without invasive
  library changes.
- Existing desktop API auth cannot safely expose comment write routes.
- Implementing reactions requires displaying per-user reaction lists.
- Typecheck/build failures appear outside the files touched for this plan.

## Git workflow

- Branch name suggestion: `feature/github-inline-comments`.
- Commit message suggestion: `feat(desktop): publish github inline comments`.
- Do not push unless the operator explicitly asks.
