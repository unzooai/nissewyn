#!/usr/bin/env bash
# Build the Nissewyn macOS app bundle (.app) and disk image (.dmg).
#
# Steps:
#   1. Release-build the runtime service and CLI (unterm/ workspace).
#   2. Build the web interface (npm run build:static -> dist/client).
#   3. Stage macOS sidecar binaries into src-tauri/binaries (Contents/MacOS)
#      and shared runtime resources into src-tauri/payload (Contents/Resources).
#   4. Sign sidecar binaries (when APPLE_SIGNING_IDENTITY is set).
#   5. Bundle with Tauri (.app + .dmg).
#   6. Verify codesign and optionally notarize + staple the .dmg.
#
# Usage (from repository root):
#   bash apps/nissewyn/build-macos.sh
#   bash apps/nissewyn/build-macos.sh --skip-runtime-build --skip-interface-build
#   APPLE_SIGNING_IDENTITY="Developer ID Application: Unzoo AI Limited (HBVX9H2A42)" \
#     bash apps/nissewyn/build-macos.sh --require-signature --notarize

set -euo pipefail

SKIP_RUNTIME=0
SKIP_INTERFACE=0
REQUIRE_SIGNATURE=0
NOTARIZE=0
NOTARY_PROFILE="${APPLE_NOTARY_PROFILE:-unzoo-notary}"
TARGET_TRIPLE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-runtime-build)   SKIP_RUNTIME=1; shift ;;
    --skip-interface-build) SKIP_INTERFACE=1; shift ;;
    --require-signature)    REQUIRE_SIGNATURE=1; shift ;;
    --notarize)             NOTARIZE=1; shift ;;
    --keychain-profile)     NOTARY_PROFILE="$2"; shift 2 ;;
    --target)               TARGET_TRIPLE="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
UNTERM="$ROOT/unterm"
TAURI="$SCRIPT_DIR/src-tauri"

if [[ -z "$TARGET_TRIPLE" ]]; then
  TARGET_TRIPLE="$(rustc -vV | awk '/^host:/ { print $2 }')"
fi
echo "==> target: $TARGET_TRIPLE"

