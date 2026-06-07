#!/usr/bin/env bash
# Build + run the iOS dev build.
#
# Why this wrapper exists: this machine uses `swiftly`, whose `swift` shim is
# first on PATH and points at a Swift toolchain that isn't installed. Expo's
# CocoaPods / xcframework scripts call bare `swift`/`clang`, so they pick up
# swiftly's broken default and fail (`Toolchain ... could not be located`).
# Stripping swiftly from PATH lets `/usr/bin/swift` + `/usr/bin/clang` (the
# xcrun-aware wrappers tied to Xcode) take over. See SETUP.md.
set -e
export PATH="$(echo "$PATH" | tr ':' '\n' | grep -v '\.swiftly' | paste -sd ':' -)"
exec npx expo run:ios "$@"
