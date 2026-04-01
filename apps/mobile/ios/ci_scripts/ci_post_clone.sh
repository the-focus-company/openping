#!/bin/bash
set -euo pipefail

export HOMEBREW_NO_AUTO_UPDATE=1

echo ">>> Installing Node.js via Homebrew..."
brew install node 2>/dev/null || brew upgrade node 2>/dev/null || echo "Node.js already installed"
echo "Node: $(node --version), npm: $(npm --version)"

echo ">>> Installing pnpm@10.28.2..."
npm install -g pnpm@10.28.2
echo "pnpm: $(pnpm --version)"

echo ">>> Installing dependencies..."
cd "$CI_PRIMARY_REPOSITORY_PATH"
pnpm install --frozen-lockfile

echo ">>> Installing CocoaPods..."
cd "$CI_PRIMARY_REPOSITORY_PATH/apps/mobile/ios"
pod install

echo ">>> Done!"
