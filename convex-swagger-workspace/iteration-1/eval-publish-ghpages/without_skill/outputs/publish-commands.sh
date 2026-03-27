#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# publish-commands.sh
#
# Publishes the PING Platform OpenAPI / Swagger docs to GitHub Pages using
# Swagger UI.  The approach:
#   1. Create (or reset) an orphan gh-pages branch.
#   2. Drop in a static Swagger UI that points at the openapi.yaml.
#   3. Force-push to origin/gh-pages.
#   4. Enable GitHub Pages on the gh-pages branch (if not already enabled).
#
# Prerequisites:
#   - git, gh CLI authenticated, and push access to the-focus-company/openping
#   - Run from the repo root
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
SPEC_SOURCE="${REPO_ROOT}/convex/openapi.yaml"
TMPDIR="$(mktemp -d)"

# ── 1. Build the static site in a temp directory ─────────────────────────────

# Copy the spec
cp "${SPEC_SOURCE}" "${TMPDIR}/openapi.yaml"

# Create index.html with Swagger UI from CDN
cat > "${TMPDIR}/index.html" <<'HTMLEOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PING Platform – API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    html { box-sizing: border-box; overflow-y: scroll; }
    *, *::before, *::after { box-sizing: inherit; }
    body { margin: 0; background: #fafafa; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: "./openapi.yaml",
      dom_id: "#swagger-ui",
      deepLinking: true,
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIBundle.SwaggerUIStandalonePreset,
      ],
      layout: "BaseLayout",
    });
  </script>
</body>
</html>
HTMLEOF

echo "Static site built in ${TMPDIR}"

# ── 2. Create / reset the gh-pages branch ────────────────────────────────────

cd "${REPO_ROOT}"

# Save current branch so we can return to it
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

# Create an orphan gh-pages branch (no history)
git checkout --orphan gh-pages

# Remove all tracked files from the index (does not delete untracked)
git rm -rf . > /dev/null 2>&1 || true

# Copy the static site into the repo root
cp "${TMPDIR}/index.html" .
cp "${TMPDIR}/openapi.yaml" .

# Stage and commit
git add index.html openapi.yaml
git commit -m "docs: publish Swagger UI for Convex API"

# ── 3. Push to remote ────────────────────────────────────────────────────────

git push origin gh-pages --force

# ── 4. Return to the original branch ─────────────────────────────────────────

git checkout "${CURRENT_BRANCH}"

# ── 5. Enable GitHub Pages (if not already configured) ───────────────────────
#    Uses the gh CLI to set the Pages source to the gh-pages branch root.

gh api \
  --method POST \
  "repos/the-focus-company/openping/pages" \
  -f "source[branch]=gh-pages" \
  -f "source[path]=/" \
  2>/dev/null || \
gh api \
  --method PUT \
  "repos/the-focus-company/openping/pages" \
  -f "source[branch]=gh-pages" \
  -f "source[path]=/" \
  2>/dev/null || \
echo "GitHub Pages may already be configured. Verify at:"

echo ""
echo "Done! Swagger docs will be available at:"
echo "  https://the-focus-company.github.io/openping/"
echo ""
echo "If this is the first deployment, it may take a minute for GitHub Pages to go live."

# Clean up
rm -rf "${TMPDIR}"
