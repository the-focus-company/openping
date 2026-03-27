#!/usr/bin/env bash
# publish-commands.sh
# Exact sequence of commands to build and publish Swagger docs to GitHub Pages.
# Review before running — this pushes to the gh-pages branch and enables Pages.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
OWNER_REPO="the-focus-company/openping"

# ─── Step 1: Build static HTML from the OpenAPI spec ──────────────────────────
npx @redocly/cli build-docs "$REPO_ROOT/convex/openapi.yaml" --output "$REPO_ROOT/docs/api.html"

# ─── Step 2: Ensure gh-pages branch exists (skip if it already does) ──────────
if ! git ls-remote --exit-code --heads origin gh-pages >/dev/null 2>&1; then
  git checkout --orphan gh-pages
  git reset --hard
  git commit --allow-empty -m "init gh-pages"
  git push -u origin gh-pages
  git checkout -   # return to previous branch
fi

# ─── Step 3: Deploy to GitHub Pages ──────────────────────────────────────────
rm -rf /tmp/gh-pages-deploy
mkdir -p /tmp/gh-pages-deploy
cp "$REPO_ROOT/docs/api.html" /tmp/gh-pages-deploy/index.html

git -C /tmp/gh-pages-deploy init
git -C /tmp/gh-pages-deploy checkout -b gh-pages
git -C /tmp/gh-pages-deploy add index.html
git -C /tmp/gh-pages-deploy commit -m "docs: update Swagger UI $(date -u +%Y-%m-%d)"
git -C /tmp/gh-pages-deploy remote add origin "$(git remote get-url origin)"
git -C /tmp/gh-pages-deploy push origin gh-pages --force
rm -rf /tmp/gh-pages-deploy

# ─── Step 4: Enable GitHub Pages (idempotent) ────────────────────────────────
gh api "repos/${OWNER_REPO}" \
  --method PATCH \
  --field has_pages=true \
  -H "Accept: application/vnd.github+json" > /dev/null

gh api "repos/${OWNER_REPO}/pages" \
  --method POST \
  --field 'source[branch]=gh-pages' \
  --field 'source[path]=/' \
  -H "Accept: application/vnd.github+json" 2>/dev/null || true

# ─── Step 5: Report the published URL ────────────────────────────────────────
echo ""
echo "GitHub Pages URL:"
gh api "repos/${OWNER_REPO}/pages" --jq '.html_url'
