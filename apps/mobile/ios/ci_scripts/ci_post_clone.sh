#!/bin/bash
set -euo pipefail

export HOMEBREW_NO_AUTO_UPDATE=1

echo ">>> Installing Node.js via Homebrew..."
brew install node 2>/dev/null || brew upgrade node 2>/dev/null || echo "Node.js already installed: $(node --version)"

echo ">>> Enabling corepack and installing pnpm..."
corepack enable
corepack prepare pnpm@10.28.2 --activate

echo ">>> Installing dependencies..."
cd "$CI_PRIMARY_REPOSITORY_PATH"
pnpm install --frozen-lockfile

echo ">>> Running Convex codegen..."
cd "$CI_PRIMARY_REPOSITORY_PATH/apps/mobile"
npx convex codegen --typecheck=disable

echo ">>> Installing CocoaPods..."
cd "$CI_PRIMARY_REPOSITORY_PATH/apps/mobile/ios"
pod install

echo ">>> Done!"
