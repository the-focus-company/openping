#!/bin/bash
set -euo pipefail

# -------------------------------------------------------------------
# Build & upload OpenPing to TestFlight (local Mac)
# Usage: ./scripts/build-testflight.sh
# -------------------------------------------------------------------

WORKSPACE="ios/OpenPing.xcworkspace"
SCHEME="OpenPing"
ARCHIVE_PATH="build/OpenPing.xcarchive"
EXPORT_PATH="build/export"
EXPORT_OPTIONS="scripts/ExportOptions.plist"

cd "$(dirname "$0")/.."

# Load local env if present
[[ -f .env.local ]] && set -a && source .env.local && set +a

# App Store Connect API credentials (set via env or .env.local)
: "${APP_STORE_API_KEY_ID:?Set APP_STORE_API_KEY_ID}"
: "${APP_STORE_API_ISSUER_ID:?Set APP_STORE_API_ISSUER_ID}"

echo "==> Bundling JS..."
npx expo export --platform ios

echo "==> Cleaning previous build..."
rm -rf build

echo "==> Archiving..."
xcodebuild archive \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$ARCHIVE_PATH" \
  CODE_SIGN_STYLE=Automatic \
  -quiet

echo "==> Exporting IPA..."
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS" \
  -exportPath "$EXPORT_PATH" \
  -quiet

IPA=$(find "$EXPORT_PATH" -name "*.ipa" | head -1)

echo "==> Uploading to TestFlight..."
xcrun altool --upload-app \
  --type ios \
  --file "$IPA" \
  --apiKey "${APP_STORE_API_KEY_ID}" \
  --apiIssuer "${APP_STORE_API_ISSUER_ID}"

echo "==> Done! Build uploaded to TestFlight."
echo "   Check App Store Connect for processing status."