SIGNING_IDENTITY="${APPLE_SIGNING_IDENTITY:-}"
if [[ -z "$SIGNING_IDENTITY" ]]; then
  # Auto-detect Unzoo AI Limited Developer ID Application if installed.
  SIGNING_IDENTITY="$(security find-identity -v -p codesigning 2>/dev/null \
    | sed -n 's/.*"\(Developer ID Application: Unzoo AI Limited[^"]*\)".*/\1/p' \
    | head -n 1 || true)"
fi

if [[ -n "$SIGNING_IDENTITY" ]]; then
  export APPLE_SIGNING_IDENTITY="$SIGNING_IDENTITY"
  echo "==> signing identity: $APPLE_SIGNING_IDENTITY"
else
  if [[ "$REQUIRE_SIGNATURE" -eq 1 || "$NOTARIZE" -eq 1 ]]; then
    echo "error: no Developer ID Application signing identity found (set APPLE_SIGNING_IDENTITY)" >&2
    exit 1
  fi
  echo "==> building UNSIGNED (no APPLE_SIGNING_IDENTITY set)"
fi

# 1. Runtime binaries
if [[ "$SKIP_RUNTIME" -eq 0 ]]; then
  echo "==> runtime: service and CLI (release)"
  (
    cd "$UNTERM"
    UNTERM_BRAND_PRODUCT="Nissewyn" \
    UNTERM_BRAND_ICON_PNG="$ROOT/brand/nissewyn/nissewyn-mark-256.png" \
      cargo build --release --target "$TARGET_TRIPLE" -p unterm-cli -p unterm-core
  )
fi

RELEASE_DIR="$UNTERM/target/$TARGET_TRIPLE/release"
if [[ ! -f "$RELEASE_DIR/unterm-core" ]]; then
  RELEASE_DIR="$UNTERM/target/release"
fi
for bin in unterm-core unterm-cli; do
  if [[ ! -f "$RELEASE_DIR/$bin" ]]; then
    echo "error: missing runtime binary: $RELEASE_DIR/$bin" >&2
    exit 1
  fi
done

# 2. Interface
if [[ "$SKIP_INTERFACE" -eq 0 ]]; then
  echo "==> interface (static)"
  (cd "$ROOT" && npm run build:static)
fi
if [[ ! -f "$ROOT/dist/client/index.html" ]]; then
  echo "error: missing interface build at $ROOT/dist/client/index.html" >&2
  exit 1
fi

# 3. Stage sidecar binaries (Contents/MacOS via Tauri externalBin)
BINARIES="$TAURI/binaries"
rm -rf "$BINARIES"
mkdir -p "$BINARIES"
cp "$RELEASE_DIR/unterm-core" "$BINARIES/nissewyn-service-$TARGET_TRIPLE"
cp "$RELEASE_DIR/unterm-cli" "$BINARIES/nissewyn-cli-$TARGET_TRIPLE"
chmod 755 "$BINARIES/nissewyn-service-$TARGET_TRIPLE" "$BINARIES/nissewyn-cli-$TARGET_TRIPLE"

if [[ -n "$SIGNING_IDENTITY" ]]; then
  for bin in "$BINARIES/nissewyn-service-$TARGET_TRIPLE" "$BINARIES/nissewyn-cli-$TARGET_TRIPLE"; do
    echo "==> codesign $(basename "$bin")"
    codesign --force --options runtime --timestamp --sign "$SIGNING_IDENTITY" "$bin"
  done
fi

# 4. Stage shared resources (Contents/Resources via Tauri bundle.resources)
PAYLOAD="$TAURI/payload"
rm -rf "$PAYLOAD"
mkdir -p "$PAYLOAD/defaults" "$PAYLOAD/assets/fonts" "$PAYLOAD/licenses"

cp "$UNTERM/assets/unterm.conf" "$PAYLOAD/defaults/"
for font in SymbolsNerdFontMono-Regular.ttf NotoColorEmoji.ttf JetBrainsMono-Regular.ttf; do
  cp "$UNTERM/assets/fonts/$font" "$PAYLOAD/assets/fonts/"
done
printf 'Nissewyn' > "$PAYLOAD/unterm-product.txt"
cp "$ROOT/NOTICE.md" "$PAYLOAD/licenses/"
cp "$ROOT/LICENSE" "$PAYLOAD/licenses/LICENSE.txt"
cp "$UNTERM/LICENSE.md" "$PAYLOAD/licenses/UNTERM-LICENSE.md"
cp "$UNTERM/assets/fonts/LICENSE_OFL.txt" "$PAYLOAD/licenses/"
cp "$ROOT/brand/nissewyn/nissewyn-mark.svg" "$PAYLOAD/brand-logo.svg"
cp "$SCRIPT_DIR/mcp-instructions.md" "$PAYLOAD/"
cp -R "$SCRIPT_DIR/skills" "$PAYLOAD/skills"

# Verify every skill file is listed in tauri.conf.json bundle.resources
while IFS= read -r skill_file; do
  rel="${skill_file#"$PAYLOAD/"}"
  if ! grep -Fq "payload/$rel" "$TAURI/tauri.conf.json"; then
    echo "error: $rel is not listed in tauri.conf.json bundle.resources" >&2
    exit 1
  fi
done < <(find "$PAYLOAD/skills" -type f)

echo "==> staged $(find "$PAYLOAD" -type f | wc -l | tr -d ' ') runtime resource files and 2 sidecar binaries"

# 5. Generate macOS Tauri override config
OVERRIDE="$TAURI/target/macos-bundle-config.json"
mkdir -p "$(dirname "$OVERRIDE")"
cat > "$OVERRIDE" <<'JSON'
{
  "bundle": {
    "targets": ["app", "dmg"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns"
    ],
    "externalBin": [
      "binaries/nissewyn-service",
      "binaries/nissewyn-cli"
    ],
    "resources": {
      "payload/nissewyn-cli.exe": null,
      "payload/nissewyn-service.exe": null,
      "payload/conpty.dll": null,
      "payload/OpenConsole.exe": null,
      "payload/libEGL.dll": null,
      "payload/libGLESv2.dll": null,
      "payload/mesa/opengl32.dll": null
    },
    "macOS": {
      "hardenedRuntime": true,
      "minimumSystemVersion": "12.0"
    }
  }
}
JSON

# Avoid double-notarizing inside Tauri if we handle notarytool ourselves via keychain profile
unset APPLE_API_ISSUER APPLE_API_KEY APPLE_API_KEY_PATH APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID || true

echo "==> bundler (tauri build)"
(
  cd "$SCRIPT_DIR"
  npx --no-install tauri build --target "$TARGET_TRIPLE" --config "$OVERRIDE"
)

BUNDLE_DIR="$TAURI/target/$TARGET_TRIPLE/release/bundle"
APP_PATH="$BUNDLE_DIR/macos/Nissewyn.app"
DMG_PATH="$(ls -t "$BUNDLE_DIR/dmg/"*.dmg 2>/dev/null | head -n 1 || true)"

if [[ ! -d "$APP_PATH" ]]; then
  echo "error: expected app bundle at $APP_PATH" >&2
  exit 1
fi

if [[ -n "$SIGNING_IDENTITY" ]]; then
  echo "==> verify codesign on Nissewyn.app"
  codesign --verify --deep --strict --verbose=2 "$APP_PATH"
  if [[ -n "$DMG_PATH" ]]; then
    echo "==> codesign $(basename "$DMG_PATH")"
    codesign --force --timestamp --sign "$SIGNING_IDENTITY" "$DMG_PATH"
    codesign --verify --verbose=2 "$DMG_PATH"
  fi
fi

if [[ "$NOTARIZE" -eq 1 ]]; then
  if [[ -z "$DMG_PATH" ]]; then
    echo "error: no DMG found in $BUNDLE_DIR/dmg" >&2
    exit 1
  fi
  echo "==> notarizing $(basename "$DMG_PATH") via keychain profile '$NOTARY_PROFILE'"
  xcrun notarytool submit "$DMG_PATH" --keychain-profile "$NOTARY_PROFILE" --wait
  echo "==> stapling $(basename "$DMG_PATH")"
  xcrun stapler staple "$DMG_PATH"
  xcrun stapler validate "$DMG_PATH"
  spctl -a -vvv -t open --context context:primary-signature "$DMG_PATH" || true
fi

echo "==> DONE"
echo "    App: $APP_PATH"
if [[ -n "$DMG_PATH" ]]; then
  echo "    DMG: $DMG_PATH"
fi
