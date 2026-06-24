# GitHub PR comments start desktop-only

GitHub PR diff comments will first be wired through the desktop app, using the local desktop API and the user's existing GitHub CLI authentication, instead of adding GitHub write access to the public web app. This keeps the first writable review workflow inside the boundary that already owns GitHub access, while leaving the web shell read-only until a separate OAuth/session model is designed.

Saved inline comments are published immediately as single GitHub PR review comments. Asahi will not introduce a pending-review queue, batch submit flow, or review-event model until users need those explicitly.

The desktop viewer will load existing GitHub inline comment threads for the opened PR and render comments that can be anchored to the current diff. Resolved threads are still shown, but default to collapsed, and users can resolve or unresolve visible threads from Asahi. Issue comments, review summary comments, and complex recovery for comments that GitHub marks as outdated are outside the first writable workflow.

New inline comments will use an optimistic UI: the comment appears in the diff immediately with a temporary local key, then reconciles to GitHub's returned comment id after the API call succeeds. If publishing fails, the UI must keep the comment visibly recoverable instead of silently treating it as a published GitHub comment.

Inline comments render through the GitHub inline thread model, including new optimistic comments. The thread model owns resolved, collapsed, retry, and future reply state, while the visual annotation remains anchored next to the relevant code line in the diff.

Failed optimistic comments stay anchored where the user wrote them and offer retry without adding comment deletion to the first workflow. They do not silently become drafts again.

Resolve and unresolve actions also use an optimistic UI. The visible thread state flips immediately, then rolls back if GitHub rejects the mutation.

Users can reply to an existing inline thread. Replies append optimistically to the thread and reconcile to GitHub's returned comment id; editing or deleting comments that GitHub has already published is outside the first workflow.

Successful comment, reply, resolve, and unresolve operations reconcile only the affected local thread or comment. Asahi does not refetch every GitHub inline thread after each operation; a full reload happens when the user refreshes or reopens the PR.

Asahi does not poll GitHub or subscribe to live thread updates while a PR is open. Other reviewers' changes appear after the user refreshes or reopens the PR.

The viewer header includes a refresh action that reloads the full PR view, including the diff and GitHub inline threads. Refresh does not preserve scroll position, selected lines, or draft input.

Existing GitHub comments display GitHub's returned author and avatar. Optimistic comments created by the current viewer use the current viewer identity until GitHub returns the canonical comment payload.

GitHub comment reactions are part of the first workflow. Asahi loads reaction groups for inline comments and lets the current viewer add or remove their own reaction.

Reaction changes use an optimistic UI. Counts and current-viewer state update immediately, then roll back if GitHub rejects the create or delete request.

GitHub API failures are reported with toast notifications. Anchored failed optimistic comments remain visible for retry, but individual operation areas do not need persistent inline error copy in the first workflow.

The first workflow does not add dedicated empty states for missing GitHub CLI authentication or insufficient permissions. GitHub failures are surfaced through the same toast and failed-operation handling, while the diff remains viewable when possible.

Reaction UI should stay lightweight while following Asahi's existing design DNA: use the current diff/comment tokens, compact spacing, familiar GitHub reaction vocabulary, and restrained hover/focus states instead of a general emoji picker or decorative effects.

Reactions show aggregate counts and whether the current viewer has reacted. Asahi does not load or display the per-reaction user list in the first workflow.

Asahi will not add sidebar badges, unresolved counts, filters, or comment search in the first workflow.

Asahi will not add new keyboard shortcuts for comment or reply submission in the first workflow.

Published comments render GitHub-provided markdown HTML. Optimistic comments can render their raw body locally until GitHub returns the canonical HTML, avoiding a second markdown implementation in Asahi.

Only HTML returned by GitHub's API is rendered as HTML. Locally typed optimistic bodies stay text-only until GitHub confirms them, so user input never becomes local HTML.

GitHub suggested-change blocks may appear through GitHub's rendered markdown HTML, but Asahi will not implement Apply suggestion in the first workflow.

Asahi's comment anchors should match the GitHub web UI's supported inline comment targets instead of adding narrower local rules. The first implementation must support single-line comments, multi-line range comments, replies to top-level review comments, and file-level review comments where GitHub's API supports them.
