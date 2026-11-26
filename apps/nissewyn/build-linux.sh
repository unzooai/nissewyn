#!/usr/bin/env bash
# Build the Nissewyn Linux packages (.deb and .AppImage).
#
# Steps:
#   1. Release-build the runtime service and CLI (unterm/ workspace).
#   2. Build the web interface (npm run build:static -> dist/client).
#   3. Stage Linux sidecar binaries into src-tauri/binaries
#      and shared runtime resources into src-tauri/payload.
#   4. Bundle with Tauri (.deb + .AppImage).
#
# Usage (from repository root):
#   bash apps/nissewyn/build-linux.sh
#   bash apps/nissewyn/build-linux.sh --skip-runtime-build --skip-interface-build

set -euo pipefail

SKIP_RUNTIME=0
SKIP_INTERFACE=0
TARGET_TRIPLE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-runtime-build)   SKIP_RUNTIME=1; shift ;;
    --skip-interface-build) SKIP_INTERFACE=1; shift ;;
    --target)               TARGET_TRIPLE="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,15p' "$0"
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

# 3. Stage sidecar binaries via Tauri externalBin
BINARIES="$TAURI/binaries"
rm -rf "$BINARIES"
mkdir -p "$BINARIES"
cp "$RELEASE_DIR/unterm-core" "$BINARIES/nissewyn-service-$TARGET_TRIPLE"
cp "$RELEASE_DIR/unterm-cli" "$BINARIES/nissewyn-cli-$TARGET_TRIPLE"
chmod 755 "$BINARIES/nissewyn-service-$TARGET_TRIPLE" "$BINARIES/nissewyn-cli-$TARGET_TRIPLE"

# 4. Stage shared resources via Tauri bundle.resources
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

echo "==> staged $(find "$PAYLOAD" -type f | wc -l | tr -d ' ') runtime resource files and 2 sidecar binaries"

# 5. Generate Linux Tauri override config
OVERRIDE="$TAURI/target/linux-bundle-config.json"
mkdir -p "$(dirname "$OVERRIDE")"
cat > "$OVERRIDE" <<'JSON'
{
  "bundle": {
    "targets": ["deb", "appimage"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png"
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
    "linux": {
      "deb": {
        "depends": []
      }
    }
  }
}
JSON

echo "==> bundler (tauri build)"
(
  cd "$SCRIPT_DIR"
  NO_STRIP=true npx --no-install tauri build --target "$TARGET_TRIPLE" --config "$OVERRIDE"
)

BUNDLE_DIR="$TAURI/target/$TARGET_TRIPLE/release/bundle"
echo "==> DONE"
ls -lh "$BUNDLE_DIR/deb/"*.deb "$BUNDLE_DIR/appimage/"*.AppImage 2>/dev/null || true
