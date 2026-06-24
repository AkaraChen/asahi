# Asahi Review Context

Asahi is a faster GitHub pull request review client. This context names the review workflow concepts that should stay consistent across the desktop app, web shell, and server API.

## Language

**GitHub inline comment**:
An inline pull request comment anchored to a file and line or range in the GitHub PR diff.
_Avoid_: Fake code comment, local comment, issue comment

**File-level review comment**:
A GitHub pull request review comment anchored to a changed file rather than a specific diff line.
_Avoid_: Issue comment, PR summary comment

**GitHub inline thread**:
A GitHub review thread that groups inline comments at one diff anchor and carries thread state such as resolved or collapsed.
_Avoid_: Comment list

**Pending review**:
A draft GitHub pull request review that can collect multiple comments before submission.
_Avoid_: Comment batch, review queue

**Optimistic inline comment**:
A GitHub inline comment shown in the diff before GitHub confirms creation.
_Avoid_: Saved comment

**Failed inline comment**:
An optimistic inline comment that GitHub did not create and that remains available for retry.
_Avoid_: Draft comment
