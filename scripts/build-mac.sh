#!/bin/zsh
set -e
cd "$(dirname "$0")/.."
export RUSTUP_HOME="${RUSTUP_HOME:-$PWD/../work/toolchains/rustup}"
export CARGO_HOME="${CARGO_HOME:-$PWD/../work/toolchains/cargo}"
export PATH="$CARGO_HOME/bin:$PATH"
npx tauri build --bundles app --target aarch64-apple-darwin
app_bundle="$PWD/src-tauri/target/aarch64-apple-darwin/release/bundle/macos/IELTS Simulator.app"
codesign --force --deep --sign - --entitlements "$PWD/src-tauri/Entitlements.plist" "$app_bundle"
codesign --verify --deep --strict "$app_bundle"
