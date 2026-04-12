#!/bin/bash
set -euo pipefail

echo "=== ci_post_clone.sh START ==="
echo "Repository: ${CI_PRIMARY_REPOSITORY_PATH:-unknown}"

export HOMEBREW_NO_AUTO_UPDATE=1
export HOMEBREW_NO_INSTALL_CLEANUP=1

echo "--- [1/5] Node.js ---"
brew install node || brew upgrade node || true
node --version || { echo "ERROR: node not found"; exit 1; }
echo "Node: $(node --version), npm: $(npm --version)"

echo "--- [2/5] pnpm ---"
npm install -g pnpm@10.28.2
echo "pnpm: $(pnpm --version)"

echo "--- [3/5] pnpm install ---"
cd "$CI_PRIMARY_REPOSITORY_PATH"
pnpm install --frozen-lockfile

echo "--- [4/5] Convex codegen ---"
export CONVEX_DEPLOYMENT="${CONVEX_DEPLOYMENT:-prod:quick-falcon-481}"
npx convex codegen --typecheck=disable

echo "--- [5/5] pod install ---"
cd "$CI_PRIMARY_REPOSITORY_PATH/apps/mobile/ios"
pod install

echo "--- Verify ---"
ls "$CI_PRIMARY_REPOSITORY_PATH/apps/mobile/ios/OpenPing.xcworkspace/contents.xcworkspacedata"
echo "Workspace OK"

echo "=== ci_post_clone.sh DONE ==="
