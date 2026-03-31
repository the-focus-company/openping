# Branch Protection Rules for `main`

Go to: https://github.com/the-focus-company/openping/settings/rules

Create a new ruleset targeting `main`:

## Required settings

- **Require a pull request before merging**
  - Required approvals: 0 (for 2-person team — self-merge OK)
  - Dismiss stale reviews when new commits are pushed: on
- **Require status checks to pass**
  - Required checks: `Lint`, `Typecheck`, `Build`
- **Block force pushes**
- **Require linear history** (no merge commits — squash or rebase only)

## Bypass list

- Add both @rafalw and @alfaro-konrad as bypass actors
  (allows emergency direct pushes — use sparingly)
