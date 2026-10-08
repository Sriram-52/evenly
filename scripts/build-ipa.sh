#!/usr/bin/env bash
# Build an unsigned Release .ipa for sideloading, and optionally attach it to
# the GitHub release for the current app version.
#
#   scripts/build-ipa.sh                  # -> dist/evenly-v<version>.ipa
#   scripts/build-ipa.sh --release        # ...and upload it to release v<version>
#   scripts/build-ipa.sh --release <tag>  # ...or to a specific release
#
# No Apple Developer account needed: code signing is disabled here, and the
# sideloading tool (Sideloadly, AltStore) re-signs the app with your Apple ID.
#
# Must be built with Xcode 26.x: Xcode 27 SDK builds require the UIScene
# lifecycle, which Expo SDK 56's AppDelegate doesn't adopt, so they crash at
# launch on iOS 27. CI (.github/workflows/ios-ipa.yml) pins Xcode 26.5.
# The JS bundle is built against the EAS "production" environment (prod
# Convex), not .env.local (dev) — exported vars take precedence over .env files.
set -euo pipefail
cd "$(dirname "$0")/.."

# Same swiftly workaround as scripts/ios.sh.
export PATH="$(echo "$PATH" | tr ':' '\n' | grep -v '\.swiftly' | paste -sd ':' -)"
# CocoaPods chokes on non-ASCII output under the default C locale.
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

VERSION=$(node -p "require('./app.json').expo.version")
IPA="dist/evenly-v$VERSION.ipa"
TAG="${2:-v$VERSION}"

XCODE_MAJOR=$(xcodebuild -version | awk 'NR==1 { split($2, v, "."); print v[1] }')
if (( XCODE_MAJOR >= 27 )); then
  echo "error: Xcode $XCODE_MAJOR builds crash at launch (no UIScene support in Expo SDK 56)." >&2
  echo "       Use Xcode 26.x (DEVELOPER_DIR=/Applications/Xcode_26.5.app/...) or the iOS IPA workflow." >&2
  exit 1
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "==> Pulling production env from EAS"
eas env:pull production --non-interactive --path "$TMP/prod.env" >/dev/null
set -a
source "$TMP/prod.env"
set +a

echo "==> Syncing native project with app.json"
CI=1 npx expo prebuild --platform ios --no-install
(cd ios && pod install)

# Prebuild names the project after app.json's "name" (older checkouts: "evenly").
WORKSPACE=$(ls -d ios/*.xcworkspace | head -1)
SCHEME=$(basename "$WORKSPACE" .xcworkspace)

LOG="ios/build_ipa/xcodebuild.log"
mkdir -p ios/build_ipa
echo "==> Building v$VERSION (Release, iphoneos, unsigned) — log: $LOG"
if ! xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -derivedDataPath ios/build_ipa \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" \
  >"$LOG" 2>&1; then
  grep -E "error:|BUILD FAILED" "$LOG" | tail -30 >&2
  exit 1
fi

APP=$(ls -d ios/build_ipa/Build/Products/Release-iphoneos/*.app | head -1)

# Guard against shipping a build pointed at the dev backend.
if ! grep -q "$EXPO_PUBLIC_CONVEX_URL" "$APP/main.jsbundle"; then
  echo "error: JS bundle does not reference $EXPO_PUBLIC_CONVEX_URL" >&2
  exit 1
fi

echo "==> Packaging $IPA"
mkdir -p dist "$TMP/Payload"
cp -R "$APP" "$TMP/Payload/"
rm -f "$IPA"
(cd "$TMP" && zip -qry - Payload) > "$IPA"
shasum -a 256 "$IPA"

if [[ "${1:-}" == "--release" ]]; then
  echo "==> Uploading to GitHub release $TAG"
  gh release upload "$TAG" "$IPA" --clobber
fi
