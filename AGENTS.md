# AGENTS.md

## DiffHub Vendor Patches

DiffHub is vendored from `pierrecomputer/pierre` using a quilt patch queue.
The upstream commit and source path live in `vendor/diffhub/source.json`, and
patches live in `vendor/diffhub/patches/series`.

Use these commands:

- `pnpm diffhub:push` applies all patches.
- `pnpm diffhub:pop` removes all applied patches.
- `pnpm diffhub:add -- apps/diffhub/path/to/file` adds a changed file to the current patch.
- `pnpm diffhub:refresh` refreshes the current top patch.
- `pnpm diffhub:diff` shows the current quilt diff.

To rebuild `apps/diffhub` after deleting it:

```sh
rm -rf /tmp/pierre-diffhub apps/diffhub vendor/diffhub/.pc
git clone --filter=blob:none --sparse https://github.com/pierrecomputer/pierre.git /tmp/pierre-diffhub
git -C /tmp/pierre-diffhub fetch --depth 1 origin 934f013928fbff37df72a097d53410b748ea6be4
git -C /tmp/pierre-diffhub checkout 934f013928fbff37df72a097d53410b748ea6be4
git -C /tmp/pierre-diffhub sparse-checkout set apps/diffshub
mkdir -p apps
cp -R /tmp/pierre-diffhub/apps/diffshub apps/diffhub
QUILT_PATCHES=vendor/diffhub/patches QUILT_PC=vendor/diffhub/.pc quilt --quiltrc - push -a
```

Do not vendor published `@pierre/*` packages locally. Keep them as npm
dependencies unless a package is unpublished or the app cannot work with the
published version.
