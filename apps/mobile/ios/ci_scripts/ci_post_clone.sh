#!/bin/bash
set -euo pipefail

echo ">>> Installing Node.js via Homebrew..."
brew install node

echo ">>> Installing pnpm..."
npm install -g pnpm

echo ">>> Installing dependencies..."
cd "$CI_PRIMARY_REPOSITORY_PATH"
pnpm install --frozen-lockfile

echo ">>> Installing CocoaPods..."
cd "$CI_PRIMARY_REPOSITORY_PATH/apps/mobile/ios"
pod install

echo ">>> Done!"
