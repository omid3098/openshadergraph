# Release Testing Playbook

This guide walks you through verifying Semantic Release end to end—from local version planning to checking the deployed UI badge and the GitHub Action that publishes releases.

## 1. Prepare a test branch

1. Sync with `main`:
   ```bash
   git fetch origin
   git checkout main
   git pull --ff-only origin main
   ```
2. Create a scratch branch:
   ```bash
   git switch -c release-smoke-test
   ```
3. Make a Conventional Commit (any scope/type works as long as it follows the spec):
   ```bash
   echo "// release smoke test" >> plan.md
   git add plan.md
   git commit -m "fix: add release smoke marker"
   ```
   > Tip: Use `feat` for feature work or append `!` when you want to simulate a breaking change.

## 2. Predict the next version locally

Run the dry-run helper from this branch to see what Semantic Release would publish:

```bash
bun run release:dry -- --branches $(git rev-parse --abbrev-ref HEAD)
```

The CLI prints a summary that includes `nextRelease.version`. Confirm it matches the level of change you expect (patch, minor, or major).

## 3. Verify the in-app badge

Build the app (the build script injects version metadata without mutating sources) and boot it locally:

```bash
bun run build
bun run start
```

Load http://localhost:3000/ and check the top-right badge. It should read `vX.Y.Z` with a tooltip showing commit and build details that align with the dry-run output.

## 4. Exercise the GitHub Action in dry-run mode

To verify the CI workflow end to end without publishing a real release:

1. Push your scratch branch to GitHub:
   ```bash
   git push -u origin HEAD
   ```
2. Open **Actions → Release Dry Run** in GitHub and trigger a new run. Select your branch in the dispatch dialog.
3. Inspect the job logs. They mirror `bun run release:dry` and report the same `nextRelease.version` and changelog excerpt, but they never tag or publish packages.

## 5. Cleanup

Delete the scratch branch locally and remotely when you are done:

```bash
git checkout main
git branch -D release-smoke-test
git push origin :release-smoke-test
```

You now have confidence that:

- Conventional Commits drive the calculated version bump.
- The built UI shows the injected version string.
- GitHub Actions can execute Semantic Release successfully without affecting production.
